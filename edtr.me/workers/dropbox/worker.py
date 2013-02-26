import urllib
import os.path
from datetime import datetime
import logging
from tornado import gen
from django.utils import simplejson as json
import motor
import pytz
from schematics.serialize import make_safe_python, to_python

from utils.async_dropbox import DropboxMixin
from models.dropbox import DropboxFile, PS
from models.accounts import UserModel
from utils.gl import DB, SocketPool
from utils.error import ErrCode
from utils.main import get_publish_root, get_preview_root, parse_md_headers
logger = logging.getLogger('edtr_logger')


# Strange dropbox behaviour:
# File with ANSI (cp1251) encoding, dropbox output as ISO-8859-8 encoding
DROPBOX_ENCODE_MAP = {
    'ISO-8859-8': 'cp1251',
}
DEFAULT_ENCODING = 'utf8'
DELTA_PERIOD_SEC = 5
F_CONT_PER_SEC = 5

MIME_MD = 'application/octet-stream'
TEXT_MIMES = (
    'text/plain',
    'text/html',
    MIME_MD,
)
MAND_MD_HEADERS = ['state', ]


class MdState:
    draft = 'draft'
    published = 'published'


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
        error, descr = 'undefined', 'undefined'
        if hasattr(response, 'error'):
            error = response.error
        if response.body:
            descr = response.body
        result = {
            "status": ErrCode.bad_request,
            'http_code': response.code,
            'error': error,
            'description': descr,

        }
        logger.error(result)
        if callback:
            callback(result)
        return result
    return None


@gen.engine
def _update_meta(db, meta_data, colln, update=True, callback=None):
    meta = dict(meta_data)
    _id = meta.pop('path')
    meta['root_path'] = os.path.dirname(_id)
    if update:
        meta['last_updated'] = datetime.now()
    r = yield motor.Op(db[colln].update, {"_id": _id}, {"$set": meta})
    meta['_id'] = _id
    if not r['updatedExisting']:
        yield motor.Op(db[colln].save, meta)
    callback(meta)


def has_dbox_access(user):
    access = user.dbox_access_token
    return bool(access)


def transform_updates(entries):
    return entries


def _unify_path(path):
    while len(path) > 1 and path.endswith('/'):
        path = path[:-1]
    if len(path) > 1 and not path.startswith('/'):
        path = '/' + path
    return path


def _get_file_url(path, api_url):
    path = _unify_path(path)
    return "/1/{api_url}/{{root}}{path}".format(
        api_url=api_url,
        path=urllib.quote(path.encode('utf8')))


@gen.engine
def _get_tree_from_db(path, user, db, recurse=False, callback=None):
    if recurse:
        callback({'status': ErrCode.not_implemented})
    else:
        path = _unify_path(path)
        cursor = db[user.name].find({"root_path": path},
            fields=DropboxFile.public_exclude_fields())
        files = yield motor.Op(cursor.to_list, DropboxFile.FIND_LIST_LEN)
        result = {'status': ErrCode.ok, 'tree': files}
        if len(files) == DropboxFile.FIND_LIST_LEN:
            result['has_more'] = True
            logger.debug(u"FIND_LIST_LEN reached for user '{0}',"
                " path '{1}".format(user.name, path))
        callback(result)


def _get_response_encoding(response):
    encoding = 'ascii'
    cont_type = response.headers.get('Content-Type', None)
    if cont_type:
        for v in cont_type.split(';'):
            if 'charset=' in v:
                encoding = v.split('=', 1)[-1]
                encoding = DROPBOX_ENCODE_MAP.get(encoding, encoding)
                break
    return encoding


