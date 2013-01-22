import logging
import tornado.web
import tornado.escape
from tornado import gen
import motor
from models.accounts import UserModel
from settings import jinja_env

logger = logging.getLogger('edtr_logger')


class BaseHandler(tornado.web.RequestHandler):
    """A class to collect common handler methods - all other handlers should
    subclass this one.
    """
    def initialize(self, **kwargs):
        super(BaseHandler, self).initialize(**kwargs)
        self.db = self.settings['db']

    def render(self, template, context=None):
        """Renders template using jinja2"""
        if not context:
            context = {}
        context.update(self.get_template_namespace())
        self.write(jinja_env.get_template(template).render(context))
        self.flush()

    def set_current_user(self, user):
        if user:
            self.set_secure_cookie('user', user)
        else:
            self.clear_cookie('user')

    def get_current_user(self):
        expires = self.settings.get('cookie_expires', 31)
        return self.get_secure_cookie('user', max_age_days=expires)

    @gen.engine
    def get_edtr_current_user(self, callback):
        username = self.current_user
        # TODO cache
        result = yield motor.Op(self.db.accounts.find_one,
            {"username": username})
        callback(UserModel(**result))

    def render_async(self, tmpl, context):
        self.render(tmpl, context)
        self.finish()
