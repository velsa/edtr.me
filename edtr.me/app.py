#!/usr/bin/env python

import tornado.httpserver
import tornado.ioloop
import tornado.web
from tornado.options import options
import motor
from settings import settings, mongo_address, MONGO_DB
from urls import url_patterns
from tornado.ioloop import PeriodicCallback
from workers.dropbox import dbox_periodic_update
import utils.gl


class EdtrmeApp(tornado.web.Application):
    def __init__(self, *args, **kwargs):
        mongo_addr = kwargs.get('mongo_addr', mongo_address)
        mongo_db = kwargs.get('mongo_db', MONGO_DB)
        db = motor.MotorClient(**mongo_addr).open_sync()[mongo_db]
        utils.gl.DB.set_instance(db)
        super(EdtrmeApp, self).__init__(
            url_patterns, db=db, *args, **dict(settings, **kwargs))


def main():
    if options.socketio:
        from tornadio2 import server
        from handlers.socketio.socketio import EdtrConnection
        app = EdtrmeApp(socket_io_port=options.port)
        EdtrConnection.application = app
        server.SocketServer(app, auto_start=False)
    else:
        app = EdtrmeApp()
        http_server = tornado.httpserver.HTTPServer(app)
        http_server.listen(options.port)

    ince = tornado.ioloop.IOLoop.instance()
    # Periodic sync with dropbox
    PeriodicCallback(dbox_periodic_update, options.dbox_time, ince).start()
    ince.start()

if __name__ == "__main__":
    main()
