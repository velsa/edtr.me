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
from models.dropbox import PS


def get_fetched_http_client(test_instance, meta):
    def fetch_mock(request, callback, **kwargs):
        if not isinstance(request, HTTPRequest):
            request = HTTPRequest(url=request, **kwargs)
        request.headers = HTTPHeaders(request.headers)
        if "api.dropbox.com/1/fileops/delete" in request.url and\
          test_instance.file_path in urlparse.parse_qs(request.body)['path'][0]:
            deleted_meta = dict(meta)
            deleted_meta["is_deleted"] = True
            dbox_resp = json.dumps(deleted_meta)
        else:
            test_instance.assertTrue(False)
            callback(None)
            return
        output = cStringIO.StringIO()
        output.write(dbox_resp)
        resp = HTTPResponse(request=request, code=200, buffer=output)
        callback(resp)
    return fetch_mock


def create_published_file(file_path, user_name, folder_type, content=None):
    file_path = os.path.join(
        get_user_root(user_name, folder_type), file_path.lstrip('/'))
    file_folder = os.path.dirname(file_path)
    if not os.path.exists(file_folder):
        os.makedirs(file_folder)
    if content is None:
        content = u"content of {0}\n".format(file_path)
    with open(file_path, 'w') as f:
        f.write(content)
    return file_path


class DeleteBaseTest(BaseTest):
    def check_file_meta_is_deleted(self, file_path):
        file_gone = self.db_find_one(self.test_user_name, {'_id': file_path})
        self.assertEqual(file_gone, None)


class DeleteTest(DeleteBaseTest):
    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_delete_simple_text_file(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.file_path = '/some_file.txt'

        meta = json.loads(
            get_dbox_meta(self.file_path, TF.text, with_path=False))
        meta_db, _ = _adopt_meta(meta, separate_id=False)
        self.db_save(self.test_user_name, meta_db)

        m_fetch.side_effect = get_fetched_http_client(self, meta)

        response = self.post_with_xsrf(
            self.reverse_url('dropbox_delete'), {'path': self.file_path})
        self.check_json_response(response)
        self.check_file_meta_is_deleted(self.file_path)

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

        m_fetch.side_effect = get_fetched_http_client(self, meta)

        response = self.post_with_xsrf(
            self.reverse_url('dropbox_delete'), {'path': self.file_path})
        self.check_json_response(response)
        self.check_file_meta_is_deleted(self.file_path)
        self.assertFalse(os.path.exists(self.thumb_serv_path))

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_delete_published_file(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.file_path = '/some_file.md'

        meta = json.loads(
            get_dbox_meta(self.file_path, TF.md, with_path=False))

        meta_db, _ = _adopt_meta(meta, separate_id=False)
        meta_db['pub_status'] = PS.published
        meta_db['pub_rev'] = 1
        self.db_save(self.test_user_name, meta_db)

        preview_file_path = create_published_file(self.file_path,
             self.test_user_name, FolderType.preview_content)
        published_file_path = create_published_file(self.file_path,
            self.test_user_name, FolderType.publish_content)

        self.assertTrue(os.path.exists(preview_file_path))
        self.assertTrue(os.path.exists(published_file_path))

        m_fetch.side_effect = get_fetched_http_client(self, meta)

        response = self.post_with_xsrf(
            self.reverse_url('dropbox_delete'), {'path': self.file_path})
        self.check_json_response(response)
        self.check_file_meta_is_deleted(self.file_path)

        self.assertFalse(os.path.exists(preview_file_path))
        self.assertFalse(os.path.exists(published_file_path))

    @patch.object(BaseHandler, 'get_current_user')
    @patch.object(SimpleAsyncHTTPClient, 'fetch')
    def test_delete_folder_with_published_files(self, m_fetch, m_get_current_user):
        self.create_test_user(m_get_current_user)
        self.folder_path = '/some_folder'
        self.file_paths = map(lambda p: "/".join((self.folder_path, p)),
            ['file1.md', 'file2.md', 'file3.md'])
        self.published_file_paths = []
        self.previewed_file_paths = []

        folder_meta = json.loads(
            get_dbox_meta(self.folder_path, TF.folder, with_path=False))
        meta_db, _ = _adopt_meta(folder_meta, separate_id=False)
        self.db_save(self.test_user_name, meta_db)

        for count, file_path in enumerate(self.file_paths):
            meta = json.loads(
                get_dbox_meta(file_path, TF.md, with_path=False))

            meta_db, _ = _adopt_meta(meta, separate_id=False)
            meta_db['pub_status'] = PS.draft
            preview_file_path = create_published_file(file_path,
                 self.test_user_name, FolderType.preview_content)
            self.previewed_file_paths.append(preview_file_path)
            if count != 0:
                meta_db['pub_status'] = PS.published
                meta_db['pub_rev'] = 1
                published_file_path = create_published_file(file_path,
                    self.test_user_name, FolderType.publish_content)
                self.published_file_paths.append(published_file_path)
            self.db_save(self.test_user_name, meta_db)

        for pub_path in self.published_file_paths:
            self.assertTrue(os.path.exists(pub_path))
        for prew_path in self.previewed_file_paths:
            self.assertTrue(os.path.exists(prew_path))

        def fetch_mock(request, callback, **kwargs):
            if not isinstance(request, HTTPRequest):
                request = HTTPRequest(url=request, **kwargs)
            request.headers = HTTPHeaders(request.headers)
            # import pdb; pdb.set_trace()
            if "api.dropbox.com/1/fileops/delete" in request.url and\
              self.folder_path in urlparse.parse_qs(request.body)['path'][0]:
                deleted_meta = dict(folder_meta)
                deleted_meta["is_deleted"] = True
                dbox_resp = json.dumps(deleted_meta)
            elif "api.dropbox.com/1/delta" in request.url:
                delta_ret_data = []
                for f_p in self.file_paths:
                    delta_ret_data.append({'type': None, 'path': f_p})
                delta_ret_data.append({'type': None, 'path': self.folder_path})
                dbox_resp = dbox_delta(delta_ret_data, cursor="cursor")
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
            self.reverse_url('dropbox_delete'), {'path': self.folder_path})
        self.check_json_response(response)

        for f_p in self.file_paths:
            self.check_file_meta_is_deleted(f_p)

        for pub_path in self.published_file_paths:
            self.assertFalse(os.path.exists(pub_path))

        for prew_path in self.previewed_file_paths:
            self.assertFalse(os.path.exists(prew_path))
