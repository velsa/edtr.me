import re
import cStringIO
from lib.mock import patch
from handlers.base import BaseHandler
from handlers.home import HomeHandler
from utils.mdb_dropbox.mdb_session import MDBDropboxSession
from base import BaseTest
from tornado.httpclient import HTTPResponse, HTTPRequest
from tornado.httputil import HTTPHeaders
from tornado.simple_httpclient import SimpleAsyncHTTPClient
from utils.async_dropbox import DropboxMixin


_OAUTH_REQUEST_TOKEN_URL = DropboxMixin._OAUTH_REQUEST_TOKEN_URL
_OAUTH_ACCESS_TOKEN_URL = DropboxMixin._OAUTH_ACCESS_TOKEN_URL
_OAUTH_AUTHORIZE_URL = DropboxMixin._OAUTH_AUTHORIZE_URL


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
    @patch.object(SimpleAsyncHTTPClient, 'fetch')  # all requests are mocked
    def test_login_account_info_set(self,
        m_fetch, m_get_current_user, m_get_account_info):
        ### test init
        oauth_request_token = "q7mu9foyzr6j47z"
        oauth_request_token_secret = "8ypm9lz45qt9hlp"
        oauth_cookie = None
        uid = "11033258"
        oauth_access_token = "fh43h2ajtosigk2"
        oauth_access_token_secret = "ndjlb1yu6pczcl9"
        # user data
        username = 'testuser'
        first_name = 'first'
        last_name = 'last'
        email = 'test@test.com'

        # mock behaviour
        fetch_mock_called = {
            _OAUTH_REQUEST_TOKEN_URL: False,
            _OAUTH_ACCESS_TOKEN_URL: False,
        }

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            output = cStringIO.StringIO()
            if _OAUTH_REQUEST_TOKEN_URL in request.url:
                fetch_mock_called[_OAUTH_REQUEST_TOKEN_URL] = True
                output.write(
                    "oauth_token_secret={0}&oauth_token={1}".format(
                    oauth_request_token_secret, oauth_request_token))
                resp = HTTPResponse(request=request, code=200, buffer=output)
            elif _OAUTH_ACCESS_TOKEN_URL in request.url:
                fetch_mock_called[_OAUTH_ACCESS_TOKEN_URL] = True
                output.write(
                    "oauth_token_secret={0}&oauth_token={1}&uid={2}".format(
                    oauth_access_token_secret, oauth_access_token, uid))
                resp = HTTPResponse(request=request, code=200, buffer=output)
            else:  # Unexpected url
                resp = None
                self.assertEqual(True, False)
            callback(resp)
        m_fetch.side_effect = fetch_mock
        m_get_current_user.return_value = username
        ## TODO remove mock 'get_account_info'. Add mock of url fetch
        m_get_account_info.return_value = {
            'display_name': " ".join([first_name, last_name]),
            'email': email}

        # prepare database
        self.db_save({'username': username})

        ### test sequence
        # fetch user page
        resp = self.get(self.reverse_url('home'))
        # check redirect to dropbox (request token is mocked)
        self.assertEqual(resp.code, 302)
        redirect_url = resp.headers['Location']
        self.assertEqual(fetch_mock_called[_OAUTH_REQUEST_TOKEN_URL], True)
        self.assertIn(_OAUTH_AUTHORIZE_URL, redirect_url)
        self.assertIn(oauth_request_token, redirect_url)
        oauth_cookie = resp.headers['Set-Cookie']
        # mock dropbox access token
        resp = self.get(self.reverse_url('home') +\
            "?uid={0}&oauth_token={1}".format(uid, oauth_request_token),
            headers={'Set-Cookie': oauth_cookie})
        # check, access token is received and saved
        self.assertEqual(fetch_mock_called[_OAUTH_ACCESS_TOKEN_URL], True)
        self.assertEqual(resp.code, 302)
        self.assertEqual(self.reverse_url('home'), resp.headers['Location'])
        user = self.db_find_one({'username': username})

        self.assertEqual(user['token_string'], '|'.join(
            [oauth_access_token, oauth_access_token_secret]))
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
