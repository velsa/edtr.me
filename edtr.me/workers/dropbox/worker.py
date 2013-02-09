import urllib
import os.path
from datetime import datetime
import logging
from tornado import gen
from django.utils import simplejson as json
import motor
import pytz

from utils.async_dropbox import DropboxMixin
from models.dropbox import DropboxFile
from utils.error import ErrCode
logger = logging.getLogger('edtr_logger')


# Strange dropbox behaviour:
# File with ANSI (cp1251) encoding, dropbox output as ISO-8859-8 encoding
DROPBOX_ENCODE_MAP = {
    'ISO-8859-8': 'cp1251',
}
DEFAULT_ENCODING = 'utf8'
DELTA_PERIOD_SEC = 5
FILE_CONTENT_PERIOD_SEC = 5
TEXT_MIMES = (
    'text/plain',
    'text/html',
    'application/octet-stream',
)


def dbox_periodic_update():
    # TODO: add dropbox delta check
    print "Syncing with dropbox"


class DropboxWorkerMixin(DropboxMixin):
    @gen.engine
    def wk_dbox_get_tree(self, user, path, recurse=False, callback=None):
        # Update metadata from dropbox to database
        r = yield gen.Task(self._update_delta_from_dropbox, user)
        if r['status'] != ErrCode.ok:
            callback(r)
            return
        if recurse:
            callback({'status': ErrCode.not_implemented})
        else:
            path = self._unify_path(path)
            cursor = self.db[user.name].find({"root_path": path},
                fields=DropboxFile.public_exclude_fields())
            files = yield motor.Op(cursor.to_list, DropboxFile.FIND_LIST_LEN)
            result = {'status': ErrCode.ok, 'tree': files}
            if len(files) == DropboxFile.FIND_LIST_LEN:
                result['has_more'] = True
                logger.debug(u"FIND_LIST_LEN reached for user '{0}',"
                    " path '{1}".format(user.name, path))
            callback(result)

    @gen.engine
    def wk_dbox_get_file(self, user, path, callback=None):
        path = self._unify_path(path)
        for i in range(2):
            # first try to find file_meta in database
            file_meta = yield motor.Op(DropboxFile.find_one, self.db,
                {"_id": path}, collection=user.name)
            if not file_meta:
                if i > 0:
                    # file not found in database and in dropbox
                    callback({'status': ErrCode.not_found})
                    return
                elif not self._delta_called_recently(user):
                    # make sync with dropbox and check again
                    r = yield gen.Task(self._update_delta_from_dropbox, user)
                    if r['status'] != ErrCode.ok:
                        callback({'status': ErrCode.not_found})
                        return
        if file_meta.mime_type in TEXT_MIMES:
            # Not allow to spam api very often
            if self._skip_spam_filemeta(file_meta, callback):
                return
            # make dropbox request
            api_url = self._get_file_url(path, 'files')
            file_meta.last_updated = datetime.now()
            # TODO find a way to call save one time in this func
            yield motor.Op(file_meta.save, self.db, collection=user.name)
            access_token = user.get_dropbox_token()
            response = yield gen.Task(self.dropbox_request,
                "api-content", api_url,
                access_token=access_token)
            if self._check_bad_response(response, callback):
                return
            encoding = self._get_response_encoding(response)
            yield motor.Op(file_meta.save, self.db, collection=user.name)
            callback({
                'status': ErrCode.ok,
                'content': response.body.decode(encoding),
            })
            return
        else:
            url_trans, url_expires = None, None
            # check, if saved media url is already saved and not expired
            expires = file_meta.get_url_expires()
            now = pytz.UTC.localize(datetime.utcnow())
            if file_meta.url_trans and expires and expires > now:
                url_trans = file_meta.url_trans
                url_expires = file_meta.url_expires
            else:
                # make dropbox request
                access_token = user.get_dropbox_token()
                api_url = self._get_file_url(path, 'media')
                post_args = {}
                response = yield gen.Task(self.dropbox_request,
                    "api", api_url,
                    access_token=access_token,
                    post_args=post_args)
                if self._check_bad_response(response, callback):
                    return
                dbox_media_url = json.loads(response.body)
                url_trans = dbox_media_url['url']
                url_expires = dbox_media_url['expires']
                file_meta.url_trans = url_trans
                file_meta.set_url_expires(url_expires)
                yield motor.Op(file_meta.save, self.db, collection=user.name)
            callback({
                'status': ErrCode.ok,
                'url': url_trans,
                'expires': url_expires})

    @gen.engine
    def wk_dbox_save_file(self, user, path, text_content, callback=None):
        file_meta = yield motor.Op(DropboxFile.find_one, self.db,
            {"_id": path}, collection=user.name)
        # Not allow to spam api very often
        # TODO skip calls, when not file_meta is found
        if self._skip_spam_filemeta(file_meta, callback):
            return
        if text_content:
            try:
                text_content = text_content.encode(DEFAULT_ENCODING)
            except UnicodeEncodeError:
                text_content = text_content.encode('ascii', 'replace')
        else:
            text_content = ''
        # make dropbox request
        api_url = self._get_file_url(path, 'files_put')
        access_token = user.get_dropbox_token()
        response = yield gen.Task(self.dropbox_request,
            "api-content", api_url,
            access_token=access_token,
            put_body=text_content,
            overwrite='true')
        if self._check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        # TODO: save meta of all transitional folders
        yield motor.Op(self._save_meta, file_meta, user.name)
        callback({'status': ErrCode.ok})

    @gen.engine
    def wk_dbox_create_dir(self, user, path, callback=None):
        path = self._unify_path(path)
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
        if self._check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        # TODO: save meta of all transitional folders
        yield motor.Op(self._save_meta, file_meta, user.name)
        callback({'status': ErrCode.ok})

    @gen.engine
    def wk_dbox_delete(self, user, path, callback=None):
        path = self._unify_path(path)
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
        if self._check_bad_response(response, callback):
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
        callback({'status': ErrCode.ok})

    @gen.engine
    def wk_dbox_move(self, user, from_path, to_path, callback=None):
        from_path = self._unify_path(from_path)
        to_path = self._unify_path(to_path)
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
        if self._check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        is_dir, new_path = file_meta['is_dir'], file_meta['path']
        if is_dir:
            # TODO: try to avoid full collection scan
            # to include root_path.startswith(new_path) elements
            yield motor.Op(DropboxFile.remove_entries, self.db,
                {"$or": [{"_id": from_path},
                    {"root_path":
                        {'$regex': '^%s.*' % from_path, '$options': 'i'}}]},
                collection=user.name)
        else:
            yield motor.Op(DropboxFile.remove_entries, self.db,
                {"_id": from_path}, collection=user.name)
        # TODO: update meta all transitional folders. For example:
        # move /a to /b, but /a contains several included folders
        # here is saved only meta of /b, and not of included folders in /b
        # maybe just call to /delta, and update from its response
        yield motor.Op(self._save_meta, file_meta, user.name)
        callback({'status': ErrCode.ok})

    @gen.engine
    def wk_dbox_copy(self, user, from_path, to_path, callback=None):
        from_path = self._unify_path(from_path)
        to_path = self._unify_path(to_path)
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
        if self._check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        # TODO: save meta of all included folders, if exists
        yield motor.Op(self._save_meta, file_meta, user.name)
        callback({'status': ErrCode.ok})

    def _unify_path(self, path):
        while len(path) > 1 and path.endswith('/'):
            path = path[:-1]
        if len(path) > 1 and not path.startswith('/'):
            path = '/' + path
        return path

    def _delta_called_recently(self, user):
        if user.last_delta:
            last_delta_time = datetime.now() - user.last_delta
            if last_delta_time.total_seconds() < DELTA_PERIOD_SEC:
                return True
        return False

    @gen.engine
    def _update_delta_from_dropbox(self, user, callback):
        # check, that update_delta is not called very often
        if not self._delta_called_recently(user):
            # Get delta metadata from dropbox
            access_token = user.get_dropbox_token()
            post_args = {}
            if user.dbox_cursor:
                post_args['cursor'] = user.dbox_cursor
            has_more = True
            cursor = None
            while has_more:
                # make dropbox request
                user.last_delta = datetime.now()
                # TODO find a way to call save one time in this func
                yield motor.Op(user.save, self.db)
                response = yield gen.Task(self.dropbox_request,
                    "api", "/1/delta",
                    access_token=access_token,
                    post_args=post_args)
                if self._check_bad_response(response, callback):
                    return
                dbox_delta = json.loads(response.body)
                has_more = dbox_delta['has_more']
                cursor = dbox_delta['cursor']
                if dbox_delta['reset']:
                    logger.debug(
                        "Reseting user all files for '{0}'".format(user.name))
                    yield motor.Op(self.db[user.name].drop)
                for e_path, entry in dbox_delta['entries']:
                    if entry is None:
                        # TODO
                        # maybe there is a way to delete files in one db call
                        yield motor.Op(
                            DropboxFile.remove_entries, self.db,
                            {"_id": e_path}, collection=user.name)
                    else:
                        # TODO
                        # maybe there is a way to save files in one db call
                        yield motor.Op(self._save_meta, entry, user.name, False)
            user.dbox_cursor = cursor
            yield motor.Op(user.save, self.db)
        callback({'status': ErrCode.ok})

    def _get_response_encoding(self, response):
        encoding = 'ascii'
        cont_type = response.headers.get('Content-Type', None)
        if cont_type:
            for v in cont_type.split(';'):
                if 'charset=' in v:
                    encoding = v.split('=', 1)[-1]
                    encoding = DROPBOX_ENCODE_MAP.get(encoding, encoding)
                    break
        return encoding

    def _check_bad_response(self, response, callback=None):
        if response.code != 200:
            error = 'undefined'
            if 'error' in response.body:
                error = json.loads(response.body)['error']
            result = {
                "status": ErrCode.bad_request,
                'http_code': response.code,
                'error': error,
            }
            if callback:
                callback(result)
            return result
        return None

    def _get_file_url(self, path, api_url):
        path = self._unify_path(path)
        return "/1/{api_url}/{{root}}{path}".format(
            api_url=api_url,
            path=urllib.quote(path.encode('utf8')))

    def _skip_spam_filemeta(self, file_meta, callback):
        if file_meta and file_meta.last_updated:
            time_left = datetime.now() - file_meta.last_updated
            if time_left.total_seconds() < FILE_CONTENT_PERIOD_SEC:
                callback({
                    'status': ErrCode.called_too_often})
                return True
        return False

    @gen.engine
    def _save_meta(self, meta_data, colln, update=True,
      callback=None):
        meta_data['_id'] = meta_data.pop('path')
        meta_data['root_path'] = os.path.dirname(meta_data['_id'])
        if update:
            meta_data['last_updated'] = datetime.now()
        self.db[colln].save(meta_data, callback=callback)
