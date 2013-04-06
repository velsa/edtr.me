# collect here widly used utils
import os
import re
import logging
from collections import OrderedDict
from tornado.options import options
logger = logging.getLogger('edtr_logger')


class FolderType:
    publish_content = "www_content"
    publish_output = "www"
    preview_content = "preview_content"
    preview_output = "preview"
    thumbnail = "thumbnail"

    @classmethod
    def _all(cls):
        return [getattr(cls, a) for a in dir(cls) if not a.startswith("_")]


MAX_HEADER_LINE = 50


def get_user_root(user_name, folder_type):
    return os.path.join(options.site_root, user_name, folder_type)


def create_site_folder(user_name):
    for f_type in FolderType._all():
        root = get_user_root(user_name, f_type)
        logger.debug("creating folder {0}".format(root))
        if not os.path.exists(root):
            os.makedirs(root)


def _parse_header_line(line):
    line_regex = re.search(r"""
        (?P<space_before>\s*)
        (?P<key>\w+)
        (?P<space_after>\s*)
        :
        (?P<value>.*)$
        """, line, re.VERBOSE)
    if line_regex:
        return (
            line_regex.group('space_before'),
            line_regex.group('key'),
            line_regex.group('space_after'),
            line_regex.group('value')
        )
    else:
        return [None] * 4


def parse_md_headers(content):
    headers = OrderedDict()
    symbols_in_headers = 0
    for lino, line in enumerate(content.splitlines(True)):
        if not len(line.strip()):
            symbols_in_headers += len(line)
            break
        if lino > MAX_HEADER_LINE:
            break
        else:
            (b, h, a, v) = _parse_header_line(line)
            if h:
                headers[h] = dict(value=v, space_before=b, space_after=a)
                symbols_in_headers += len(line)
            else:
                break
    return headers, symbols_in_headers


def create_path_if_not_exist(path_file):
    f_dir = os.path.dirname(path_file)
    if not os.path.exists(f_dir):
        os.makedirs(f_dir)
