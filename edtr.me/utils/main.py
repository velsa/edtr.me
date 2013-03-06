# collect here widly used utils
import os
import logging
from tornado.options import options
logger = logging.getLogger('edtr_logger')


class FolderType:
    publish = "www"
    preview = "preview"
    thumbnail = "thumbnail"

    @classmethod
    def _all(cls):
        return [getattr(cls, a) for a in dir(cls) if not a.startswith("_")]


MAX_HEADER_LINE = 10


def get_user_root(user_name, folder_type):
    return os.path.join(options.site_root, user_name, folder_type)


def create_site_folder(user_name):
    for f_type in FolderType._all():
        root = get_user_root(user_name, f_type)
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
