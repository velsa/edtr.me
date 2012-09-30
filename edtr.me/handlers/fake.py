import tornado.web

class FakeHandler(tornado.web.RequestHandler):
    """Handler for under construction page.
    """

    def get(self):
        self.write("under construction")
