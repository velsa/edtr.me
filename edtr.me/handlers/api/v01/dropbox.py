import logging
import tornado.web
from tornado import gen
from django.utils import simplejson as json
from handlers.base import BaseHandler
from workers.dropbox import DropboxWorkerMixin
from utils.error import ErrCode
logger = logging.getLogger('edtr_logger')


class DropboxHandler(BaseHandler, DropboxWorkerMixin):
    def finish_json_request(self, ret):
        self.set_header("Content-Type",  'application/json')
        self.write(json.dumps(ret))
        self.finish()


class DropboxGetTree(DropboxHandler):
    """Get path metadata from dropbox.
    Save it to database.
    Return path metadata."""

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def post(self):
        path = self.get_argument("path", "/")
        user = yield gen.Task(self.get_edtr_current_user)
        result = yield gen.Task(self.dbox_get_tree, user, path)

        self.finish_json_request({
            'status': result['status'],
            "tree": result.get('files', None),
        })


class DropboxGetFile(DropboxHandler):
    """Get path metadata from dropbox.
    Save it to database.
    Return path metadata."""

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def post(self):
        path = self.get_argument("path", None)
        if not path:
            self.finish_json_request({'status': ErrCode.bad_request})
        else:
            user = yield gen.Task(self.get_edtr_current_user)
            data = yield gen.Task(self.dbox_get_file, user, path)
            self.finish_json_request(data)
