from tornadio2 import SocketConnection, event
from tornado.web import decode_signed_value, HTTPError
from tornado import gen
from settings import settings
import motor


class SocketError:
    NO_COOKIE = "User is not found in cookies"
    BAD_SESSION = "Invalid user Session"
    XSRF = "xsrf is missing or invalid"


class EdtrConnection(SocketConnection):
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

    @gen.engine
    def on_open(self, request):
        """
        Checking for user session and xsrf.
        To open socket, client must include into url xsrf value from cookie:
        io.connect('http://example.com?xsrf=' + xsrf_from_cookie')
        """
        # check user session
        user_cookie = request.get_cookie('user')
        if not user_cookie:
            raise HTTPError(401, SocketError.NO_COOKIE)
        user_cookie = user_cookie.value
        username = decode_signed_value(settings["cookie_secret"],
            "user", user_cookie, max_age_days=settings['cookie_expires'])
        result = yield motor.Op(
            self.db.accounts.find_one, {"username": username})
        if not result:
            raise HTTPError(401, SocketError.BAD_SESSION)

        # check xsrf
        xsrf_arg = request.get_argument('xsrf')
        if not xsrf_arg or request.get_cookie('_xsrf').value != xsrf_arg:
            raise HTTPError(401, SocketError.XSRF)

    def on_message(self, message):
        self.send(message + "from server")

    @event
    @gen.engine
    def get_tree(self, path):
        self.emit('get_tree', path)
