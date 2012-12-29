from tornado.web import url
from tornado.options import options
from handlers.home import HomeHandler
from handlers.fake import FakeHandler
from handlers.accounts import (LoginHandler, RegisterHandler,
    UserNameAvailabilityHandler, LogoutHandler)
from handlers.api.v01.dropbox import UpdateDropboxTree, DropboxGetPath


url_patterns = [
    url(r"/", HomeHandler, name="home"),
    url(r'/accounts/login', LoginHandler, name="login"),
    url(r'/accounts/register', RegisterHandler, name="register"),
    url(r'/accounts/logout', LogoutHandler, name="logout"),
    url(r'/accounts/check_username_availability/(.+)/',
        UserNameAvailabilityHandler, name="user_name_avaliability"),

    url(r'/accounts/profile', FakeHandler, name="profile"),  # TODO
    url(r'/accounts/settings', FakeHandler, name="settings"),  # TODO

    url(r'/async/update_db_tree/', UpdateDropboxTree, name="update_db_tree"),  # TODO remove it. Use /api/0.1/dropbox/get_path/
    url(r'/api/0.1/dropbox/get_path/', DropboxGetPath, name="dropbox_get_path"),
]


if options.socketio:
    from tornadio2 import TornadioRouter
    from handlers.socketio import EdtrConnection
    EdtrRouter = TornadioRouter(EdtrConnection)
    url_patterns = EdtrRouter.apply_routes(url_patterns)
