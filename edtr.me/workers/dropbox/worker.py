import logging

from tornado import gen
from django.utils import simplejson as json
import motor
from schematics.serialize import make_safe_python

from utils.async_dropbox import DropboxMixin
from models.dropbox import DropboxFile, PS
from utils.gl import DB
from utils.error import ErrCode
from .dbox_utils import (unify_path, get_file_url, check_bad_response,
    update_meta, is_image_thumb, save_meta, get_content_type, is_md, is_md_ext)
from .dbox_thumb import remove_thumbnail, copy_thumb
from .dbox_settings import DEFAULT_ENCODING, TEXT_MIMES
from .dbox_publish import publish_object, update_md_header_meta
from .dbox_op import get_obj_content, get_tree_from_db
from .dbox_delta import update_dbox_delta, dbox_sync_user
logger = logging.getLogger('edtr_logger')


def dbox_periodic_update():
    # TODO: fetch only needed fields
    cursor = DB.instance().accounts.find(
        {'dbox_access_token': {'$exists': True}})
    cursor.each(callback=dbox_sync_user)


class DropboxWorkerMixin(DropboxMixin):
    @gen.engine
    def wk_dbox_get_tree(self, user, path, recurse=False, callback=None):
        # Update metadata from dropbox to database
        r = yield gen.Task(update_dbox_delta, self.db, self, user)
        if r['errcode'] != ErrCode.ok:
            callback(r)
            return
        result = yield gen.Task(get_tree_from_db, path, user, self.db, recurse)
        callback(result)

    @gen.engine
    def wk_dbox_get_file(self, user, path, callback=None):
        # TODO: not allow call this api very often
        path = unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            callback(data)
            return
        file_meta = data
        result = yield gen.Task(get_obj_content, file_meta, user, self.db, self)
        callback(result)

    @gen.engine
    def wk_dbox_save_file(self, user, path, text_content, publish=False,
                                                               callback=None):
        # TODO: not allow call this api very often
        path = unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            # file meta not found
            data = None
        elif data.mime_type not in TEXT_MIMES:
            callback({'errcode': ErrCode.bad_request})
            return
        if text_content:
            if not isinstance(text_content, unicode):
                try:
                    text_content = text_content.decode(DEFAULT_ENCODING)
                except UnicodeEncodeError:
                    text_content = text_content.decode('ascii', 'replace')
        else:
            text_content = ''
        md_file = False
        if (data and is_md(data)) or is_md_ext(path):
            md_file = True
            text_content = update_md_header_meta(text_content, publish)
        # make dropbox request
        api_url = get_file_url(path, 'files_put')
        access_token = user.get_dropbox_token()
        response = yield gen.Task(self.dropbox_request,
            "api-content", api_url,
            access_token=access_token,
            put_body=text_content,
            overwrite='true')
        if check_bad_response(response, callback):
            return
        dbox_meta = json.loads(response.body)
        # TODO: save meta of all transitional folders, but maybe let it be
        # just not allow user in UI to create /a/b/f.txt, if /a not exists
        if data:
            yield gen.Task(update_meta, self.db, dbox_meta, user.name)
            file_meta = data
            for f in dbox_meta:
                setattr(file_meta, f, dbox_meta[f])
        else:
            new_data = yield gen.Task(save_meta, self.db, dbox_meta, user.name)
            file_meta = DropboxFile(**new_data)
        obj_for_pub = {
            'errcode': ErrCode.ok,
            'type': get_content_type(file_meta),
            'content': text_content,
            'meta': file_meta
        }
        result = yield gen.Task(publish_object,
            file_meta, user, self.db, self, preview=not publish,
            obj=obj_for_pub)
        if md_file:
            result['markdown_content'] = text_content
        callback(result)

    @gen.engine
    def wk_dbox_create_dir(self, user, path, callback=None):
        path = unify_path(path)
        # make dropbox request
        access_token = user.get_dropbox_token()
        post_args = {
            'root': DropboxMixin.ACCESS_TYPE,
            'path': path.encode(DEFAULT_ENCODING),
        }
        response = yield gen.Task(self.dropbox_request,
            "api", "/1/fileops/create_folder",
            access_token=access_token,
            post_args=post_args)
        if check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        # TODO: save meta of all transitional folders, but maybe let it be
        # just not allow  user in UI to create /a/b/, if /a not exists
        meta = yield gen.Task(update_meta, self.db, file_meta, user.name)
        meta = make_safe_python(DropboxFile, meta, 'public')
        callback({'errcode': ErrCode.ok, 'meta': meta})

    @gen.engine
    def wk_dbox_delete(self, user, path, callback=None):
        path = unify_path(path)
        # make dropbox request
        access_token = user.get_dropbox_token()
        post_args = {
            'root': DropboxMixin.ACCESS_TYPE,
            'path': path.encode(DEFAULT_ENCODING),
        }
        response = yield gen.Task(self.dropbox_request,
            "api", "/1/fileops/delete",
            access_token=access_token,
            post_args=post_args)
        if check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        is_dir, f_path = file_meta['is_dir'], file_meta['path']
        if is_dir:
            # TODO: try to avoid full collection scan
            # to include root_path.startswith(f_path) elements
            yield motor.Op(DropboxFile.remove_entries, self.db,
                {"$or": [{"_id": f_path},
                    {"root_path":
                        {'$regex': '^%s.*' % f_path, '$options': 'i'}}]},
                collection=user.name)
        else:
            yield motor.Op(DropboxFile.remove_entries, self.db,
                {"_id": f_path}, collection=user.name)
            if is_image_thumb(file_meta.get('mime_type', None),
                         file_meta.get('thumb_exists', None)):
                remove_thumbnail(f_path, user.name)
        callback({'errcode': ErrCode.ok})

    @gen.engine
    def wk_dbox_move(self, user, from_path, to_path, callback=None):
        from_path = unify_path(from_path)
        to_path = unify_path(to_path)
        # make dropbox request
        access_token = user.get_dropbox_token()
        post_args = {
            'root': DropboxMixin.ACCESS_TYPE,
            'from_path': from_path.encode(DEFAULT_ENCODING),
            'to_path': to_path.encode(DEFAULT_ENCODING),
        }
        response = yield gen.Task(self.dropbox_request,
            "api", "/1/fileops/move",
            access_token=access_token,
            post_args=post_args)
        if check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        if is_image_thumb(file_meta.get('mime_type', None),
                     file_meta.get('thumb_exists', None)):
            yield gen.Task(copy_thumb, from_path, file_meta, user, self)
            remove_thumbnail(from_path, user.name)
        yield gen.Task(update_meta, self.db, file_meta, user.name)
        # TODO: update some changes locally. For example, thumbnail.
        # Currently, if dir was moved, all thumbnails are created again
        # via dropbox
        yield gen.Task(update_dbox_delta, self.db, self, user, force_update=True)
        callback({'errcode': ErrCode.ok})

    @gen.engine
    def wk_dbox_copy(self, user, from_path, to_path, callback=None):
        from_path = unify_path(from_path)
        to_path = unify_path(to_path)
        # make dropbox request
        access_token = user.get_dropbox_token()
        post_args = {
            'root': DropboxMixin.ACCESS_TYPE,
            'from_path': from_path.encode(DEFAULT_ENCODING),
            'to_path': to_path.encode(DEFAULT_ENCODING),
        }
        response = yield gen.Task(self.dropbox_request,
            "api", "/1/fileops/copy",
            access_token=access_token,
            post_args=post_args)
        if check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        if is_image_thumb(file_meta.get('mime_type', None),
                     file_meta.get('thumb_exists', None)):
            yield gen.Task(copy_thumb, from_path, file_meta, user, self)
        yield gen.Task(update_meta, self.db, file_meta, user.name)
        # TODO: update some changes locally. For example, thumbnail.
        # Currently, if dir was copied, all thumbnails are created again
        # via dropbox
        yield gen.Task(update_dbox_delta, self.db, self, user, force_update=True)
        callback({'errcode': ErrCode.ok})

    @gen.engine
    def wk_dbox_publish(self, user, path, recurse=False, callback=None):
        path = unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            callback(data)
            return
        file_meta = data
        if file_meta.is_dir or recurse:
            callback({"errcode": ErrCode.not_implemented})
        if file_meta.pub_status == PS.published:
            callback({"errcode": ErrCode.already_published})
            return

        result = yield gen.Task(publish_object, file_meta, user, self.db, self)
        callback(result)

    @gen.engine
    def _get_filemeta(self, path, collection, callback):
        file_meta = yield motor.Op(DropboxFile.find_one, self.db,
            {"_id": path}, collection=collection)
        if not file_meta:
            callback((False, {'errcode': ErrCode.not_found}))
            return
        callback((True, file_meta))
