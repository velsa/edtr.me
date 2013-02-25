# collect here widly used utils
import os
import logging
from tornado.options import options
logger = logging.getLogger('edtr_logger')

DIR_PUBLISH = "www"
DIR_PREVIEW = "preview"
MAX_HEADER_LINE = 10


def get_publish_root(user_name):
    return os.path.join(options.site_root, user_name, DIR_PUBLISH)


def get_preview_root(user_name):
    return os.path.join(options.site_root, user_name, DIR_PREVIEW)


def create_site_folder(user_name):
    for root in (get_publish_root(user_name), get_preview_root(user_name)):
        logger.debug("creating folder {0}".format(root))
        if not os.path.exists(root):
            os.makedirs(root)


def _parse_header_line(line):
    if isinstance(line, unicode):
        o = unicode
    elif isinstance(line, str):
        o = str
    else:
        return (None, None)
    h = map(o.strip, line.split(":", 1))
    if len(h) != 2:
        return (None, None)
    else:
        return h


def parse_md_headers(content):
    headers = dict()
    for lino, line in enumerate(content.splitlines()):
        if not len(line.strip()) or lino > MAX_HEADER_LINE:
            break
        else:
            (h, v) = _parse_header_line(line)
            if h and isinstance(h, (str, unicode)):
                headers[h.lower()] = v
    return headers
