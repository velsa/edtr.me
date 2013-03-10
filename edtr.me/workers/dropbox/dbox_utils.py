# -*- coding: utf-8 -*-
import logging
import os.path
import urllib
from datetime import datetime

import motor
from tornado import gen

from utils.error import ErrCode
from .dbox_settings import DELTA_PERIOD_SEC, MIME_MD
logger = logging.getLogger('edtr_logger')


def unify_path(path):
    while len(path) > 1 and path.endswith('/'):
        path = path[:-1]
    if len(path) > 1 and not path.startswith('/'):
        path = '/' + path
    return path


def get_file_url(path, api_url):
    path = unify_path(path)
    return "/1/{api_url}/{{root}}{path}".format(
        api_url=api_url,
        path=urllib.quote(path.encode('utf8')))


def check_bad_response(response, callback=None):
    if response.code != 200:
        error, descr = 'undefined', 'undefined'
        if hasattr(response, 'error'):
            error = response.error
        if response.body:
            descr = response.body
        result = {
            "errcode": ErrCode.bad_request,
            'http_code': response.code,
            'error': error,
            'description': descr,

        }
        logger.error(result)
        if callback:
            callback(result)
        return result
    return None


def delta_called_recently(user):
    # TODO store last_delta in cache (memcached, redis)
    # to minimize time between check and save last_delta
    last_delta = user.last_delta
    if last_delta:
        last_delta_time = datetime.now() - last_delta
        if last_delta_time.total_seconds() < DELTA_PERIOD_SEC:
            return True
    return False


def _adopt_meta(meta_data, update_date=True, separate_id=True):
    meta = dict(meta_data)
    _id = meta.pop('path')
    meta['root_path'] = os.path.dirname(_id)
    if update_date:
        meta['last_updated'] = datetime.now()
    if not separate_id:
        meta['_id'] = _id
    return meta, _id


@gen.engine
def save_meta(db, meta_data, colln, callback=None):
    meta, _ = _adopt_meta(meta_data, separate_id=False)
    yield motor.Op(db[colln].save, meta)
    callback(meta)


@gen.engine
def update_meta(db, meta_data, colln, update=True, callback=None):
    meta, _id = _adopt_meta(meta_data, update)
    r = yield motor.Op(db[colln].update, {"_id": _id}, {"$set": meta})
    meta['_id'] = _id
    if not r['updatedExisting']:
        yield motor.Op(db[colln].save, meta)
    callback(meta)


def is_md(file_meta):
    return file_meta.mime_type == MIME_MD and\
        file_meta.path.rsplit('.', 1)[-1] in ('md', "mkd", "markdown")


def is_image(mime_type):
    return bool(mime_type) and 'image' in mime_type


def is_image_thumb(mime_type, thumb_exists):
    return is_image(mime_type) and thumb_exists
