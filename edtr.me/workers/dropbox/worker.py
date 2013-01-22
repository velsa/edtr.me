import logging
from utils.async_dropbox import DropboxMixin
logger = logging.getLogger('edtr_logger')


class DropboxWorkerMixin(DropboxMixin):
    def dbox_get_tree(self, auth_token, dbox_hash, path, callback):
        api_url = "/1/metadata/{root}"
        if path or path != '/':
            api_url += path
        self.dropbox_request(
            "api",
            api_url,
            access_token=auth_token,
            hash=dbox_hash or "",
            callback=callback)
