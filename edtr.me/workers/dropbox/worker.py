import os.path
import logging
from tornado import gen
from django.utils import simplejson as json
import motor
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
            logger.debug("Fetched {0} entries".format(len(dbox_delta['entries'])))
            logger.debug(dbox_delta)
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
                    if encoding in DROPBOX_ENCODE_MAP:
                        encoding = DROPBOX_ENCODE_MAP[encoding]
                    break
        return encoding

    @gen.engine
    def dbox_get_file(self, user, path, callback=None):
        access_token = user.get_dropbox_token()
        file_meta = yield motor.Op(
            DropboxFile.find_one, self.db, {"_id": path}, collection=user.name)
        # TODO
        # check, if no file_meta found
        # check for updates in dropbox
        status = ErrCode.ok
        file_content = None
        if file_meta.is_dir:
            status = ErrCode.file_is_dir
        # TODO
        # check file_meta.mime_type
        elif file_meta.thumb_exists:
            # TODO
            # probably image
            status = ErrCode.file_is_image
        else:
            path = self.remove_odd_slash(path)
            api_url = "/1/files/{{root}}{path}".format(path=path)
            response = yield gen.Task(self.dropbox_request,
                "api-content", api_url,
                access_token=access_token
            )
            if response.code == 404:
                status = ErrCode.not_found
            else:
                encoding = self._get_response_encoding(response)
                file_content = response.body.decode(encoding)
        callback({'status': status, 'content': file_content})
