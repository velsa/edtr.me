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
