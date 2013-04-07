# -*- coding: utf-8 -*-
import os
import cStringIO
from django.utils import simplejson as json
import urlparse

from tornado.simple_httpclient import SimpleAsyncHTTPClient
from tornado.httpclient import HTTPResponse, HTTPRequest
from tornado.httputil import HTTPHeaders

from tests.lib.mock import patch
from tests.base import BaseTest
from tests.dropbox.dbox_test_data import TF, get_dbox_meta, dbox_delta
from handlers.base import BaseHandler
from workers.dropbox.dbox_utils import _adopt_meta
from workers.dropbox.thumb import _get_thumbnail_serv_path, _get_thumb_url
from utils.main import get_user_root, FolderType


class CopyTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_copy_text_file(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.text_content = """Just text"""
        self.from_path = '/simple.txt'
        self.to_path = '/copied_simple.txt'

        meta_from = json.loads(
            get_dbox_meta(self.from_path, TF.text, with_path=False))
        meta_from_db, _ = _adopt_meta(meta_from, separate_id=False)
        self.db_save(self.test_user_name, meta_from_db)

        meta_to = json.loads(
            get_dbox_meta(self.to_path, TF.text, with_path=False))

        self.move_call_count = 0
        self.get_tree_call_count = 0

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            params = urlparse.parse_qs(request.body)
            if "api.dropbox.com/1/fileops/copy" in request.url and\
              self.from_path in params['from_path'][0] and\
              self.to_path in params['to_path'][0]:
                dbox_resp = json.dumps(meta_to)
                self.move_call_count += 1
            elif "api.dropbox.com/1/delta" in request.url:
                dbox_resp = dbox_delta([
                    {'type': TF.text, 'path': self.to_path},
                ], cursor="cursor")
                self.get_tree_call_count += 1
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
            self.reverse_url('dropbox_copy'),
            {'from_path': self.from_path, 'to_path': self.to_path})
        self.assertEqual(response.code, 200)

        self.assertEqual(self.move_call_count, 1)
        self.assertEqual(self.get_tree_call_count, 1)

        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        file_meta_params = set(["_id", "revision", "rev", "thumb_exists",
            "modified", "client_mtime", "root_path", "is_dir", "icon", "root",
            "mime_type", "bytes", "size"])
        self.assertEqual(file_meta_params, set(json_resp['meta'].keys()))
        self.assertEqual(json_resp['meta']['_id'], self.to_path)

        from_meta_in_db = self.db_find_one(
            self.test_user_name, {'_id': self.from_path})
        self.assertEqual(from_meta_in_db['_id'], self.from_path)

        to_meta_in_db = self.db_find_one(
            self.test_user_name, {'_id': self.to_path})
        self.assertEqual(to_meta_in_db['_id'], self.to_path)
