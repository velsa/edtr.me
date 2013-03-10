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
from workers.dropbox.dbox_utils import _adopt_meta
from workers.dropbox.dbox_settings import ContentType


class TF:
    folder = 0
    text = "text/plain"
    md = 2
    css = 3
    js = 4
    html = 5
    binary = "application/x-msdos-program"
    image_png = "image/png"
    video_mp4 = "video/mp4"


def get_dbox_meta(path, o_type, with_path=True):
    if o_type == TF.folder:
        meta_data = """
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
          """.format(path=path)
    elif o_type == TF.text:
        meta_data = """
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
          }}""".format(path=path, f_type=o_type)
    elif o_type == TF.image_png:
        meta_data = """
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
          }}""".format(path=path, f_type=o_type)
    elif o_type == TF.binary:
        meta_data = """
          {{
            "revision": 1134,
            "rev": "46e0c3bcb59",
            "thumb_exists": false,
            "bytes": 7168,
            "modified": "Sun, 10 Mar 2013 08:29:21 +0000",
            "client_mtime": "Sat, 09 Mar 2013 13:01:01 +0000",
            "path": "{path}",
            "is_dir": false,
            "icon": "page_white_gear",
            "root": "app_folder",
            "mime_type": "{f_type}",
            "size": "7 KB"
          }}""".format(path=path, f_type=o_type)
    elif o_type == TF.video_mp4:
        meta_data = """
          {{
            "revision": 1136,
            "rev": "4700c3bcb59",
            "thumb_exists": false,
            "bytes": 554672,
            "modified": "Sun, 10 Mar 2013 08:38:15 +0000",
            "client_mtime": "Mon, 18 Oct 2010 09:14:42 +0000",
            "path": "{path}",
            "is_dir": false,
            "icon": "page_white_film",
            "root": "app_folder",
            "mime_type": "{f_type}",
            "size": "541.7 KB"
          }}""".format(path=path, f_type=o_type)
    if with_path:
        meta_data = """[
          "{path}",
          {meta}
        ]""".format(path=path, meta=meta_data)
    return meta_data


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


def fetch_mock_base(request, callback, dbox_resp, **kwargs):
    if not isinstance(request, HTTPRequest):
        request = HTTPRequest(url=request, **kwargs)
    request.headers = HTTPHeaders(request.headers)
    output = cStringIO.StringIO()
    output.write(dbox_resp)
    resp = HTTPResponse(request=request, code=200, buffer=output)
    callback(resp)


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
