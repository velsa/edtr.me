#!/usr/bin/env python

import tornado.httpserver
import tornado.ioloop
import tornado.web
from tornado.options import options
import motor
from settings import settings, mongo_address, MONGO_DB
from urls import url_patterns


class TornadoBoilerplate(tornado.web.Application):
    def __init__(self):
        db = motor.MotorConnection(**mongo_address).open_sync()[MONGO_DB]
        db.accounts.ensure_index("username", unique=True)
        tornado.web.Application.__init__(self, url_patterns, db=db, **settings)


def main():
    app = TornadoBoilerplate()
    http_server = tornado.httpserver.HTTPServer(app)
    http_server.listen(options.port)
    tornado.ioloop.IOLoop.instance().start()

if __name__ == "__main__":
    main()
