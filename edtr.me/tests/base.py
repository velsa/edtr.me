import Cookie
from tornado.testing import AsyncHTTPTestCase, LogTrapTestCase
from tornado.options import options
from tornado.ioloop import IOLoop
from tornado import gen
import motor
from app import EdtrmeApp
from http_test_client import TestClient

MONGO_TEST_DB = 'edtrme_test'

app = EdtrmeApp(mongo_db=MONGO_TEST_DB)
reverse_url = app.reverse_url
db = app.settings['db']


class BaseTest(AsyncHTTPTestCase, LogTrapTestCase, TestClient):

    def setUp(self):
        super(BaseTest, self).setUp()
        self.reverse_url = reverse_url
        ### clear data base before each test
        self.db_clear()
        # raw fix for TestClient. Currently don't understand, how to use it
        # without source modification
        self.cookies = Cookie.SimpleCookie()

    def get_app(self):
        return app

    def get_new_ioloop(self):
        return IOLoop.instance()

    def get_http_port(self):
        return options.port

    def db_clear(self):
        @gen.engine
        def async_op():
            yield motor.Op(db.accounts.remove)
            self.stop()
        async_op()
        self.wait()

    def db_find_one(self, user_data):
        @gen.engine
        def async_op():
            result = yield motor.Op(db.accounts.find_one, user_data)
            self.stop(result)
        async_op()
        return self.wait()

    def db_save(self, user_data):
        @gen.engine
        def async_op():
            result = yield motor.Op(db.accounts.save, user_data)
            self.stop(result)
        async_op()
        return self.wait()
