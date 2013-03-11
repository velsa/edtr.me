import re
import Cookie
from base import BaseTest

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


class SocketIoBaseTest(BaseTest):
    def sleep(self, seconds=SECONDS_FOR_DB):
        super(SocketIoBaseTest, self).sleep(seconds=seconds)

    def setUp(self):
        super(SocketIoBaseTest, self).setUp()
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
