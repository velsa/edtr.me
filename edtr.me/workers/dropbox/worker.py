from utils.async_dropbox import DropboxMixin


class DropboxWorkerMixin(DropboxMixin):
    def dbox_get_tree(self, auth_token, path, callback):
        self.dropbox_request(
            "api", "/1/metadata/{root}/",
            access_token=auth_token,
            callback=callback)
