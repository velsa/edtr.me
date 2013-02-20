import urllib
import os.path
from datetime import datetime
import logging
from tornado import gen
from django.utils import simplejson as json
import motor
import pytz

from utils.async_dropbox import DropboxMixin
from models.dropbox import DropboxFile, PS
from models.accounts import UserModel
from utils.gl import DB, SocketPool
from utils.error import ErrCode
from utils.main import get_publish_root, get_preview_root
logger = logging.getLogger('edtr_logger')


# Strange dropbox behaviour:
# File with ANSI (cp1251) encoding, dropbox output as ISO-8859-8 encoding
DROPBOX_ENCODE_MAP = {
    'ISO-8859-8': 'cp1251',
}
DEFAULT_ENCODING = 'utf8'
DELTA_PERIOD_SEC = 20
F_CONT_PER_SEC = 5
TEXT_MIMES = (
    'text/plain',
    'text/html',
    'application/octet-stream',
)


def dbox_periodic_update():
    # TODO: fetch only needed fields
    cursor = DB.instance().accounts.find(
        {'dbox_access_token': {'$exists': True}})
    cursor.each(callback=_dbox_sync_user)


def _delta_called_recently(user):
    # TODO store last_delta in cache (memcached, redis)
    # to minimize time between check and save last_delta
    last_delta = user.last_delta
    if last_delta:
        last_delta_time = datetime.now() - last_delta
        if last_delta_time.total_seconds() < DELTA_PERIOD_SEC:
            return True
    return False


def _check_bad_response(response, callback=None):
    if response.code != 200:
        error = 'undefined'
        if 'error' in response.body:
            error = json.loads(response.body)['error']
        result = {
            "status": ErrCode.bad_request,
            'http_code': response.code,
            'error': error,
        }
        logger.error(result)
        if callback:
            callback(result)
        return result
    return None


@gen.engine
def _save_meta(db, meta_data, colln, update=True, callback=None):
    meta_data['_id'] = meta_data.pop('path')
    meta_data['root_path'] = os.path.dirname(meta_data['_id'])
    if update:
        meta_data['last_updated'] = datetime.now()
    db[colln].save(meta_data, callback=callback)


def has_dbox_access(user):
    access = user.dbox_access_token
    return bool(access)


def transform_updates(entries):
    return entries


@gen.engine
def _update_dbox_delta(db, async_dbox, user, attach_new=False,
                                           force_update=False, callback=None):
    # TODO: don't make any actions
    # if previous call of this method is not finished for current user
    updates = None
    # check, that update_delta is not called very often
    if force_update or not _delta_called_recently(user):
        # Get delta metadata from dropbox
        access_token = user.get_dropbox_token()
        post_args = {}
        if user.dbox_cursor:
            post_args['cursor'] = user.dbox_cursor
        has_more = True
        cursor = None
        known_changed_paths = []
        while has_more:
            # make dropbox request
            user.last_delta = datetime.now()
            # TODO find a way to call save one time in this func
            yield motor.Op(user.save, db)
            response = yield gen.Task(async_dbox.dropbox_request,
                "api", "/1/delta",
                access_token=access_token,
                post_args=post_args)
            if _check_bad_response(response, callback):
                return
            dbox_delta = json.loads(response.body)
            has_more = dbox_delta['has_more']
            cursor = dbox_delta['cursor']
            if dbox_delta['reset']:
                logger.debug(
                    u"Reseting user all files for '{0}'".format(user.name))
                yield motor.Op(db[user.name].drop)
            for i, (e_path, entry) in enumerate(dbox_delta['entries']):
                if attach_new:
                    # TODO: find a way not call db on every file
                    dfile = yield motor.Op(DropboxFile.find_one,
                        db, {"_id": e_path}, user.name, False)
                if entry is None:
                    if attach_new and not dfile:
                        known_changed_paths.append(i)
                    else:
                        # TODO
                        # maybe there is a way to delete files in one db call
                        yield motor.Op(
                            DropboxFile.remove_entries, db,
                            {"_id": e_path}, collection=user.name)
                else:
                    if attach_new and dfile:
                        if dfile['modified'] == entry['modified']:
                            known_changed_paths.append(i)
                    # TODO
                    # maybe there is a way to save files in one db call
                    yield motor.Op(_save_meta, db, entry, user.name, False)
            if attach_new and dbox_delta['entries']:
                # assert 'known_changed_paths' indexes are in ascending order
                for offset, index in enumerate(known_changed_paths):
                    index -= offset
                    del dbox_delta['entries'][index]
                updates = transform_updates(dbox_delta['entries'])
        user.dbox_cursor = cursor
        yield motor.Op(user.save, db)
    else:
        logger.debug("Delta called recently")
    if callback:
        ret_val = {'status': ErrCode.ok}
        if attach_new:
            ret_val['updates'] = updates
        callback(ret_val)


