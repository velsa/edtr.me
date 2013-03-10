# -*- coding: utf-8 -*-
import logging
from tornado import gen
from datetime import datetime

import pytz
import motor
from schematics.serialize import make_safe_python, to_python
from django.utils import simplejson as json

from utils.error import ErrCode
from models.dropbox import DropboxFile
from .dbox_utils import (unify_path, get_file_url, check_bad_response,
    update_meta, get_content_type)
from .dbox_settings import DROPBOX_ENCODE_MAP, ContentType
logger = logging.getLogger('edtr_logger')


@gen.engine
def get_tree_from_db(path, user, db, recurse=False, callback=None):
    if recurse:
        callback({'errcode': ErrCode.not_implemented})
    else:
        path = unify_path(path)
        cursor = db[user.name].find({"root_path": path},
            fields=DropboxFile.public_exclude_fields())
        files = yield motor.Op(cursor.to_list, DropboxFile.FIND_LIST_LEN)
        files_tree = {}
        for f in files:
            files_tree[f['_id']] = f
        result = {'errcode': ErrCode.ok, 'tree': files_tree}
        if len(files) == DropboxFile.FIND_LIST_LEN:
            result['has_more'] = True
            logger.debug(u"FIND_LIST_LEN reached for user '{0}',"
                " path '{1}".format(user.name, path))
        callback(result)


def _get_response_encoding(response):
    encoding = 'ascii'
    cont_type = response.headers.get('Content-Type', None)
    if cont_type:
        for v in cont_type.split(';'):
            if 'charset=' in v:
                encoding = v.split('=', 1)[-1]
                encoding = DROPBOX_ENCODE_MAP.get(encoding, encoding)
                break
    return encoding


@gen.engine
def get_obj_content(file_meta, user, db, async_dbox, for_publish=False,
                                                     rev=None, callback=None):
    path = file_meta.path
    content_type = get_content_type(file_meta)
    content = None
    if content_type == ContentType.directory:
        callback({'errcode': ErrCode.bad_request})
    elif content_type == ContentType.text_file or for_publish:
        # make dropbox request
        api_url = get_file_url(path, 'files')
        access_token = user.get_dropbox_token()
        if rev:
            response = yield gen.Task(async_dbox.dropbox_request,
                "api-content", api_url,
                access_token=access_token,
                rev=rev)
        else:
            response = yield gen.Task(async_dbox.dropbox_request,
                "api-content", api_url,
                access_token=access_token)
        if check_bad_response(response, callback):
            return
        if for_publish:
            meta_ser = to_python(file_meta)
        else:
            # Skip black list fields
            meta_ser = make_safe_python(DropboxFile, file_meta, 'public')
        if not rev:
            meta_dbox = json.loads(response.headers['X-Dropbox-Metadata'])
            # TODO when called from publish, update_meta can be done later
            meta_dict = yield gen.Task(update_meta, db, meta_dbox, user.name)
            # update fields, that will be return to client
            if for_publish:
                meta_ser.update(meta_dict)
            else:
                # Skip black list fields
                for f in meta_dict:
                    if f in meta_ser:
                        meta_ser[f] = meta_dict[f]
        if content_type == ContentType.text_file:
            encoding = _get_response_encoding(response)
            content = response.body.decode(encoding, 'replace')
            content_type = ContentType.text_file
        else:
            content = response.body
    else:
        url_trans, url_expires = None, None
        # check, if saved media url is already saved and not expired
        expires = file_meta.get_url_expires()
        now = pytz.UTC.localize(datetime.utcnow())
        if file_meta.url_trans and expires and expires > now:
            url_trans = file_meta.url_trans
            url_expires = file_meta.url_expires
        else:
            # make dropbox request
            access_token = user.get_dropbox_token()
            api_url = get_file_url(path, 'media')
            post_args = {}
            response = yield gen.Task(async_dbox.dropbox_request,
                "api", api_url,
                access_token=access_token,
                post_args=post_args)
            if check_bad_response(response, callback):
                return
            dbox_media_url = json.loads(response.body)
            url_trans = dbox_media_url['url']
            url_expires = dbox_media_url['expires']
            file_meta.url_trans = url_trans
            file_meta.set_url_expires(url_expires)
            yield motor.Op(file_meta.update, db, collection=user.name)
        content = url_trans
        meta_ser = make_safe_python(DropboxFile, file_meta, 'public')
    # TODO: check file size and reject, if it big.
    # TODO: maybe use chunk download like this:
    # http://codingrelic.geekhold.com/2011/10/tornado-httpclient-chunked-downloads.html
    callback({
        'errcode': ErrCode.ok,
        'type': content_type,
        'content': content,
        'meta': meta_ser,
    })
