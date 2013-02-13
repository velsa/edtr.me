import tornado.web
from handlers.base import BaseHandler


class FakeHandler(tornado.web.RequestHandler):
    """Handler for under construction page.
    """
    def get(self):
        self.write("under construction")


class RenderTrashHtml(BaseHandler):
    def get(self, tmpl):
        if "api_socketio_usage" in tmpl:
            self.render("example_not_for_production/api_socketio_usage.html")
        else:
            self.write("tmpl not found")
