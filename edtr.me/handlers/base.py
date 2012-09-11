import tornado.web
import tornado.escape
import logging
from settings import jinja_env

logger = logging.getLogger('edtr_logger')

class BaseHandler(tornado.web.RequestHandler):
    """A class to collect common handler methods - all other handlers should
    subclass this one.
    """

    def render(self, template, context = None):
        """Renders template using jinja2"""
        if not context: context = {}
        context.update(self.get_template_namespace())
        from urls import url_names
        context.update({"get_url": lambda x: url_names[x]})
        self.write(jinja_env.get_template(template).render(context))
        self.flush()

    def get_current_user(self):
        # TODO
        # This is simple stub
        # Need to save session to database, like in django
        # and check it, when checking cookie        
        user_json = self.get_secure_cookie("user")
        if user_json:
            return tornado.escape.json_decode(user_json)
        else:
            return None

    def render_async(self, tmpl, context):
        self.render(tmpl, context)
        self.finish()
