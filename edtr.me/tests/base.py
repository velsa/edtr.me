import Cookie
from datetime import timedelta
from tornado.testing import AsyncHTTPTestCase, LogTrapTestCase
from tornado.options import options
from tornado.ioloop import IOLoop
from tornado import gen
from tests.lib.httpclient import AsyncHTTPClient
import motor
from app import EdtrmeApp
from tests.lib.http_test_client import TestClient

MONGO_TEST_DB = 'edtrme_test'

app = EdtrmeApp(mongo_db=MONGO_TEST_DB)
reverse_url = app.reverse_url
db = app.settings['db']

if options.socketio:
    from handlers.socketio.socketio import EdtrConnection
    EdtrConnection.application = app


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

    def get_http_server(self):
        if options.socketio:
            from tornadio2 import server
            return server.SocketServer(self._app, io_loop=self.io_loop,
                auto_start=False, **self.get_httpserver_options())
        else:
            return super(BaseTest, self).get_http_server()

    def get_new_ioloop(self):
        return IOLoop.instance()

    def get_http_client(self):
        """ Return here local http client. Because reqular tornado http client
        can be mocked in test. But for fetching server urls we need real
        client (not mocked). Here it is.
        """
        return AsyncHTTPClient(io_loop=self.io_loop)

    def get_http_port(self):
        return options.port

    def create_test_user(self, mocked_get_current_user):
        username = 'testuser'
        first_name = 'first'
        last_name = 'last'
        email = 'test@test.com'
        key = "some_key"
        secret = "some_secret"
        self.db_save({
            '_id': username,
            'first_name': first_name,
            'last_name': last_name,
            'email': email,
            'dbox_access_token': {"key": "some_key", "secret": "some_secret"},
        })
        mocked_get_current_user.return_value = username
        return username, email, key, secret

    def db_clear(self):
        @gen.engine
        def async_op():
            cursor = db.accounts.find()
            users = yield motor.Op(cursor.to_list)
            for user in users:
                yield motor.Op(db[user['_id']].remove)
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

    def sleep(self, seconds):
        @gen.engine
        def async_op():
            timeout = yield gen.Task(
                self.io_loop.add_timeout, timedelta(seconds=seconds))
            self.stop(timeout)
        async_op()
        self.wait()
