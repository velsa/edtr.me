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

    @gen.engine
    def dbox_meta_to_db(self, user, path, recursive=False, callback=None):
        tree = yield gen.Task(
            self.dbox_get_tree,
            user.get_dropbox_token(),
            user.dbox_hash,
            path
        )
        tree_dict = json.loads(tree.body)

        for item in tree_dict['contents']:
            if item['is_dir']:
                yield gen.Task(self.dbox_meta_to_db, user, path, item['path'])
            else:
                pass
        callback(tree_dict['hash'])

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def post(self):
        path = self.get_argument("path", "/")
        user = yield gen.Task(self.get_edtr_current_user)
        needed_tree = None
        if user.dbox_hash is None:
            user.dbox_hash = yield gen.Task(
                self.dbox_meta_to_db, user, path, recursive=True)
            # yield motor.Op(self.db.accounts.insert, to_python(user))

        self.finish_json_request({
            'status': 'stub',
            "tree": needed_tree.body,
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
