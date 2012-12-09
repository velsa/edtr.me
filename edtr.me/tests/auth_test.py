import urllib
import re
from tornado.testing import AsyncHTTPTestCase, LogTrapTestCase
from tornado.options import options
from tornado.ioloop import IOLoop
from tornado import gen
import motor
from app import EdtrmeApp

MONGO_TEST_DB = 'edtrme_test'

app = EdtrmeApp(mongo_db=MONGO_TEST_DB)
reverse_url = app.reverse_url
db = app.settings['db']


class RegisterTest(AsyncHTTPTestCase, LogTrapTestCase):
    def setUp(self):
        super(RegisterTest, self).setUp()

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
        self.clear_db()
        post_data = {
            'username': username,
            'password1': '123123',
            'password2': '123123',
        }
        reg_url = reverse_url('register')
        resp = self.fetch(reg_url, follow_redirects=False)
        # set xsrf cookie and add to post request
        post_data['_xsrf'] = re.search('<input type="hidden" name="_xsrf" value="(.*?)"',
            resp.body).group(1)
        post_body = urllib.urlencode(post_data)
        cookie = resp.headers['Set-Cookie']
        # send post data
        resp = self.fetch(reg_url, method='POST', body=post_body,
            headers={'Cookie': cookie}, follow_redirects=False)

        # check we are redirected to home page
        self.assertEqual(resp.error.response.headers['Location'], reverse_url('home'))
        # check, user is created
        user = self.find_one({'username': username})
        self.assertEqual(user['username'], username)
