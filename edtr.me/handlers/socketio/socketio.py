from tornadio2 import SocketConnection, event
from tornado.web import decode_signed_value
from tornado import gen
import settings
import motor


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

    ## TODO: find a way to send _xsrf as parameter and compare it with cookie
    def on_open(self, info):
        user_cookie = info.get_cookie('user').value
        user = decode_signed_value(
            settings.settings["cookie_secret"],
           "user",
           user_cookie,
           max_age_days=settings.settings['cookie_expires'])
        print "user", user
        print "_xsrf", info.get_cookie('_xsrf').value

    def on_message(self, message):
        self.send(message + "from server")

    @event
    # @gen.engine
    def get_path(self, path):
        yield motor.Op(
            self.db.accounts.find_one, {"username": 'stalk'})
        # self.stop(result)
        # result = self.wait()
        # print "result", result

        self.emit('get_path', path)
