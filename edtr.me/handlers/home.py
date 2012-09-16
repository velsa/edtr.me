from handlers.base import BaseHandler
import logging
import tornado.web
from tornado import gen
from utils.main import DB
from utils.sessions import asyncmongosession
from utils.async_dropbox import DropboxMixin
from models.accounts import UserModel

logger = logging.getLogger('edtr_logger')

class HomeHandler(BaseHandler, DropboxMixin):
    """Handler for home page. If user is authenticated, then redirect him
    to his control page. Else, show information data and suggest to sign in.
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
            raise tornado.web.HTTPError(500, 
                'Database Error {0}'.format(response[DB.error]))

        # user not found
        user = response[DB.model]
        if not user:
            # TODO process error
            raise tornado.web.HTTPError(500, 'User not found')
        else:
            user = UserModel(user)

        # user doesn't have saved token string
        if not user['token_string']:
            if self.get_argument("oauth_token", None):
                token = yield gen.Task(self.get_authenticated_user)

                if not token:
                    raise tornado.web.HTTPError(500, "Dropbox auth failed")
                user['token_string'] = '|'.join([
                    token['access_token']['key'], 
                    token['access_token']['secret'], ])

                user.set_dropbox_account_info()

                response, not_used = yield gen.Task(user.save)

                # error from database
                if response[DB.error]:
                    # TODO process error
                    raise tornado.web.HTTPError(500, 
                        'Database Error {0}'.format(response[DB.error]))
                self.redirect('/')
                return
            else:
                self.authorize_redirect(callback_uri=self.request.full_url())
                return

        self.render("base.html")
        self.finish()     