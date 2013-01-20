import logging
import tornado.web
from tornado import gen
import motor
from django.utils import simplejson as json
from handlers.base import BaseHandler
from models.accounts import UserModel
from utils.mdb_dropbox.tasks import process_web_sync
from workers.dropbox import get_tree
logger = logging.getLogger('edtr_logger')


class DropboxHandler(BaseHandler):
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

        tree = get_tree()
        self.finish_json_request({
            'status': 'stub',
            "tree": tree,
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
        process_web_sync(user)
        ret['message'] = "<strong>Currently debug stub</strong>"
        self.finish_json_request(ret)
