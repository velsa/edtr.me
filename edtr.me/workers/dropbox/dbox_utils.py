# -*- coding: utf-8 -*-
import logging
import urllib

from utils.error import ErrCode
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
