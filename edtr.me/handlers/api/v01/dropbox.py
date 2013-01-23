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
            'status': 'stub',
            "tree": path_tree['contents'],
        })


class UpdateDropboxTree(DropboxHandler):
    """Sync directories and files from dropbox to server
    """

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def get(self):
        ret = {'status': 'error', 'message': '', 'task_id': '', }

        username = self.current_user

        result = yield motor.Op(self.db.accounts.find_one, {"username": username})
        if not result:
        # user not found
            self.set_current_user(None)
            self.redirect(self.reverse_url("home"))
            return

        user = UserModel(**result)

        # TODO user doesn't have saved token string
        # if not user['token_string']:
        ret['message'] = "<strong>Currently debug stub</strong>"
        self.finish_json_request(ret)
