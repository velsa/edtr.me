import os.path
import cStringIO
from django.utils import simplejson as json

from tornado.simple_httpclient import SimpleAsyncHTTPClient
from tornado.httpclient import HTTPResponse, HTTPRequest
from tornado.httputil import HTTPHeaders

from tests.lib.mock import patch
from tests.base import BaseTest
from tests.dropbox.dbox_test_data import TF, get_dbox_meta
from handlers.base import BaseHandler
from models.dropbox import PS
from workers.dropbox.dbox_utils import _adopt_meta
from utils.main import get_user_root, FolderType


class SaveFileTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_update_existing(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.text_content = '## Hello'
        self.dbox_path = '/post.md'
        self.updated_revision = 100
        self.updated_rev = 'd0c3bdw93'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.md, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.db_save(self.test_user_name, meta_db)

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            if "api-content.dropbox.com/1/files_put/" in request.url and\
              self.dbox_path in request.url:
                meta['revision'] = self.updated_revision
                meta['rev'] = self.updated_rev
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
            self.reverse_url('dropbox_save_file'),
            {'path': self.dbox_path, 'content': self.text_content})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        file_meta_params = set(["_id", "revision", "rev", "thumb_exists",
            "modified", "client_mtime", "root_path", "is_dir", "icon", "root",
            "mime_type", "bytes", "size", 'pub_status'])
        self.assertEqual(file_meta_params, set(json_resp['meta'].keys()))
        self.assertEqual(json_resp['meta']['revision'], self.updated_revision)
        self.assertEqual(json_resp['meta']['rev'], self.updated_rev)
        self.assertEqual(json_resp['meta']['pub_status'], PS.draft)
        # TODO: check, post is generated, not just copied
        copied_file = os.path.join(
            get_user_root(self.test_user_name, FolderType.preview),
            self.dbox_path.lstrip('/'))
        self.assertTrue(os.path.exists(copied_file))
        with open(copied_file) as f:
            self.assertEqual(f.read(), self.text_content)
