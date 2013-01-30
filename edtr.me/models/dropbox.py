import dateutil.parser
from schematics.types import (StringType, IntType, BooleanType)
from models.base import BaseModel


class DropboxFile(BaseModel):
    _id = StringType()
    revision = IntType()
    rev = StringType()
    thumb_exists = BooleanType()
    bytes = IntType()
    modified = StringType()
    client_mtime = StringType()
    mime_type = StringType()
    root_path = StringType()
    is_dir = BooleanType()
    icon = StringType()
    root = StringType()
    mime_type = StringType()
    size = StringType()
    url_trans = StringType()
    url_expires = StringType()

    def set_url_expires(self, date):
        parsed = dateutil.parser.parse(date)
        self.url_expires = parsed.strftime("%a, %d %b %Y %H:%M:%S %z")

    def get_url_expires(self):
        if not self.url_expires:
            return None
        else:
            return dateutil.parser.parse(self.url_expires)
