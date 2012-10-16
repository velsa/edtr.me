from handlers.base import BaseHandler
import logging
import tornado.web
from tornado import gen
from utils.main import DB
from utils.sessions import asyncmongosession
from models.accounts import UserModel
from django.utils import simplejson

logger = logging.getLogger('edtr_logger')


class UpdateDropboxTree(BaseHandler):
    """Sync directories and files from dropbox to server
    """

    @tornado.web.asynchronous
    @asyncmongosession
    @gen.engine
    @tornado.web.authenticated
    def get(self):
        username = self.current_user

        # find user with specified username
        response, not_used = yield gen.Task(UserModel.find_one,
            {"username": username})

        # error from database
        if response[DB.error]:
            # TODO process error
            logger.error(response[DB.error])
            raise tornado.web.HTTPError(500,
                'Database Error {0}'.format(response[DB.error]))

        # user not found
        user = response[DB.model]
        if not user:
            self.set_current_user(None)
            self.redirect(self.get_url_by_name("home"))
            return
        else:
            user = UserModel(user)

        ret = {'status': 'error', 'message': '', 'task_id': '', }
        # TODO user doesn't have saved token string
        # if not user['token_string']:

        ret['message'] = "<strong>Currently debug stub</strong>"
        self.set_header("Content-Type",  'application/json')
        self.write(simplejson.dumps(ret))
        self.finish()
