from tornado.options import options
from tornado.web import url

from handlers.accounts import (LoginHandler, RegisterHandler,
    UserNameAvailabilityHandler, LogoutHandler)
from handlers.api.v1.dropbox import (DropboxGetTree, DropboxGetFile,
    DropboxSaveFile, DropboxCreateDir, DropboxDelete, DropboxMove,
    DropboxCopy, DropboxPublish)
from handlers.fake import FakeHandler, GetEditorHandler, RenderTrashHtml
from handlers.home import HomeHandler


url_patterns = [
    url(r"/", HomeHandler, name="home"),
    url(r'/accounts/login', LoginHandler, name="login"),
    url(r'/accounts/register', RegisterHandler, name="register"),
    url(r'/accounts/logout', LogoutHandler, name="logout"),
    url(r'/accounts/check_username_availability/(.+)/',
        UserNameAvailabilityHandler, name="user_name_avaliability"),

    url(r'/accounts/profile', FakeHandler, name="profile"),  # TODO
    url(r'/accounts/settings', FakeHandler, name="settings"),  # TODO

    # ajax api
    url(r'/v1/dropbox/get_tree/', DropboxGetTree, name="dropbox_get_path"),
    url(r'/v1/dropbox/get_file/', DropboxGetFile, name="dropbox_get_file"),
    url(r'/v1/dropbox/save_file/', DropboxSaveFile, name="dropbox_save_file"),
    url(r'/v1/dropbox/create_dir/', DropboxCreateDir, name="dropbox_create_dir"),
    url(r'/v1/dropbox/delete/', DropboxDelete, name="dropbox_delete"),
    url(r'/v1/dropbox/move/', DropboxMove, name="dropbox_move"),
    url(r'/v1/dropbox/copy/', DropboxCopy, name="dropbox_copy"),
    url(r'/v1/dropbox/publish/', DropboxPublish, name="dropbox_publish"),

    url(r'/get_editor(.*)', GetEditorHandler, name="get_editor"),
]

if options.debug:
    url_patterns += [
        url(r'/trash_debug/(.*)', RenderTrashHtml, name="trash_debug"),
    ]

if options.socketio:
    from tornadio2 import TornadioRouter
    from handlers.socketio import EdtrConnection
    EdtrRouter = TornadioRouter(EdtrConnection)
    url_patterns = EdtrRouter.apply_routes(url_patterns)
