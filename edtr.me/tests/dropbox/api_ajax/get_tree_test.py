import os.path
from django.utils import simplejson as json

from tornado.simple_httpclient import SimpleAsyncHTTPClient

from tests.lib.mock import patch
from tests.base import BaseTest
from handlers.base import BaseHandler
from workers.dropbox.thumb import _get_thumbnail_serv_path, _get_thumb_url
from utils.main import get_user_root, FolderType
from tests.dropbox.dbox_test_data import dbox_delta, TF, fetch_mock_base


class GetTreeTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')  # all requests are mocked
    def test_simple_root_call(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)

        def fetch_mock(request, callback, **kwargs):
            dbox_resp = dbox_delta([
                {'type': TF.folder, 'path': '/dir_1'},
                {'type': TF.text, 'path': '/1.txt'},
            ], cursor="cursor")
            fetch_mock_base(request, callback, dbox_resp, **kwargs)

        m_fetch.side_effect = fetch_mock
        response = self.post_with_xsrf(
            self.reverse_url('dropbox_get_path'), {'path': '/'})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        self.assertEqual(set(['/dir_1', '/1.txt']), set(json_resp['tree'].keys()))
        dir_meta_params = set(["revision", "rev", "thumb_exists", "bytes",
            "modified", "_id", "root_path", "is_dir", "icon", "root", "size"])
        self.assertEqual(dir_meta_params, set(json_resp['tree']['/dir_1'].keys()))
        file_meta_params = set(["_id", "revision", "rev", "thumb_exists",
            "modified", "client_mtime", "root_path", "is_dir", "icon", "root",
            "mime_type", "bytes", "size"])
        self.assertEqual(file_meta_params, set(json_resp['tree']['/1.txt'].keys()))
        # thumb path not created, because not images in dropbox
        thumb_folder = get_user_root(self.test_user_name, FolderType.thumbnail)
        self.assertFalse(os.path.exists(thumb_folder))

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_one_thumbnail(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)

        self.thumbnail_calls = 0
        self.img_bin_content = "image binary content"
        self.img_path = '/pic.png'

        def fetch_mock(request, callback, **kwargs):
            if "api.dropbox.com/1/delta" in request:
                dbox_resp = dbox_delta([
                    {'type': TF.image_png, 'path': self.img_path},
                ], cursor="cursor")
            else:
                global thumbnail_calls
                self.thumbnail_calls += 1
                dbox_resp = self.img_bin_content
            fetch_mock_base(request, callback, dbox_resp, **kwargs)
        m_fetch.side_effect = fetch_mock

        response = self.post_with_xsrf(
            self.reverse_url('dropbox_get_path'), {'path': '/'})
        self.assertEqual(response.code, 200)
        json_resp = json.loads(response.body)
        self.assertEqual(json_resp['errcode'], 0)
        self.assertEqual(self.thumbnail_calls, 1)
        thumb_path, thumb_name = _get_thumbnail_serv_path(
            self.img_path, self.test_user_name)
        self.assertTrue(os.path.exists(thumb_path))
        with open(thumb_path) as f:
            self.assertEqual(f.read(), self.img_bin_content)
        self.assertEqual(set([self.img_path]), set(json_resp['tree'].keys()))
        self.assertEqual(json_resp['tree'][self.img_path]['thumbnail_url'],
            _get_thumb_url(thumb_name, self.test_user_name))
