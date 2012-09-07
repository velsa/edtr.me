import tornado.web
import logging
from settings import jinja_env

logger = logging.getLogger('edtr_logger')

class BaseHandler(tornado.web.RequestHandler):
    """A class to collect common handler methods - all other handlers should
    subclass this one.
    """

    def render(self, template, context = None):
        if not context: context = {}
        context.update(self.get_template_namespace())
        self.write(jinja_env.get_template(template).render(context))
        self.flush()

    def get_current_user(self):
    	# TODO
        return None