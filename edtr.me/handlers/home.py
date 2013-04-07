import logging
import tornado.web
from tornado import gen
import motor
from settings import jinja_env

from workers.dropbox import DropboxWorkerMixin
from models.accounts import UserModel
from handlers.base import BaseHandler

from workers.dropbox import DropboxWorkerMixin
from handlers.base import BaseHandler

logger = logging.getLogger('edtr_logger')


class HomeHandler(BaseHandler, DropboxWorkerMixin):
    """Handler for home page. If user is authenticated, then redirect him
    to his control page. Else, show information data and suggest to sign in.
    """

    @tornado.web.asynchronous
    @gen.engine
    @tornado.web.authenticated
    def get(self):
        user = yield gen.Task(self.get_edtr_current_user)

        if not user:
            self.set_current_user(None)
            self.redirect(self.reverse_url("home"))
            return

        # user doesn't have saved token
        if not user.dbox_access_token:
            if self.get_argument("oauth_token", None):
                token = yield gen.Task(self.get_authenticated_user)

                if not token:
                    raise tornado.web.HTTPError(500, "Dropbox auth failed")

                user.set_dropbox_token(token)
                yield_key = object()
                callback = yield gen.Callback(yield_key)
                self.dropbox_request("api", "/1/account/info", callback,
                    access_token=user.dbox_access_token)
                response = yield gen.Wait(yield_key)
                user.set_dropbox_account_info(response)

                yield motor.Op(user.save, self.db)
                self.redirect(self.reverse_url("home"))
                return
            else:
                self.authorize_redirect(callback_uri=self.request.full_url())
                return

        self.render_async("home.html", {"user": user})


class GetEditorHandler(BaseHandler):
    """ Handler for serving correct editor (with toolbar) to browser
    """
    def initialize(self, **kwargs):
        super(GetEditorHandler, self).initialize(**kwargs)

    def get(self, *args, **kwargs):
        editor_type = self.get_argument("editor_type", None)
        editor_tmpl = "editor/cm_" + editor_type + ".html"
        context = self.get_template_namespace()
        self.write({
                "html":      jinja_env.get_template(editor_tmpl).render(context),
            })
        self.flush()
