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


class DropboxWorkerMixin(DropboxMixin):
    def remove_odd_slash(self, path):
        while len(path) > 1 and path.endswith('/'):
            path = path[:-1]
        return path

    @gen.engine
    def dbox_get_tree(self, user, path, recurse=False, callback=None):
        access_token = user.get_dropbox_token()
        post_args = {}
        if user.dbox_cursor:
            post_args['cursor'] = user.dbox_cursor
        path = self.remove_odd_slash(path)
        status = ErrCode.ok
        has_more = True
        cursor = None
        while has_more:
            response = yield gen.Task(self.dropbox_request,
                "api", "/1/delta",
                access_token=access_token,
                post_args=post_args)
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
                        DropboxFile.remove_entries, self.db, {"_id": e_path},
                        collection=user.name)
                else:
                    entry['_id'] = entry.pop('path')
                    entry['root_path'] = os.path.dirname(entry['_id'])
                    # TODO
                    # skip create DropboxFile instance, it is odd
                    db_file = DropboxFile(**entry)
                    # TODO
                    # maybe there is a way to save files in one db call
                    yield motor.Op(db_file.save, self.db, collection=user.name)

        user.dbox_cursor = cursor
        yield motor.Op(user.save, self.db)
        if recurse:
            callback({'status': ErrCode.not_implemented})
        else:
            cursor = self.db[user.name].find({"root_path": path})
            files = yield motor.Op(cursor.to_list)
            callback({'status': status, 'files': files})

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

    @gen.engine
    def dbox_get_file(self, user, path, callback=None):
        access_token = user.get_dropbox_token()
        file_meta = yield motor.Op(
            DropboxFile.find_one, self.db, {"_id": path}, collection=user.name)
        url_trans, url_expires = None, None
        if not file_meta:
            # TODO make sync with dropbox and check again
            callback({'status': ErrCode.not_found})
            return
        # check, if saved media url is already saved and not expired
        expires = file_meta.get_url_expires()
        now = pytz.UTC.localize(datetime.utcnow())
        if file_meta.url_trans and expires and expires > now:
            url_trans = file_meta.url_trans
            url_expires = file_meta.url_expires
        else:
            # make dropbox request
            api_url = "/1/media/{{root}}{path}".format(path=path)
            post_args = {}
            response = yield gen.Task(self.dropbox_request,
                "api", api_url,
                access_token=access_token,
                post_args=post_args)
            if response.code != 200:
                error = 'undefined'
                if 'error' in response.body:
                    error = json.loads(response.body)['error']
                callback({
                    "status": ErrCode.bad_request,
                    'http_code': response.code,
                    'error': error,
                })
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
