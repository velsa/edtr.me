import cStringIO

from tornado.httpclient import HTTPResponse, HTTPRequest
from tornado.httputil import HTTPHeaders


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
