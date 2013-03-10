import cStringIO
from django.utils import simplejson as json

from tornado.simple_httpclient import SimpleAsyncHTTPClient
from tornado.httpclient import HTTPResponse, HTTPRequest
from tornado.httputil import HTTPHeaders

from tests.lib.mock import patch
from tests.base import BaseTest
from handlers.base import BaseHandler
from workers.dropbox.dbox_utils import _adopt_meta
from workers.dropbox.dbox_settings import ContentType
from tests.dropbox.dbox_test_data import TF, get_dbox_meta


class GetContentTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_text_content(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.text_content = 'text text text'
        self.dbox_path = '/1.txt'
        self.updated_revision = 100

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.text, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.db_save(self.test_user_name, meta_db)

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            if "api-content.dropbox.com/1/files/" in request.url and\
              self.dbox_path in request.url:
                dbox_resp = self.text_content
                meta['revision'] = self.updated_revision
                headers = {'X-Dropbox-Metadata': json.dumps(meta)}
            else:
                self.assertTrue(False)
                callback(None)
                return
            output = cStringIO.StringIO()
            output.write(dbox_resp)
            resp = HTTPResponse(request=request, headers=headers, code=200,
                buffer=output)
            callback(resp)
        m_fetch.side_effect = fetch_mock

        response = self.post_with_xsrf(
            self.reverse_url('dropbox_get_file'), {'path': self.dbox_path})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        self.assertEqual(json_resp['type'], ContentType.text_file)
        self.assertEqual(json_resp['content'], self.text_content)
        file_meta_params = set(["_id", "revision", "rev", "thumb_exists",
            "modified", "client_mtime", "root_path", "is_dir", "icon", "root",
            "mime_type", "bytes", "size"])
        self.assertEqual(file_meta_params, set(json_resp['meta'].keys()))
        self.assertEqual(json_resp['meta']['revision'], self.updated_revision)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_image_content(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.dbox_image_url = 'http://www.dropbox.com/s/m/a2mbDa2'
        self.dbox_path = '/pic.png'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.image_png, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        meta_db['thumbnail_url'] = 'http://linktothumb.png'
        self.db_save(self.test_user_name, meta_db)

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            if "api.dropbox.com/1/media/" in request.url and\
              self.dbox_path in request.url:
                dbox_resp = json.dumps({
                    'url': self.dbox_image_url,
                    'expires': 'Sun, 16 Sep 2040 01:01:25 +0000'
                })
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
            self.reverse_url('dropbox_get_file'), {'path': self.dbox_path})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        self.assertEqual(json_resp['type'], ContentType.image)
        self.assertEqual(json_resp['content'], self.dbox_image_url)
        file_meta_params = set(["_id", "revision", "rev", "thumb_exists",
            "modified", "client_mtime", "root_path", "is_dir", "icon", "root",
            "mime_type", "bytes", "size", "thumbnail_url"])
        self.assertEqual(file_meta_params, set(json_resp['meta'].keys()))

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_binary_content(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.dbox_video_url = 'http://www.dropbox.com/s/m/a2mbDa2'
        self.dbox_path = '/vidos.mp4'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.video_mp4, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.db_save(self.test_user_name, meta_db)

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            if "api.dropbox.com/1/media/" in request.url and\
              self.dbox_path in request.url:
                dbox_resp = json.dumps({
                    'url': self.dbox_video_url,
                    'expires': 'Sun, 16 Sep 2040 01:01:25 +0000'
                })
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
            self.reverse_url('dropbox_get_file'), {'path': self.dbox_path})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        self.assertEqual(json_resp['type'], ContentType.binary)
        self.assertEqual(json_resp['content'], self.dbox_video_url)
        file_meta_params = set(["_id", "revision", "rev", "thumb_exists",
            "modified", "client_mtime", "root_path", "is_dir", "icon", "root",
            "mime_type", "bytes", "size"])
        self.assertEqual(file_meta_params, set(json_resp['meta'].keys()))
