import os.path
import logging
from tornado import gen
from django.utils import simplejson as json
import motor
from utils.async_dropbox import DropboxMixin
from models.dropbox import DropboxFile
logger = logging.getLogger('edtr_logger')


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
                logging.debug(
                    "Reseting user all files for '{0}'".format(user.username))
                yield motor.Op(self.db[user.username].drop)
            logging.debug("Fetched {0} entries".format(len(dbox_delta['entries'])))
            for path, entry in dbox_delta['entries']:
                entry['_id'] = entry.pop('path')
                entry['root_path'] = os.path.dirname(entry['_id'])
                db_file = DropboxFile(**entry)
                yield motor.Op(db_file.save, self.db, user.username)

        user.dbox_cursor = cursor
        yield motor.Op(user.save, self.db)
        if recurse:
            callback('stub')
        else:
            cursor = self.db[user.username].find({"root_path": path})
            files = yield motor.Op(cursor.to_list)
            callback(files)