@gen.engine
def _get_obj_content(file_meta, user, db, async_dbox, for_publish=False,
                                                     rev=None, callback=None):
    path = file_meta._id
    if file_meta.is_dir:
        r = yield gen.Task(_get_tree_from_db, path, user, db)
        callback(r)
    elif file_meta.mime_type in TEXT_MIMES or for_publish:
        # make dropbox request
        api_url = _get_file_url(path, 'files')
        access_token = user.get_dropbox_token()
        if rev:
            response = yield gen.Task(async_dbox.dropbox_request,
                "api-content", api_url,
                access_token=access_token,
                rev=rev)
        else:
            response = yield gen.Task(async_dbox.dropbox_request,
                "api-content", api_url,
                access_token=access_token)
        if _check_bad_response(response, callback):
            return
        if for_publish:
            meta_ser = to_python(file_meta)
        else:
            # Skip black list fields
            meta_ser = make_safe_python(DropboxFile, file_meta, 'public')
        if not rev:
            meta_dbox = json.loads(response.headers['X-Dropbox-Metadata'])
            # TODO when called from publish, _update_meta can be done later
            meta_dict = yield gen.Task(_update_meta, db, meta_dbox, user.name)
            # update fields, that will be return to client
            if for_publish:
                # meta_ser = to_python(file_meta)
                meta_ser.update(meta_dict)
            else:
                # Skip black list fields
                # meta_ser = make_safe_python(DropboxFile, file_meta, 'public')
                for f in meta_dict:
                    if f in meta_ser:
                        meta_ser[f] = meta_dict[f]
        if file_meta.mime_type in TEXT_MIMES:
            encoding = _get_response_encoding(response)
            callback({
                'status': ErrCode.ok,
                # TODO check file magic number to find encoding
                'encoding': encoding,
                'content': response.body.decode(encoding, 'replace'),
                'meta': meta_ser,
            })
        else:
            # TODO: check file size and reject, if it big.
            # TODO: maybe use chunk download like this:
            # http://codingrelic.geekhold.com/2011/10/tornado-httpclient-chunked-downloads.html
            callback({
                'status': ErrCode.ok,
                'body': response.body,
                'meta': meta_ser,
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
            api_url = _get_file_url(path, 'media')
            post_args = {}
            response = yield gen.Task(async_dbox.dropbox_request,
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
            yield motor.Op(file_meta.update, db, collection=user.name)
        callback({
            'status': ErrCode.ok,
            'url': url_trans,
            'expires': url_expires})


def _create_path_if_not_exist(path_file):
    f_dir = os.path.dirname(path_file)
    if not os.path.exists(f_dir):
        os.makedirs(f_dir)


@gen.engine
def _publish_text(fm, user, preview, pub_paths, file_content, db, callback):
    if not preview and fm.pub_status == PS.published:
        logger.debug(u"{0} is already published".format(fm._id))
        callback({"status": ErrCode.already_published})
        return
    for pp in pub_paths:
        path_file = os.path.join(pp, fm._id.lstrip('/'))
        _create_path_if_not_exist(path_file)
        with open(path_file, 'wb') as f:
            f.write(file_content.encode(DEFAULT_ENCODING))
    if preview:
        if not (fm.pub_status == PS.published and fm.rev == fm.pub_rev):
            fm.pub_status = PS.draft
    else:
        fm.pub_status = PS.published
        fm.pub_rev = fm.rev
    yield motor.Op(fm.update, db, collection=user.name)
    callback({
        "status": ErrCode.ok,
        "mime_type": "text",
        "meta": make_safe_python(DropboxFile, fm, 'public')})


@gen.engine
def _publish_binary(fm, user, preview, pub_paths, body, db, callback):
    if not preview and fm.pub_status == PS.published:
        logger.debug(u"{0} is already published".format(fm._id))
        callback({"status": ErrCode.already_published})
        return
    for pp in pub_paths:
        path_file = os.path.join(pp, fm._id.lstrip('/'))
        _create_path_if_not_exist(path_file)
        with open(path_file, 'wb') as f:
            f.write(body)
    if preview:
        if not (fm.pub_status == PS.published or fm.rev == fm.pub_rev):
            fm.pub_status = PS.draft
    else:
        fm.pub_status = PS.published
        fm.pub_rev = fm.rev
    yield motor.Op(fm.update, db, collection=user.name)
    callback({
        "status": ErrCode.ok,
        "mime_type": "bin",
        "meta": make_safe_python(DropboxFile, fm, 'public')})


@gen.engine
def _publish_object(file_meta, user, db, async_dbox, preview=False,
                                                     obj=None, callback=None):
    logger.debug(u"Publishing object. Path: {0}, user: {1}".format(
        file_meta.path, user.name))
    if not obj:
        obj = yield gen.Task(_get_obj_content,
            file_meta, user, db, async_dbox, for_publish=True)
    if obj['status'] == ErrCode.ok:
        pub_paths = [get_preview_root(user.name)]
        if not preview:
            pub_paths.append(get_publish_root(user.name))
        if 'content' in obj:
            # Text content
            r = yield gen.Task(_publish_text, DropboxFile(**obj['meta']),
                user, preview, pub_paths, obj['content'], db)
            callback(r)
        else:
            # Non text content. Save from given url.
            r = yield gen.Task(_publish_binary, DropboxFile(**obj['meta']),
                user, preview, pub_paths, obj['body'], db)
            callback(r)
    else:
        callback(obj)


def _is_md(file_meta):
    return file_meta.mime_type == MIME_MD and file_meta.path.endswith('.md')


@gen.engine
def _dbox_process_publish(updates, user, db, async_dbox, callback):
    errors = []
    for meta in updates.values():
        if meta:
            # process updated file
            if _is_md(meta):
                # md file
                md_obj = yield gen.Task(_get_obj_content,
                    meta, user, db, async_dbox, for_publish=True, rev=meta.rev)
                if md_obj['status'] == ErrCode.ok:
                    headers = parse_md_headers(md_obj['content'])
                    missed_headers = [
                        h for h in MAND_MD_HEADERS if h not in headers]
                    if not headers:
                        errors.append(
                            {"description": u"headers not found for {0}".format(
                                meta.path)})
                    elif missed_headers:
                        errors.append(
                            {"description": u"missed headers for {0}".format(
                                meta.path)})
                    else:
                        preview = None
                        if MdState.draft in headers['state']:
                            preview = True
                        elif MdState.published in headers['state']:
                            preview = False
                        if preview is not None:
                            result = yield gen.Task(_publish_object, meta,
                                user, db, async_dbox, preview=preview, obj=md_obj)
                            if not result['status'] == ErrCode.ok:
                                errors.append(result)
                            else:
                                # update fields in meta
                                for f in result['meta']:
                                    if hasattr(meta, f):
                                        setattr(meta, f, result['meta'][f])
                        elif meta.pub_status != PS.dbox:
                            # TODO md file was published or preview
                            # and now it has state regular
                            # remove it from publish and preview
                            errors.append({"description":
                                u"Removing from pub state not implemented ({0})"\
                                .foramt(meta.path)})
                else:
                    errors.append(md_obj)
            else:
                # non md file
                if meta.pub_status in (PS.draft, PS.published):
                    result = yield gen.Task(_publish_object, meta,
                        user, db, async_dbox, preview=True)
                    if not result['status'] == ErrCode.ok:
                        errors.append(result)
        else:
            # process deleted file
            print "Processing DELETED file", meta.path
            pass
    if errors:
        logger.error(u"_dbox_process_publish errors: {0}".format(
            errors))
        callback({"status": ErrCode.unknown_error, "errors": errors})
    else:
        callback({"status": ErrCode.ok})


@gen.engine
def _update_dbox_delta(db, async_dbox, user, reg_update=False,
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
        updates = {}
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
                # TODO: find a way not call db on every file
                dfile = yield motor.Op(DropboxFile.find_one,
                    db, {"_id": e_path}, user.name)
                if entry is None:
                    if not dfile:
                        # TODO
                        # maybe there is a way to delete files in one db call
                        updates[e_path] = None
                        yield motor.Op(
                            DropboxFile.remove_entries, db,
                            {"_id": e_path}, collection=user.name)
                else:
                    # TODO
                    # maybe there is a way to save files in one db call
                    meta = yield gen.Task(_update_meta,
                        db, entry, user.name, False)
                    if not dfile:
                        updates[e_path] = DropboxFile(**meta)
                    elif dfile['modified'] != entry['modified']:
                        for f in entry:
                            if hasattr(dfile, f) and f != 'path':
                                setattr(dfile, f, entry[f])
                        updates[e_path] = dfile
        user.dbox_cursor = cursor
        yield motor.Op(user.save, db)
    else:
        logger.debug("Delta called recently")
    if callback:
        ret_val = {'status': ErrCode.ok}
        if reg_update:
            ret_val['updates'] = updates
        else:
            pub_rst = yield gen.Task(_dbox_process_publish,
                updates, user, db, async_dbox)
            if pub_rst['status'] != ErrCode.ok:
                # TODO process errors
                pass
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
        rst = yield gen.Task(_update_dbox_delta,
            db, async_dbox, user, reg_update=True)
        if rst['status'] != ErrCode.ok:
            logger.warning(u"Dropbox periodic update for user {0}"
                "ended with status = {1}".format(user.name, rst['status']))
        elif 'updates' in rst and rst['updates']:
            updates = rst['updates']
            pub_rst = yield gen.Task(_dbox_process_publish,
                updates, user, db, async_dbox)
            if pub_rst['status'] != ErrCode.ok:
                # TODO process errors
                pass
            # TODO notify user, that reg_publish failed.
            # For exmaple, it can be due to bad md headers
            skt_opened = SocketPool.is_socket_opened(user.name)
            if skt_opened:
                logger.debug(u"Sending updates to socket. "
                    "User: {0}, updates: {1}".format(
                        user.name, rst['updates']))
                for p in rst['updates']:
                    rst['updates'][p] = make_safe_python(
                        DropboxFile, rst['updates'][p], 'public')
                SocketPool.notify_dbox_update(user.name, rst)
            else:
                logger.debug(u"Updates found, but socket is closed. "
                    "User: {0}, updates: {1}".format(
                        user.name, rst['updates']))
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
        result = yield gen.Task(
            _get_tree_from_db, path, user, self.db, recurse)
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
                elif not _delta_called_recently(user):
                    # make sync with dropbox and check again
                    r = yield gen.Task(
                        _update_dbox_delta, self.db, self, user)
                    if r['status'] != ErrCode.ok:
                        callback({'status': ErrCode.not_found})
                        return
            else:
                # Not allow to spam api very often
                if self._skip_spam_filemeta(file_meta, callback):
                    return
        if file_meta.mime_type in TEXT_MIMES:
            # make dropbox request
            api_url = self._get_file_url(path, 'files')
            file_meta.last_updated = datetime.now()
            # TODO find a way to call save one time in this func
            yield motor.Op(file_meta.save, self.db, collection=user.name)
            access_token = user.get_dropbox_token()
            response = yield gen.Task(self.dropbox_request,
                "api-content", api_url,
                access_token=access_token)
            if _check_bad_response(response, callback):
                return
            encoding = self._get_response_encoding(response)
            yield motor.Op(file_meta.save, self.db, collection=user.name)
            callback({
                'status': ErrCode.ok,
                # TODO check file magic number to find encoding
                'content': response.body.decode(encoding, 'replace'),
            })
            return
        file_meta = data
        result = yield gen.Task(_get_obj_content,
            file_meta, user, self.db, self)
        callback(result)

    @gen.engine
    def wk_dbox_save_file(self, user, path, text_content, callback=None):
        # TODO: not allow call this api very often
        path = _unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            callback(data)
            return
        if text_content:
            try:
                text_content = text_content.encode(DEFAULT_ENCODING)
            except UnicodeEncodeError:
                text_content = text_content.encode('ascii', 'replace')
        else:
            text_content = ''
        # make dropbox request
        api_url = _get_file_url(path, 'files_put')
        access_token = user.get_dropbox_token()
        response = yield gen.Task(self.dropbox_request,
            "api-content", api_url,
            access_token=access_token,
            put_body=text_content,
            overwrite='true')
        if _check_bad_response(response, callback):
            return
        dbox_meta = json.loads(response.body)
        # TODO: save meta of all transitional folders, but maybe let it be
        # just not allow user in UI to create /a/b/f.txt, if /a not exists
        yield gen.Task(_update_meta, self.db, dbox_meta, user.name)
        file_meta = data
        for f in dbox_meta:
            setattr(file_meta, f, dbox_meta[f])
        if file_meta.pub_status not in (PS.dbox, ):
            result = yield gen.Task(_publish_object,
                file_meta, user, self.db, self, preview=True)
            callback(result)
        else:
            callback({'status': ErrCode.ok, 'meta': file_meta})

    @gen.engine
    def wk_dbox_create_dir(self, user, path, callback=None):
        path = _unify_path(path)
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
        yield gen.Task(_update_meta, self.db, file_meta, user.name)
        callback({'status': ErrCode.ok})

    @gen.engine
    def wk_dbox_delete(self, user, path, callback=None):
        path = _unify_path(path)
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
        from_path = _unify_path(from_path)
        to_path = _unify_path(to_path)
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
        yield gen.Task(_update_meta, self.db, file_meta, user.name)
        # TODO: is it save to leave now, not to wait for delta result ?
        _update_dbox_delta(self.db, self, user, force_update=True)
        callback({'status': ErrCode.ok})

    @gen.engine
    def wk_dbox_copy(self, user, from_path, to_path, callback=None):
        from_path = _unify_path(from_path)
        to_path = _unify_path(to_path)
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
        yield gen.Task(_update_meta, self.db, file_meta, user.name)
        # TODO: is it save to leave now, not to wait for delta result ?
        _update_dbox_delta(self.db, self, user, force_update=True)
        callback({'status': ErrCode.ok})

    @gen.engine
    def wk_dbox_publish(self, user, path, recurse=False, callback=None):
        path = _unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            callback(data)
            return
        file_meta = data
        if file_meta.is_dir or recurse:
            callback({"status": ErrCode.not_implemented})
        if file_meta.pub_status == PS.published:
            callback({"status": ErrCode.already_published})
            return

        result = yield gen.Task(_publish_object, file_meta, user, self.db, self)
        callback(result)

    @gen.engine
    def wk_dbox_preview(self, user, path, recurse=False, callback=None):
        path = _unify_path(path)
        success, data = yield gen.Task(self._get_filemeta, path, user.name)
        if not success:
            callback(data)
            return
        file_meta = data
        if file_meta.is_dir or recurse:
            callback({"status": ErrCode.not_implemented})

        result = yield gen.Task(self._publish_object,
            file_meta, user, self.db, self, preview=True)
        callback(result)

    @gen.engine
    def _get_filemeta(self, path, collection, callback):
        file_meta = yield motor.Op(DropboxFile.find_one, self.db,
            {"_id": path}, collection=collection)
        if not file_meta:
            callback((False, {'status': ErrCode.not_found}))
            return
        callback((True, file_meta))
