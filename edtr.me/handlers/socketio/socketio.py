from tornadio2 import SocketConnection, event
from tornado.web import decode_signed_value, HTTPError
from tornado import gen
from django.utils import simplejson as json
import motor
from settings import settings
from workers.dropbox import DropboxWorkerMixin
from models.accounts import UserModel


class SocketError:
    NO_COOKIE = "User is not found in cookies"
    BAD_SESSION = "Invalid user Session"
    XSRF = "xsrf is missing or invalid"


class EdtrConnection(SocketConnection, DropboxWorkerMixin):
    """ Socketio handler of edtr.me.
    User cookies and _xsrf are checked once at on_open.
    To send message, events and to handle corresponding request at client side
    look:
    message: https://tornadio2.readthedocs.org/en/latest/multiplexed/
    event: https://tornadio2.readthedocs.org/en/latest/events/
    Also, here are some examples:
    https://github.com/mrjoes/tornadio2/tree/master/examples
    """

    @property
    def db(self):
        if not hasattr(self, '_db'):
            self._db = self.application.settings['db']
        return self._db

    def emit_as_json(self, name, data):
        self.emit(name, json.dumps(data))

    @gen.engine
    def get_edtr_current_user(self, user_cookie, callback):
        username = decode_signed_value(settings["cookie_secret"],
            "user", user_cookie.value,
            max_age_days=settings['cookie_expires'])
        # TODO cache
        result = yield motor.Op(
            self.db.accounts.find_one, {"username": username})
        if result:
            callback(UserModel(**result))
        else:
            callback(None)

    @gen.engine
    def on_open(self, request):
        """
        Checking for user session and xsrf.
        To open socket, client must include into url xsrf value from cookie:
        io.connect('http://example.com?xsrf=' + xsrf_from_cookie')
        """
        # check user session
        self.user_cookie = request.get_cookie('user')
        if not self.user_cookie:
            raise HTTPError(403, SocketError.NO_COOKIE)
        user = yield gen.Task(self.get_edtr_current_user, self.user_cookie)
        if not user:
            raise HTTPError(403, SocketError.BAD_SESSION)

        # check xsrf
        xsrf_arg = request.get_argument('xsrf')
        if not xsrf_arg or request.get_cookie('_xsrf').value != xsrf_arg:
            raise HTTPError(403, SocketError.XSRF)

    def on_message(self, message):
        self.send(message + "from server")

    @event
    @gen.engine
    def get_tree(self):
        # TODO maybe set common user fields as self.field
        # to not make database call to find user
        user = yield gen.Task(self.get_edtr_current_user, self.user_cookie)

        tree = yield gen.Task(
            self.dbox_get_tree, user.get_dropbox_token(), "/")
        output = {
            'status': 'success',
            'tree': tree.body,
        }
        self.emit_as_json('get_tree', output)
