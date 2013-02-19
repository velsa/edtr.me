# collect here widly used utils
import os
import logging
from tornado.options import options
logger = logging.getLogger('edtr_logger')

DIR_PUBLISH = "www"
DIR_PREVIEW = "preview"


def get_publish_root(user_name):
    return os.path.join(options.site_root, user_name, DIR_PUBLISH)


def get_preview_root(user_name):
    return os.path.join(options.site_root, user_name, DIR_PREVIEW)


def create_site_folder(user_name):
    for root in (get_publish_root(user_name), get_preview_root(user_name)):
        logger.debug("creating folder {0}".format(root))
        if not os.path.exists(root):
            os.makedirs(root)
