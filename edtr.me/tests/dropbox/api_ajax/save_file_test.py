# -*- coding: utf-8 -*-
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
from workers.dropbox.dbox_settings import MdState
from utils.main import get_user_root, FolderType


class SaveFileTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_update_existing_no_md_meta(self, m_fetch, m_get_current_user):
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
        md_meta = u"Status:            draft\n\n"
        self.assertEqual(json_resp['markdown_meta'], md_meta)
        text_updated_heads = md_meta + self.text_content
        self.check_preview_content(text_updated_heads)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_update_existing_with_md_meta(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.md_meta = """Author:           Vels
Title:            Documentation on metadata
Status:           {0}
Slug:             edtr-meta-docs
Tags:             edtr, work, ideas
HeaderAnchors:    2,3
Style:            github
DatePublished:    2012-1-1
DateModified:     2012-1-3 21:33
DateFormat:       %B %e, %Y
SingleValue:      2
EmptyValue:      
EEmptyValue:

"""
        self.no_head_content = """## Hello"""
        self.text_content = self.md_meta + self.no_head_content
        self.dbox_path = '/post.md'
        self.updated_revision = 100
        self.updated_rev = 'd0c3bdw93'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.md, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.rev_first = meta_db['rev']
        meta_db['pub_rev'] = self.rev_first
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
            {
                'path': self.dbox_path,
                'content': self.text_content.format(MdState.published)
            })
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        file_meta_params = set(["_id", "revision", "rev", "thumb_exists",
            "modified", "client_mtime", "root_path", "is_dir", "icon", "root",
            "mime_type", "bytes", "size", 'pub_status', 'pub_rev'])
        self.assertEqual(file_meta_params, set(json_resp['meta'].keys()))
        self.assertEqual(json_resp['meta']['revision'], self.updated_revision)
        self.assertEqual(json_resp['meta']['rev'], self.updated_rev)
        self.assertEqual(json_resp['meta']['pub_status'], PS.draft)
        self.assertEqual(json_resp['meta']['pub_rev'], self.rev_first)
        updated_md_meta = self.md_meta.format(MdState.draft)
        self.assertEqual(json_resp['markdown_meta'], updated_md_meta)
        text_updated_heads = updated_md_meta + self.no_head_content
        self.check_preview_content(text_updated_heads)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_save_new_md_wout_headers(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.text_content = """## Hello

* This is my first post
* Next line"""
        self.dbox_path = '/post.md'
        self.updated_revision = 100
        self.updated_rev = 'd0c3bdw93'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.md, with_path=False))

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
            {
                'path': self.dbox_path,
                'content': self.text_content
            })
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
        md_meta = u"Status:            draft\n\n"
        self.assertEqual(json_resp['markdown_meta'], md_meta)
        text_updated_heads = md_meta + self.text_content
        self.check_preview_content(text_updated_heads)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_update_simple_text_file(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.text_content = """Some regular text"""
        self.dbox_path = '/simple.txt'
        self.updated_revision = 100
        self.updated_rev = 'd0c3bdw93'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.text, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.rev_first = meta_db['rev']
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
            {
                'path': self.dbox_path,
                'content': self.text_content
            })
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
        text_updated_heads = self.text_content
        self.assertFalse('markdown_meta' in json_resp)
        self.check_preview_content(text_updated_heads)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_update_html_file(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.text_content = """Some regular text"""
        self.dbox_path = '/index.html'
        self.updated_revision = 100
        self.updated_rev = 'd0c3bdw93'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.html, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.rev_first = meta_db['rev']
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
            {
                'path': self.dbox_path,
                'content': self.text_content
            })
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
        text_updated_heads = self.text_content
        self.assertFalse('markdown_meta' in json_resp)
        self.check_preview_content(text_updated_heads)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_update_unicode_md_file(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.text_content = u"""Ascii text, юникод текст"""
        self.dbox_path = '/unicode.md'
        self.updated_revision = 100
        self.updated_rev = 'd0c3bdw93'

        meta = json.loads(
            get_dbox_meta(self.dbox_path, TF.md, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.rev_first = meta_db['rev']
        self.db_save(self.test_user_name, meta_db)

        self.get_call_count = 0
        self.save_call_count = 0

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            headers = None
            if "api-content.dropbox.com/1/files_put/" in request.url and\
              self.dbox_path in request.url:
                meta['revision'] = self.updated_revision
                meta['rev'] = self.updated_rev
                dbox_resp = json.dumps(meta)
                self.save_call_count += 1
            elif "api-content.dropbox.com/1/files/" in request.url and\
              self.dbox_path in request.url:
                dbox_resp = self.text_content.encode('utf8')
                meta['revision'] = self.updated_revision
                headers = {
                    'X-Dropbox-Metadata': json.dumps(meta),
                    'Content-Type': 'text/plain; charset=UTF-8',
                }
                self.get_call_count += 1
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

        response = self.post_with_xsrf(
            self.reverse_url('dropbox_get_file'), {'path': self.dbox_path})
        self.assertEqual(response.code, 200)
        json_get_resp = json.loads(response.body)
        self.assertEqual(json_get_resp['content'], self.text_content)

        response = self.post_with_xsrf(
            self.reverse_url('dropbox_save_file'),
            {
                'path': self.dbox_path,
                'content': json_get_resp['content']
            })
        self.assertEqual(response.code, 200)

        self.assertEqual(self.get_call_count, 1)
        self.assertEqual(self.save_call_count, 1)

        json_resp = json.loads(response.body)
        md_meta = u"Status:            draft\n\n"
        self.assertEqual(json_resp['markdown_meta'], md_meta)
        text_updated_heads = md_meta + self.text_content
        self.check_preview_content(text_updated_heads)

    def check_preview_content(self, text_updated_heads):
        # TODO: check, post is generated, not just copied
        md_file_path = os.path.join(
            get_user_root(self.test_user_name, FolderType.preview),
            self.dbox_path.lstrip('/'))
        self.assertTrue(os.path.exists(md_file_path))
        with open(md_file_path) as f:
            self.assertEqual(f.read().decode('utf8'), text_updated_heads)
