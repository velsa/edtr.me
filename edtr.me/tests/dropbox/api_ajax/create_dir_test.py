import cStringIO
from django.utils import simplejson as json
import urlparse

from tornado.simple_httpclient import SimpleAsyncHTTPClient
from tornado.httpclient import HTTPResponse, HTTPRequest
from tornado.httputil import HTTPHeaders

from tests.lib.mock import patch
from tests.base import BaseTest
from tests.dropbox.dbox_test_data import TF, get_dbox_meta
from handlers.base import BaseHandler


class CreateDirTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_create_dir(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.dir_path = '/some_dir'

        meta = json.loads(
            get_dbox_meta(self.dir_path, TF.folder, with_path=False))

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            if "api.dropbox.com/1/fileops/create_folder" in request.url and\
              self.dir_path in urlparse.parse_qs(request.body)['path'][0]:
                dbox_resp = json.dumps(meta)
            else:
                self.assertTrue(False)
                callback(None)
                return
            output = cStringIO.StringIO()
            output.write(dbox_resp)
            resp = HTTPResponse(request=request, code=200, buffer=output)
            callback(resp)
        m_fetch.side_effect = fetch_mock

        response = self.post_with_xsrf(
            self.reverse_url('dropbox_create_dir'), {'path': self.dir_path})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        meta_params = set(["_id", "revision", "rev", "thumb_exists",
          "modified", "root_path", "is_dir", "icon", "root", "bytes", "size"])
        self.assertEqual(meta_params, set(json_resp['meta'].keys()))
        self.assertTrue(json_resp['meta']['is_dir'])
