import logging
import tornado.web
from tornado import gen
import motor
from django.utils import simplejson as json
from handlers.base import BaseHandler
from models.accounts import UserModel
from workers.dropbox import DropboxWorkerMixin
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
        path_tree = yield gen.Task(self.dbox_get_tree, user, path)

        self.finish_json_request({
            'status': 'success',
            "tree": path_tree,
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
        content = None
        if not path:
            status = 'fail'
        else:
            user = yield gen.Task(self.get_edtr_current_user)
            data = yield gen.Task(self.dbox_get_file, user, path)
            status = data['status']
            if status == 'success':
                content = data['content']
        self.finish_json_request({
            'status': status,
            "content": content,
        })


class UpdateDropboxTree(DropboxHandler):
    """Sync directories and files from dropbox to server
    """

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def get(self):
        ret = {'status': 'error', 'message': '', 'task_id': '', }
        ret['message'] = "<strong>Currently debug stub</strong>"
        self.finish_json_request(ret)
