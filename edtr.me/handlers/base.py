import tornado.web
import tornado.escape
import logging
from settings import jinja_env
import re

logger = logging.getLogger('edtr_logger')


class BaseHandler(tornado.web.RequestHandler):
    """A class to collect common handler methods - all other handlers should
    subclass this one.
    """

    @classmethod
    def get_url_by_name(cls, name, *args):
        from urls import url_names
        url_name = url_names[name]
        for arg in args:
            url_name = re.sub("\(.*?\)", arg, url_name, 1)
        return url_name

    def render(self, template, context=None):
        """Renders template using jinja2"""
        if not context:
            context = {}
        context.update(self.get_template_namespace())
        context.update({"get_url": self.get_url_by_name})
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

    def render_async(self, tmpl, context):
        self.render(tmpl, context)
        self.finish()
