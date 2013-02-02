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
        result = yield gen.Task(self.wk_dbox_get_tree, user, path)

        self.finish_json_request(result)


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
            data = yield gen.Task(self.wk_dbox_get_file, user, path)
            self.finish_json_request(data)


class DropboxSaveFile(DropboxHandler):
    """Save file path metadata from dropbox.
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
            text_content = self.get_argument("content", None)
            data = yield gen.Task(self.wk_dbox_save_file, user, path,
                text_content)
            self.finish_json_request(data)


class DropboxCreateDir(DropboxHandler):
    """Create new dir in dropbox"""

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def post(self):
        path = self.get_argument("path", None)
        if not path:
            self.finish_json_request({'status': ErrCode.bad_request})
        else:
            user = yield gen.Task(self.get_edtr_current_user)
            data = yield gen.Task(self.wk_dbox_create_dir, user, path)
            self.finish_json_request(data)


class DropboxDelete(DropboxHandler):
    """Delete file or directory"""

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def post(self):
        path = self.get_argument("path", None)
        if not path:
            self.finish_json_request({'status': ErrCode.bad_request})
        else:
            user = yield gen.Task(self.get_edtr_current_user)
            data = yield gen.Task(self.wk_dbox_delete, user, path)
            self.finish_json_request(data)


class DropboxMove(DropboxHandler):
    """Moves a file or folder to a new location."""

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def post(self):
        from_path = self.get_argument("from_path", None)
        to_path = self.get_argument("to_path", None)
        if not from_path or not to_path:
            self.finish_json_request({'status': ErrCode.bad_request})
        else:
            user = yield gen.Task(self.get_edtr_current_user)
            data = yield gen.Task(self.wk_dbox_move, user, from_path, to_path)
            self.finish_json_request(data)
