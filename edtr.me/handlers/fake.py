import tornado.web
from handlers.base import BaseHandler


class FakeHandler(tornado.web.RequestHandler):
    """Handler for under construction page.
    """
    def get(self):
        self.write("under construction")


class GetDropboxTreeHandler(BaseHandler):
    """Fake handler for serving dropbox tree to browser
    """
    def initialize(self, **kwargs):
        super(GetDropboxTreeHandler, self).initialize(**kwargs)

    def get(self, *args, **kwargs):
        self.write({
            "json_tree":
                [
                    {"label": "Item 1", "expanded": True,
                        "items":
                        [
                            {"label": "Item 1.1"},
                            {"label": "Item 1.2", "selected": True},
                        ]
                    },
                    {"label": "Item 2"},
                    {"label": "Item 3"},
                    {"label": "Item 4"},
                    {"label": "Item 5"},
                    {"label": "Item 6"},
                    {"label": "Item 7"},
                    {"label": "Item 8"},
                    {"label": "Item 9"},
                    {"label": "Item 10",
                    "items":
                        [
                            {"label": "Item 4.1"},
                            {"label": "Item 4.2"},
                        ]
                    },
                    {"label": "Item 5"},
                    {"label": "Item 6"},
                    {"label": "Item 7"},
                ],
                # "data": {
                #     "data": "/",
                #     "metadata": {"id": 23},
                #     "children": [
                #         "index.md", "blog_1.md",
                #         "blog_2.md", "about.md",
                #         "fun_pic.jpg", "me.jpg",
                #         "pics": children": [
                #     ]
                # },
            "status":   "success",
            "message":  "",
            })
        self.flush()
