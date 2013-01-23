import logging
from tornado import gen
from django.utils import simplejson as json
import motor
from utils.async_dropbox import DropboxMixin
from models.dropbox import DropboxFile
logger = logging.getLogger('edtr_logger')


class DropboxWorkerMixin(DropboxMixin):

    @gen.engine
    def dbox_get_tree(self, user, path, recurse=False, callback=None):
        access_token = user.get_dropbox_token()
        api_url = "/1/metadata/{{root}}{path}"
        response = yield gen.Task(self.dropbox_request,
            "api",
            api_url.format(path=path),
            access_token=access_token,
            hash=user.dbox_hash or "")
        tree_dict = json.loads(response.body)
        for item in tree_dict['contents']:
            if item['is_dir']:
                yield gen.Task(self.dbox_get_tree, user, item['path'], recurse)
            item['root_path'] = tree_dict['path']
            db_file = DropboxFile(**item)
            yield motor.Op(db_file.save, self.db, user.username)
        callback(tree_dict)
