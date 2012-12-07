from handlers.base import BaseHandler
import logging
import tornado.web
from tornado import gen
from utils.async_dropbox import DropboxMixin
from models.accounts import UserModel
from schematics.serialize import to_python
import motor

logger = logging.getLogger('edtr_logger')


class HomeHandler(BaseHandler, DropboxMixin):
    """Handler for home page. If user is authenticated, then redirect him
    to his control page. Else, show information data and suggest to sign in.
    """

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def get(self):
        username = self.current_user

        # find user with specified username
        result = yield motor.Op(self.db.accounts.find_one,
            {"username": username})

        if not result:
            self.set_current_user(None)
            self.redirect(self.reverse_url("home"))
            return
        user = UserModel(**result)

        # user doesn't have saved token string
        if not user.token_string:
            if self.get_argument("oauth_token", None):
                token = yield gen.Task(self.get_authenticated_user)

                if not token:
                    raise tornado.web.HTTPError(500, "Dropbox auth failed")
                user.token_string = '|'.join([
                    token['access_token']['key'],
                    token['access_token']['secret'], ])

                user.set_dropbox_account_info()

                yield motor.Op(self.db.accounts.save, to_python(user))
                self.redirect(self.reverse_url("home"))
                return
            else:
                self.authorize_redirect(callback_uri=self.request.full_url())
                return

        self.render_async("home.html", {"user": user})
