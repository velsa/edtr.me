# -*- coding: utf-8 -*-
import logging
import os.path
from hashlib import sha1
from shutil import copyfile

from tornado import gen
from tornado.options import options

from utils.main import get_user_root, FolderType
from models.dropbox import DropboxFile
from .dbox_utils import get_file_url, check_bad_response
from utils.error import ErrCode
from utils.main import create_path_if_not_exist
logger = logging.getLogger('edtr_logger')


def _get_thumbnail_serv_path(im_path, user_name):
    ext = os.path.splitext(im_path)[-1]
    thumb_name = '{0}{1}'.format(
        sha1(im_path.encode('utf8')).hexdigest(),
        ext if ext else ''
    )
    thumb_path = os.path.join(
        get_user_root(user_name, FolderType.thumbnail), thumb_name)
    return thumb_path, thumb_name


def _get_meta_prop(file_meta, prop):
    if isinstance(file_meta, DropboxFile):
        return getattr(file_meta, prop, None)
    else:
        return file_meta.get(prop, None)


def _get_thumb_url(thumb_file_name, user_name):
    if options.local:
        return "file:///{0}".format(os.path.join(
            get_user_root(user_name, FolderType.thumbnail),
            thumb_file_name).replace('\\', '/').lstrip('/'))
    else:
        return "http://thumbnails.{uname}.edtr.me/{fname}".format(
            uname=user_name,
            fname=thumb_file_name)


@gen.engine
def create_thumbnail(file_meta, user, async_dbox, callback):
    path = _get_meta_prop(file_meta, 'path')
    logger.debug(u"Creating thumbnail for user {0}, path {1}".format(user.name, path))
    api_url = get_file_url(path, 'thumbnails')
    access_token = user.get_dropbox_token()
    response = yield gen.Task(async_dbox.dropbox_request,
        "api-content", api_url,
        access_token=access_token,
        size='m')
    if check_bad_response(response, callback):
        return
    thumb_serv_path, thumb_file_name = _get_thumbnail_serv_path(path, user.name)
    create_path_if_not_exist(thumb_serv_path)
    with open(thumb_serv_path, 'wb') as f:
        f.write(response.body)
    thumb_url = _get_thumb_url(thumb_file_name, user.name)
    callback({'errcode': ErrCode.ok, 'thumb_url': thumb_url})


def remove_thumbnail(file_path, user_name):
    thumb_serv_path, _ = _get_thumbnail_serv_path(file_path, user_name)
    logger.debug(u"Deleting thumbnail for user {0}, path {1}".format(
        user_name, thumb_serv_path))
    try:
        os.remove(thumb_serv_path)
    except:
        # TODO process exact exception
        logger.error(
            "Deleting thumbnail exception for user {0}, path {1}".format(
                user_name, thumb_serv_path))
        return False
    return True


@gen.engine
def copy_thumb(from_path, to_meta, user, async_dbox, callback):
    from_thumb_path, _ = _get_thumbnail_serv_path(from_path, user.name)
    to_path = _get_meta_prop(to_meta, 'path')
    to_thumb_path, to_thumb_name = _get_thumbnail_serv_path(to_path, user.name)
    try:
        copyfile(from_thumb_path, to_thumb_path)
        to_meta['thumbnail_url'] = _get_thumb_url(to_thumb_name, user.name)
    except IOError:
        thumb_rst = yield gen.Task(create_thumbnail, to_meta, user, async_dbox)
        if thumb_rst['errcode'] == ErrCode.ok:
            to_meta['thumbnail_url'] = thumb_rst['thumb_url']
