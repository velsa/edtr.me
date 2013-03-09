import os.path
import cStringIO
from lib.mock import patch
from django.utils import simplejson as json

from tornado.simple_httpclient import SimpleAsyncHTTPClient
from tornado.httpclient import HTTPResponse, HTTPRequest
from tornado.httputil import HTTPHeaders

from base import BaseTest
from handlers.base import BaseHandler
from workers.dropbox.thumb import _get_thumbnail_serv_path, _get_thumb_url
from utils.main import get_user_root, FolderType


class TF:
    folder = 0
    text = "text/plain"
    md = 2
    css = 3
    js = 4
    html = 5
    binary = 6
    image_png = "image/png"


def get_dbox_meta(path, o_type):
    if o_type == TF.folder:
        return """[
          "{path}",
          {{
            "revision": 3,
            "rev": "30c3bcb59",
            "thumb_exists": false,
            "bytes": 0,
            "modified": "Tue, 22 Jan 2013 13:58:23 +0000",
            "path": "{path}",
            "is_dir": true,
            "icon": "folder_app",
            "root": "app_folder",
            "size": "0 bytes"
          }}
        ]""".format(path=path)
    elif o_type == TF.text:
        return """[
          "{path}",
          {{
            "revision": 10,
            "rev": "a0c3bcb59",
            "thumb_exists": false,
            "bytes": 7,
            "modified": "Tue, 22 Jan 2013 13:59:04 +0000",
            "client_mtime": "Tue, 22 Jan 2013 13:58:53 +0000",
            "path": "{path}",
            "is_dir": false,
            "icon": "page_white_text",
            "root": "app_folder",
            "mime_type": "{f_type}",
            "size": "7 bytes"
          }}
        ]""".format(path=path, f_type=o_type)
    elif o_type == TF.image_png:
        return """[
          "{path}",
          {{
            "revision": 1,
            "rev": "10c3bcb59",
            "thumb_exists": true,
            "bytes": 433201,
            "modified": "Mon, 21 Jan 2013 17:46:27 +0000",
            "client_mtime": "Thu, 04 Oct 2012 09:33:45 +0000",
            "path": "{path}",
            "is_dir": false,
            "icon": "page_white_picture",
            "root": "app_folder",
            "mime_type": "{f_type}",
            "size": "423 KB"
          }}
        ]""".format(path=path, f_type=o_type)


def dbox_delta(objs, cursor, reset=False, has_more=False):
    meta_list = []
    for obj in objs:
        meta_list.append(get_dbox_meta(obj['path'], obj['type']))
    return """
        {{
          "reset": {reset},
          "cursor": "{cursor}",
          "has_more": {has_more},
          "entries": [
        {entries}
          ]
        }}
    """.format(
        cursor=cursor,
        reset='true' if reset else 'false',
        has_more='true' if reset else 'false',
        entries=",".join(meta_list))


class GetTreeTest(BaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')  # all requests are mocked
    def test_simple_root_call(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            dbox_resp = dbox_delta([
                {'type': TF.folder, 'path': '/dir_1'},
                {'type': TF.text, 'path': '/1.txt'},
            ], cursor="cursor")
            output = cStringIO.StringIO()
            output.write(dbox_resp)
            resp = HTTPResponse(request=request, code=200, buffer=output)
            callback(resp)
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
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            output = cStringIO.StringIO()
            if "api.dropbox.com/1/delta" in request.url:
                dbox_resp = dbox_delta([
                    {'type': TF.image_png, 'path': self.img_path},
                ], cursor="cursor")
            else:
                global thumbnail_calls
                self.thumbnail_calls += 1
                dbox_resp = self.img_bin_content
            output.write(dbox_resp)
            resp = HTTPResponse(request=request, code=200, buffer=output)
            callback(resp)
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
