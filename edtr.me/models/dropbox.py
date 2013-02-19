import dateutil.parser
from schematics.types import (StringType, IntType, BooleanType, DateTimeType)
from models.base import BaseModel
from schematics.serialize import (blacklist)

PUBLIC_EXCLUDE = 'last_updated',


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
    size = StringType()
    last_updated = DateTimeType()
    url_trans = StringType()
    url_expires = StringType()

    FIND_LIST_LEN = 250

    class Options:
        roles = {
            'public': blacklist(PUBLIC_EXCLUDE),
        }

    @classmethod
    def public_exclude_fields(cls):
        d = {}
        for f in PUBLIC_EXCLUDE:
            d[f] = False
        return d

    def set_url_expires(self, date):
        parsed = dateutil.parser.parse(date)
        self.url_expires = parsed.strftime("%a, %d %b %Y %H:%M:%S %z")

    def get_url_expires(self):
        if not self.url_expires:
            return None
        else:
            return dateutil.parser.parse(self.url_expires)
