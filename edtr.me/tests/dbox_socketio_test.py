import re
import Cookie
from tornado.web import HTTPError
from tornadio2 import proto, SocketConnection
from lib.mock import patch
from base import BaseTest
from urls import EdtrRouter
from handlers.socketio import SocketError

SECONDS_FOR_DB = 0.5


class DummyRequest(object):
    def __init__(self, cookies=None, xsrf=None, ip='127.0.0.1', **kwargs):
        request_args = kwargs
        if xsrf:
            request_args.update({'xsrf': [xsrf]})
        self.arguments = request_args
        C = Cookie.SimpleCookie()
        cookies = cookies or []
        for cookie in cookies:
            C.load(cookie)
        self.cookies = C
        self.remote_ip = ip


class SocketIoTest(BaseTest):
    def sleep(self, seconds=SECONDS_FOR_DB):
        super(SocketIoTest, self).sleep(seconds=seconds)

    def setUp(self):
        super(SocketIoTest, self).setUp()
        username = 'testuser'
        post_data = {
            'username': username,
            'password1': '123123',
            'password2': '123123',
        }
        reg_url = self.reverse_url('register')
        resp = self.get(reg_url)
        cookies = [resp.headers['Set-Cookie']]
        # add xsrf to post request
        xsrf = re.search('<input type="hidden" name="_xsrf" value="(.*?)"',
            resp.body).group(1)
        post_data['_xsrf'] = xsrf
        resp = self.post(reg_url, data=post_data)
        cookies.append(resp.headers['Set-Cookie'])
        self.cookies = cookies
        self.xsrf = xsrf
        self.request = DummyRequest(self.cookies, self.xsrf)

    def test_no_user_cookies(self):
        request = DummyRequest(xsrf=self.xsrf)
        try:
            EdtrRouter.create_session(request)
            self.sleep()
            self.fail('Session is created without cookies')
        except HTTPError as e:
            self.assertEqual(e.status_code, 401)
            self.assertEqual(e.log_message, SocketError.NO_COOKIE)

    def test_no_xsrf(self):
        request = DummyRequest(cookies=self.cookies)
        try:
            EdtrRouter.create_session(request)
            self.sleep()
            self.fail('Session is created without xsrf argument')
        except HTTPError as e:
            self.assertEqual(e.status_code, 401)
            self.assertEqual(e.log_message, SocketError.XSRF)

    def test_good_user_open_socket_pass(self):
        try:
            EdtrRouter.create_session(self.request)
            self.sleep()
        except HTTPError as e:
            self.fail("Session not created for good user.\
                status_code = {0}, err = '{1}'.".format(
                    e.status_code, e.log_message))

    @patch.object(SocketConnection, 'send')
    def test_on_message(self, m_send):
        session = EdtrRouter.create_session(self.request)
        self.sleep()
        message = 'test message'
        session.raw_message(proto.message(None, message))
        self.assertEqual(m_send.called, True)
        m_send.assert_called_with(message + "from server")

    @patch.object(SocketConnection, 'emit')
    def test_event_get_tree(self, m_emit):
        session = EdtrRouter.create_session(self.request)
        path = '/'
        session.raw_message(proto.event(None, 'get_tree', None, path=path))
        self.sleep()
        m_emit.assert_called_with('get_tree', path)
