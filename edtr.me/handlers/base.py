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

    def render(self, template, context = None):
        """Renders template using jinja2"""
        if not context: context = {}
        context.update(self.get_template_namespace())
        context.update({"get_url": self.get_url_by_name})
        self.write(jinja_env.get_template(template).render(context))
        self.flush()

    def set_current_user(self, user):
        if user:
            self.session['user'] = tornado.escape.json_encode(user)
        elif hasattr(self, 'session'):
            self.session.delete()
        else:
            # Nothing to do
            pass

    def get_current_user(self):
        if hasattr(self, "session"):
            if 'user' in self.session:
                # TODO 
                # maybe try to find user with username == session['user']
                return tornado.escape.json_decode(self.session['user'])
        return None

    def render_async(self, tmpl, context):
        self.render(tmpl, context)
        self.finish()
