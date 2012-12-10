import re
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


class RegisterTest(AsyncHTTPTestCase, LogTrapTestCase, TestClient):
    def setUp(self):
        super(RegisterTest, self).setUp()
        self.clear_db()
        # raw fix for TestClient. Currently don't understand, how to use it
        # without source modification
        self.cookies = Cookie.SimpleCookie()

    def get_app(self):
        return app

    def get_new_ioloop(self):
        return IOLoop.instance()

    def get_http_port(self):
        return options.port

    def clear_db(self):
        @gen.engine
        def async_op():
            yield motor.Op(db.accounts.remove)
            self.stop()
        async_op()
        self.wait()

    def find_one(self, user_data):
        @gen.engine
        def async_op():
            result = yield motor.Op(db.accounts.find_one, user_data)
            self.stop(result)
        async_op()
        return self.wait()

    def test_register_page_exists(self):
        response = self.fetch(reverse_url('register'), follow_redirects=False)
        self.assertEqual(response.code, 200)

    def test_signup_user_is_created(self):
        username = 'testuser'
        post_data = {
            'username': username,
            'password1': '123123',
            'password2': '123123',
        }
        reg_url = reverse_url('register')
        resp = self.get(reg_url)
        # add xsrf to post request
        post_data['_xsrf'] = re.search(
            '<input type="hidden" name="_xsrf" value="(.*?)"', resp.body).group(1)
        resp = self.post(reg_url, data=post_data)
        # check we are redirected to home page
        self.assertEqual(resp.error.response.headers['Location'], reverse_url('home'))
        # check, user is created
        user = self.find_one({'username': username})
        self.assertEqual(user['username'], username)

    def test_invalid_signup_data(self):
        # TODO
        pass
