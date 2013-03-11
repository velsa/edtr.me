from tornado.web import HTTPError
from urls import EdtrRouter
from handlers.socketio import SocketError
from base_socketio import SocketIoBaseTest, DummyRequest


class SocketIoAuthTest(SocketIoBaseTest):
    def test_no_user_cookies(self):
        request = DummyRequest(xsrf=self.xsrf)
        try:
            EdtrRouter.create_session(request)
            self.sleep()
            self.fail('Session is created without cookies')
        except HTTPError as e:
            self.assertEqual(e.status_code, 403)
            self.assertEqual(e.log_message, SocketError.NO_COOKIE)

    def test_no_xsrf(self):
        request = DummyRequest(cookies=self.cookies)
        try:
            EdtrRouter.create_session(request)
            self.sleep()
            self.fail('Session is created without xsrf argument')
        except HTTPError as e:
            self.assertEqual(e.status_code, 403)
            self.assertEqual(e.log_message, SocketError.XSRF)

    def test_good_user_open_socket_pass(self):
        try:
            EdtrRouter.create_session(self.request)
            self.sleep()
        except HTTPError as e:
            self.fail("Session not created for good user.\
                status_code = {0}, err = '{1}'.".format(
                    e.status_code, e.log_message))
