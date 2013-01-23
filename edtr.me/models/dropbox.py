from bson.objectid import ObjectId
from schematics.models import Model
from schematics.types import (StringType, NumberType, IntType, BooleanType)
from schematics.serialize import to_python


class DropboxFile(Model):
    _id = NumberType(number_class=ObjectId, number_type="ObjectId")
    revision = IntType()
    rev = StringType()
    thumb_exists = BooleanType()
    bytes = IntType()
    modified = StringType()
    client_mtime = StringType()
    path = StringType()
    root_path = StringType()
    is_dir = BooleanType()
    icon = StringType()
    root = StringType()
    mime_type = StringType()
    size = StringType()

    def save(self, db, collection, callback):
        db[collection].save(to_python(self), callback=callback)
