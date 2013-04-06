import os.path
import shutil
import Cookie
from datetime import timedelta

from tornado.testing import AsyncHTTPTestCase, LogTrapTestCase
from tornado.options import options
from tornado.ioloop import IOLoop
from tornado import gen
import motor
from django.utils import simplejson as json

from tests.lib.httpclient import AsyncHTTPClient
from tests.lib.http_test_client import TestClient
from app import EdtrmeApp
from utils.main import get_user_root, FolderType

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
        self.test_user_name = 'testuser'
        self.reverse_url = reverse_url
        ### clear data base before each test
        self.db_clear()
        # raw fix for TestClient. Currently don't understand, how to use it
        # without source modification
        self.cookies = Cookie.SimpleCookie()

    def tearDown(self):
        super(BaseTest, self).tearDown()
        user_publish_folder = os.path.join(
            options.site_root, self.test_user_name)
        if os.path.exists(user_publish_folder):
            shutil.rmtree(user_publish_folder)

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
        username = self.test_user_name
        first_name = 'first'
        last_name = 'last'
        email = 'test@test.com'
        key = "some_key"
        secret = "some_secret"
        self.db_save('accounts', {
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

    def db_find_one(self, collection, data):
        @gen.engine
        def async_op():
            result = yield motor.Op(db[collection].find_one, data)
            self.stop(result)
        async_op()
        return self.wait()

    def db_save(self, collection, data):
        @gen.engine
        def async_op():
            result = yield motor.Op(db[collection].save, data)
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

    def post_with_xsrf(self, url, data):
        _xsrf = 'some_hash_key'
        post_data = data or {}
        post_data["_xsrf"] = _xsrf
        return self.post(url, data=post_data,
            headers={'Cookie': '_xsrf={0}'.format(_xsrf)})

    def check_json_response(self, response):
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        return json_resp

    def check_pub_md_content(self, content=None, encoding='utf8', publish=False):
        # TODO: check, post is generated, not just copied
        f_types = [FolderType.preview_content]
        if publish:
            f_types.append(FolderType.publish_content)
        for f_type in f_types:
            file_path = os.path.join(
                get_user_root(self.test_user_name, f_type),
                self.dbox_path.lstrip('/'))
            self.assertTrue(os.path.exists(file_path))
            if content:
                with open(file_path) as f:
                    read_data = f.read()
                    if encoding:
                        read_data = read_data.decode(encoding)
                    self.assertEqual(read_data, content)
