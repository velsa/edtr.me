import re
from mock import patch
from handlers.base import BaseHandler
from handlers.home import HomeHandler
from utils.mdb_dropbox.mdb_session import MDBDropboxSession
from base import BaseTest


class RegisterTest(BaseTest):
    def test_register_page_exists(self):
        response = self.get(self.reverse_url('register'))
        self.assertEqual(response.code, 200)

    def test_signup_user_is_created(self):
        username = 'testuser'
        post_data = {
            'username': username,
            'password1': '123123',
            'password2': '123123',
        }
        reg_url = self.reverse_url('register')
        resp = self.get(reg_url)
        # add xsrf to post request
        post_data['_xsrf'] = re.search(
            '<input type="hidden" name="_xsrf" value="(.*?)"', resp.body).group(1)
        resp = self.post(reg_url, data=post_data)
        # check we are redirected to home page
        self.assertEqual(resp.code, 302)
        self.assertEqual(resp.headers['Location'], self.reverse_url('home'))
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
        response = self.get(self.reverse_url('login'))
        self.assertEqual(response.code, 200)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(HomeHandler, 'authorize_redirect')
    def test_login_user_dropbox_redirect(self,
        m_get_current_user, m_authorize_redirect):
        m_get_current_user.return_value = 'testuser'
        self.db_save({'username': 'testuser'})
        self.get(self.reverse_url('home'))
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
        resp = self.get(self.reverse_url('home') + "?oauth_token=lxfz2xs3sjsmjo8")
        user = self.db_find_one({'username': username})
        self.assertEqual(resp.code, 302)
        self.assertEqual(resp.headers['Location'], self.reverse_url('home'))

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
        resp = self.get(self.reverse_url('home'))
        self.assertEqual(resp.code, 200)
        self.assertIn(email, resp.body)