@gen.engine
def _dbox_sync_user(user, error):
    if error:
        try:
            raise error
        except:
            logger.exception("_dbox_sync_user error:")
    elif user:
        user = UserModel(**user)
        async_dbox = DropboxMixin()
        db = DB.instance()
        skt_opened = SocketPool.is_socket_opened(user.name)
        rst = yield gen.Task(
            _update_dbox_delta, db, async_dbox, user, skt_opened)
        if rst['status'] != ErrCode.ok:
            logger.warning(u"Dropbox periodic update for user {0}"
                "ended with status = {1}".format(user.name, rst['status']))
        elif skt_opened:
            if 'updates' in rst and rst['updates']:
                SocketPool.notify_dbox_update(user.name, rst)
    else:
        logger.error("_dbox_sync_user user not found")


class DropboxWorkerMixin(DropboxMixin):
    @gen.engine
    def wk_dbox_get_tree(self, user, path, recurse=False, callback=None):
        # Update metadata from dropbox to database
        r = yield gen.Task(_update_dbox_delta, self.db, self, user)
        if r['status'] != ErrCode.ok:
            callback(r)
            return
        result = yield gen.Task(self._get_tree_from_db, path, user, recurse)
        callback(result)

    @gen.engine
    def wk_dbox_get_file(self, user, path, callback=None):
        # TODO: not allow call this api very often
        path = self._unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            callback(data)
            return
        file_meta = data
        result = yield gen.Task(self._get_obj_content, file_meta, user)
        callback(result)

    @gen.engine
    def wk_dbox_save_file(self, user, path, text_content, callback=None):
        # TODO: not allow call this api very often
        path = self._unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            callback(data)
            return
        file_meta = data
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
        if _check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        # TODO: save meta of all transitional folders, but maybe let it be
        # just not allow user in UI to create /a/b/f.txt, if /a not exists
        yield motor.Op(_save_meta, self.db, file_meta, user.name)
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
        if _check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        # TODO: save meta of all transitional folders, but maybe let it be
        # just not allow  user in UI to create /a/b/, if /a not exists
        yield motor.Op(_save_meta, self.db, file_meta, user.name)
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
        if _check_bad_response(response, callback):
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
        if _check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        yield motor.Op(_save_meta, self.db, file_meta, user.name)
        # TODO: is it save to leave now, not to wait for delta result ?
        _update_dbox_delta(self.db, self, user, force_update=True)
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
        if _check_bad_response(response, callback):
            return
        file_meta = json.loads(response.body)
        yield motor.Op(_save_meta, self.db, file_meta, user.name)
        # TODO: is it save to leave now, not to wait for delta result ?
        _update_dbox_delta(self.db, self, user, force_update=True)
        callback({'status': ErrCode.ok})

    @gen.engine
    def wk_dbox_publish(self, user, path, recurse=False, callback=None):
        path = self._unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            callback(data)
            return
        file_meta = data
        if file_meta.pub_status == PS.published and not recurse:
            callback({"status": ErrCode.already_published})
            return
        pub_root = get_publish_root(user.name)
        path = path.lstrip('/')
        path_file = os.path.join(pub_root, path)
        if file_meta.is_dir:
            path_dir = path_file
        else:
            path_dir = os.path.dirname(path_file)
        if not os.path.exists(path_dir):
            os.makedirs(path_dir)

        result = yield gen.Task(
            self._publish_object, file_meta, user, pub_root, recurse)
        callback(result)

    def _unify_path(self, path):
        while len(path) > 1 and path.endswith('/'):
            path = path[:-1]
        if len(path) > 1 and not path.startswith('/'):
            path = '/' + path
        return path

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

    def _get_file_url(self, path, api_url):
        path = self._unify_path(path)
        return "/1/{api_url}/{{root}}{path}".format(
            api_url=api_url,
            path=urllib.quote(path.encode('utf8')))

    @gen.engine
    def _get_filemeta(self, path, collection, callback):
        file_meta = yield motor.Op(DropboxFile.find_one, self.db,
            {"_id": path}, collection=collection)
        if not file_meta:
            callback((False, {'status': ErrCode.not_found}))
            return
        callback((True, file_meta))

    @gen.engine
    def _get_obj_content(self, file_meta, user, download_bin=False, callback=None):
        path = file_meta._id
        if file_meta.is_dir:
            r = yield gen.Task(self._get_tree_from_db, path, user)
            callback(r)
        elif file_meta.mime_type in TEXT_MIMES or download_bin:
            # make dropbox request
            api_url = self._get_file_url(path, 'files')
            access_token = user.get_dropbox_token()
            response = yield gen.Task(self.dropbox_request,
                "api-content", api_url,
                access_token=access_token)
            if _check_bad_response(response, callback):
                return
            if download_bin:
                # TODO: check file size and reject, if it big.
                # TODO: maybe use chunk download like this:
                # http://codingrelic.geekhold.com/2011/10/tornado-httpclient-chunked-downloads.html
                callback({'status': ErrCode.ok, 'body': response.body})
            else:
                encoding = self._get_response_encoding(response)
                callback({
                    'status': ErrCode.ok,
                    # TODO check file magic number to find encoding
                    'encoding': encoding,
                    'content': response.body.decode(encoding, 'replace'),
                })
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
                if _check_bad_response(response, callback):
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
    def _get_tree_from_db(self, path, user, recurse=False, callback=None):
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

    def _create_path_if_not_exist(self, path_file):
        f_dir = os.path.dirname(path_file)
        if not os.path.exists(f_dir):
            os.makedirs(f_dir)

    @gen.engine
    def _publish_text(self, file_meta, user, pub_root, file_content, callback):
        if file_meta.pub_status == PS.published:
            logger.debug(u"{0} is already published".format(file_meta._id))
            callback({"status": ErrCode.already_published})
            return
        path_file = os.path.join(pub_root, file_meta._id.lstrip('/'))
        self._create_path_if_not_exist(path_file)
        with open(path_file, 'wb') as f:
            f.write(file_content.encode(DEFAULT_ENCODING))
        file_meta.pub_status = PS.published
        file_meta.pub_revision = file_meta.revision
        yield motor.Op(file_meta.save, self.db, collection=user.name)
        callback({"status": ErrCode.ok, "mime_type": "text"})

    @gen.engine
    def _publish_binary(self, file_meta, user, pub_root, body, callback):
        if file_meta.pub_status == PS.published:
            logger.debug(u"{0} is already published".format(file_meta._id))
            callback({"status": ErrCode.already_published})
            return
        path_file = os.path.join(pub_root, file_meta._id.lstrip('/'))
        self._create_path_if_not_exist(path_file)
        with open(path_file, 'wb') as out:
            out.write(body)
        file_meta.pub_status = PS.published
        file_meta.pub_revision = file_meta.revision
        yield motor.Op(file_meta.save, self.db, collection=user.name)
        callback({"status": ErrCode.ok, "mime_type": "bin"})

    @gen.engine
    def _publish_dir(self, file_meta, user, obj, pub_root, recurse, callback):
        # TODO: find a way to save all file_meta in one db call
        file_meta.pub_status = PS.published
        file_meta.pub_revision = file_meta.revision
        yield motor.Op(file_meta.save, self.db, collection=user.name)
        for fm in obj['tree']:
            r = yield gen.Task(self._publish_object,
                DropboxFile(**fm), user, pub_root, recurse, False)
            if r['status'] not in (ErrCode.ok, ErrCode.already_published):
                callback(r)
                return
        callback({"status": ErrCode.ok, "mime_type": "dir"})

    @gen.engine
    def _publish_object(self, file_meta, user, pub_root, recurse=False,
                                               first_call=True, callback=None):
        if not first_call and file_meta.is_dir and not recurse:
            logger.debug(
                u"_publish_object Skipping dir {0}, because not recurse"\
                .format(file_meta._id))
            callback({"status": ErrCode.ok})
            return
        if file_meta.pub_status == PS.published and not file_meta.is_dir:
            callback({"status": ErrCode.already_published})
            return
        obj = yield gen.Task(
            self._get_obj_content, file_meta, user, download_bin=True)
        if obj['status'] == ErrCode.ok:
            # obj_path = os.path.join(pub_root, file_meta._id.lstrip('/'))
            if 'content' in obj:
                # Text content
                r = yield gen.Task(self._publish_text,
                    file_meta, user, pub_root, obj['content'])
                callback(r)
            elif 'tree' in obj:
                # Dir
                r = yield gen.Task(self._publish_dir,
                    file_meta, user, obj, pub_root, recurse)
                callback(r)
            else:
                # Non text content. Save from given url.
                r = yield gen.Task(self._publish_binary,
                    file_meta, user, pub_root, obj['body'])
                callback(r)
        else:
            callback(obj)
