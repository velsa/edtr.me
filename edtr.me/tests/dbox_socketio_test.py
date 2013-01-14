import Cookie
from base import BaseTest
from urls import EdtrRouter
from tornadio2 import proto, SocketConnection
from lib.mock import patch


class DummyRequest(object):
    def __init__(self, **kwargs):
        self.arguments = kwargs
        self.cookies = Cookie.SimpleCookie()
        self.cookies['user'] = 'vvvvalue'
        self.cookies['_xsrf'] = 'some_xsrf'
        self.remote_ip = '127.0.0.1'


class SocketIoTest(BaseTest):

    @patch.object(SocketConnection, 'send')
    def test_on_message(self, m_send):
        request = DummyRequest()
        session = EdtrRouter.create_session(request)
        message = 'test message'
        session.raw_message(proto.message(None, message))
        self.assertEqual(m_send.called, True)
        print m_send.assert_called_with(message + "from server")

    @patch.object(SocketConnection, 'emit')
    def test_event_get_path(self, m_emit):
        request = DummyRequest()
        session = EdtrRouter.create_session(request)
        path = '/'
        session.raw_message(proto.event(None, 'get_path', None, path=path))
        m_emit.assert_called_with('get_path', path)
