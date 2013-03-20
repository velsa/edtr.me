import os
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
from workers.dropbox.dbox_utils import _adopt_meta
from workers.dropbox.thumb import _get_thumbnail_serv_path, _get_thumb_url
from utils.main import get_user_root, FolderType


class DeleteTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_delete_simple_text_file(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.file_path = '/some_file.txt'

        meta = json.loads(
            get_dbox_meta(self.file_path, TF.text, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.db_save(self.test_user_name, meta_db)

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            if "api.dropbox.com/1/fileops/delete" in request.url and\
              self.file_path in urlparse.parse_qs(request.body)['path'][0]:
                deleted_meta = dict(meta)
                deleted_meta["is_deleted"] = True
                dbox_resp = json.dumps(deleted_meta)
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
            self.reverse_url('dropbox_delete'), {'path': self.file_path})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        file_gone = self.db_find_one(self.test_user_name, {'_id': self.file_path})
        self.assertEqual(file_gone, None)

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_delete_image_with_thumb(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.file_path = '/image.png'

        meta = json.loads(
            get_dbox_meta(self.file_path, TF.image_png, with_path=False))
        self.thumb_serv_path, self.thumb_serv_name = _get_thumbnail_serv_path(
            self.file_path, self.test_user_name)
        meta_db = dict(meta)
        meta_db['thumbnail_url'] = _get_thumb_url(
            self.thumb_serv_name, self.test_user_name)
        meta_db, _ = _adopt_meta(meta_db, separate_id=False)
        self.db_save(self.test_user_name, meta_db)

        thumb_folder = get_user_root(self.test_user_name, FolderType.thumbnail)
        os.makedirs(thumb_folder)
        with open(self.thumb_serv_path, 'wb') as f:
            f.write('thumb bin content')

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            if "api.dropbox.com/1/fileops/delete" in request.url and\
              self.file_path in urlparse.parse_qs(request.body)['path'][0]:
                deleted_meta = dict(meta)
                deleted_meta["is_deleted"] = True
                dbox_resp = json.dumps(deleted_meta)
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
            self.reverse_url('dropbox_delete'), {'path': self.file_path})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        file_gone = self.db_find_one(self.test_user_name, {'_id': self.file_path})
        self.assertEqual(file_gone, None)
        self.assertFalse(os.path.exists(self.thumb_serv_path))

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_delete_published_file(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        # TODO
        self.assertTrue(False)
