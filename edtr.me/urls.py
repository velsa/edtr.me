from tornado.web import url
from handlers.home import HomeHandler
from handlers.fake import FakeHandler
from handlers.accounts import (LoginHandler, RegisterHandler,
    UserNameAvailabilityHandler, LogoutHandler)
from handlers.dropbox import UpdateDropboxTree

url_patterns = [
    url(r"/", HomeHandler, name="home"),
    url(r'/accounts/login', LoginHandler, name="login"),
    url(r'/accounts/register', RegisterHandler, name="register"),
    url(r'/accounts/logout', LogoutHandler, name="logout"),
    url(r'/accounts/check_username_availability/(.+)/',
        UserNameAvailabilityHandler, name="user_name_avaliability"),

    url(r'/accounts/profile', FakeHandler, name="profile"),  # TODO
    url(r'/accounts/settings', FakeHandler, name="settings"),  # TODO

    url(r'/async/update_db_tree/', UpdateDropboxTree, name="update_db_tree"),
]
