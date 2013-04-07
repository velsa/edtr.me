# -*- coding: utf-8 -*-
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


class PublishTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_publish_existing_text_no_md_meta(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.text_content = """## Hello"""
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

        response = self.post_with_xsrf(self.reverse_url('dropbox_publish'),
            {'path': self.dbox_path, 'content': self.text_content})
        json_resp = self.check_json_response(response)
        file_meta_params = set(["_id", "revision", "rev", "pub_rev",
            "thumb_exists", "modified", "client_mtime", "root_path", "is_dir",
             "icon", "root", "mime_type", "bytes", "size", 'pub_status'])
        self.assertEqual(file_meta_params, set(json_resp['meta'].keys()))
        self.assertEqual(json_resp['meta']['revision'], self.updated_revision)
        self.assertEqual(json_resp['meta']['rev'], self.updated_rev)
        self.assertEqual(json_resp['meta']['pub_status'], PS.published)
        md_meta = u"Status:            published\n\n"
        self.assertEqual(json_resp['markdown_meta'], md_meta)
        text_updated_heads = md_meta + self.text_content
        self.check_pub_md_content(text_updated_heads, publish=False)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_publish_existing_non_text(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.bin_content = """bin content"""
        self.dbox_path = '/binfile.bin'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.binary, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.db_save(self.test_user_name, meta_db)

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            headers = None
            if "api-content.dropbox.com/1/files/" in request.url and\
              self.dbox_path in request.url:
                dbox_resp = self.bin_content
                headers = {
                    'X-Dropbox-Metadata': json.dumps(meta),
                    'Content-Type': 'text/plain; charset=UTF-8',
                }
            else:
                self.assertTrue(False)
                callback(None)
                return
            output = cStringIO.StringIO()
            output.write(dbox_resp)
            resp = HTTPResponse(request=request, code=200, buffer=output)
            if headers:
                resp.headers = headers
            callback(resp)
        m_fetch.side_effect = fetch_mock

        response = self.post_with_xsrf(self.reverse_url('dropbox_publish'),
            {'path': self.dbox_path})
        json_resp = self.check_json_response(response)
        file_meta_params = set(["_id", "revision", "rev", "pub_rev",
            "thumb_exists", "modified", "client_mtime", "root_path", "is_dir",
             "icon", "root", "mime_type", "bytes", "size", 'pub_status'])
        self.assertEqual(file_meta_params, set(json_resp['meta'].keys()))
        self.assertEqual(json_resp['meta']['revision'], meta['revision'])
        self.assertEqual(json_resp['meta']['rev'], meta['rev'])
        self.assertEqual(json_resp['meta']['pub_status'], PS.published)
        self.check_pub_md_content(
            content=self.bin_content, encoding=None, publish=True)
