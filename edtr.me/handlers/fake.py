import tornado.web
from handlers.base import BaseHandler


class FakeHandler(tornado.web.RequestHandler):
    """Handler for under construction page.
    """

    def get(self):
        self.write("under construction")


class GetEditorHandler(BaseHandler):
    """Fake handler for serving correct web editor code to browser
    """
    def initialize(self, **kwargs):
        super(GetEditorHandler, self).initialize(**kwargs)

    def get(self, *args, **kwargs):
        content_type = self.get_argument("content_type", None)
        self.tmpl = "editor/cm_" + content_type + ".html"
        self.render(self.tmpl)  # , self.context)
