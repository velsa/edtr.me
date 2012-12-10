import re
import Cookie
from tornado.testing import AsyncHTTPTestCase, LogTrapTestCase
from tornado.options import options
from tornado.ioloop import IOLoop
from tornado import gen
import motor
from mock import patch
from app import EdtrmeApp
from http_test_client import TestClient
from handlers.base import BaseHandler
from handlers.home import HomeHandler
from utils.mdb_dropbox.mdb_session import MDBDropboxSession

MONGO_TEST_DB = 'edtrme_test'

app = EdtrmeApp(mongo_db=MONGO_TEST_DB)
reverse_url = app.reverse_url
db = app.settings['db']


class BaseTest(AsyncHTTPTestCase, LogTrapTestCase, TestClient):
    def setUp(self):
        super(BaseTest, self).setUp()
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


class RegisterTest(BaseTest):
    def test_register_page_exists(self):
        response = self.get(reverse_url('register'))
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
        self.assertEqual(resp.code, 302)
        self.assertEqual(resp.headers['Location'], reverse_url('home'))
        # check, user is created
        user = self.db_find_one({'username': username})
        self.assertEqual(user['username'], username)

    def test_invalid_signup_data(self):
        # TODO
        pass


class LoginTest(BaseTest):
    def setUp(self):
        super(LoginTest, self).setUp()

    def test_login_page_exists(self):
        response = self.get(reverse_url('login'))
        self.assertEqual(response.code, 200)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(HomeHandler, 'authorize_redirect')
    def test_login_user_dropbox_redirect(self,
        m_get_current_user, m_authorize_redirect):
        m_get_current_user.return_value = 'testuser'
        self.db_save({'username': 'testuser'})
        self.get(reverse_url('home'))
        self.assertEqual(m_authorize_redirect.called, True)

    @patch.object(MDBDropboxSession, 'get_account_info')
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(HomeHandler, 'get_authenticated_user')
    def test_login_account_info_set(self,
        m_get_authenticated_user, m_get_current_user, m_get_account_info):
        ### test init
        auth_key = 'auth_key'
        auth_secret = 'auth_secret'
        username = 'testuser'
        first_name = 'first'
        last_name = 'last'
        email = 'test@test.com'

        def get_authenticated_user_side(callback):
            callback({'access_token':
                {'key': auth_key, 'secret': auth_secret}})

        m_get_authenticated_user.side_effect = get_authenticated_user_side
        m_get_current_user.return_value = username
        m_get_account_info.return_value = {
            'display_name': " ".join([first_name, last_name]),
            'email': email}
        self.db_save({'username': username})

        ### test sequence
        resp = self.get(reverse_url('home') + "?oauth_token=lxfz2xs3sjsmjo8")
        user = self.db_find_one({'username': username})
        self.assertEqual(resp.code, 302)
        self.assertEqual(resp.headers['Location'], reverse_url('home'))

        self.assertEqual(user['token_string'], '|'.join([auth_key, auth_secret]))
        self.assertEqual(user['first_name'], first_name)
        self.assertEqual(user['last_name'], last_name)
        self.assertEqual(user['email'], email)

    @patch.object(BaseHandler, 'get_current_user')
    def test_logged_in_user_page(self, m_get_current_user):
        ### test init
        username = 'testuser'
        first_name = 'first'
        last_name = 'last'
        email = 'test@test.com'
        m_get_current_user.return_value = username
        self.db_save({
            'username': username,
            'first_name': first_name,
            'last_name': last_name,
            'email': email,
            'token_string': 'some_token_string',
        })

        ### test sequence
        resp = self.get(reverse_url('home'))
        self.assertEqual(resp.code, 200)
        self.assertIn(email, resp.body)
