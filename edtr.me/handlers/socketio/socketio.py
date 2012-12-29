from tornadio2 import SocketConnection
from tornado.web import decode_signed_value
import settings


class EdtrConnection(SocketConnection):
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
