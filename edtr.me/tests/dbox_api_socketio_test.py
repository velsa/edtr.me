from tornadio2 import proto, SocketConnection
from lib.mock import patch
from urls import EdtrRouter
from base_socketio import SocketIoBaseTest


class SocketIoApiTest(SocketIoBaseTest):
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
        session.raw_message(proto.event(None, 'get_tree', None))
        self.sleep()
        m_emit.assert_called()
