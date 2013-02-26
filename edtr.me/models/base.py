import logging
from bson.objectid import ObjectId
from tornado import gen
from schematics.models import Model
from schematics.types import NumberType
from schematics.validation import validate_instance
from schematics.serialize import to_python

logger = logging.getLogger('edtr_logger')
MAX_FIND_LIST_LEN = 100


class BaseModel(Model):
    _id = NumberType(number_class=ObjectId, number_type="ObjectId")

    @classmethod
    def check_collection(cls, collection):
        return collection or getattr(cls, 'MONGO_COLLECTION', None)

    @classmethod
    def find_list_len(cls):
        return getattr(cls, 'FIND_LIST_LEN', MAX_FIND_LIST_LEN)

    @classmethod
    def find_one(cls, db, params, collection=None, model=True, callback=None):
        def wrap_callback(*args, **kwargs):
            result = args[0]
            error = args[1]
            if not model or error or not result:
                callback(*args, **kwargs)
            else:
                callback(cls(**result), error)

        db[cls.check_collection(collection)].find_one(
            params, callback=wrap_callback)

    @classmethod
    def remove_entries(cls, db, params, collection=None, callback=None):
        c = cls.check_collection(collection)
        db[c].remove(params, callback=callback)

    def save(self, db, collection=None, ser=None, callback=None, **kwargs):
        c = self.check_collection(collection)
        data = ser or to_python(self)
        db[c].save(data, callback=callback, **kwargs)

    @gen.engine
    def update(self, db, collection=None, callback=None):
        c = self.check_collection(collection)
        data = to_python(self)
        if '_id' not in data:
            self.save(db, c, ser=data, callback=callback)
        else:
            _id = data.pop("_id")
            (r, e), _ = yield gen.Task(db[c].update,
                {"_id": _id}, {"$set": data})
            if e or r['updatedExisting']:
                callback((r, e), _)
            else:
                data['_id'] = _id
                self.save(db, c, ser=data, callback=callback)

    @classmethod
    def find(cls, cursor, model=True, callback=None):
        def wrap_callback(*args, **kwargs):
            result = args[0]
            error = args[1]
            if not model or error or not result:
                callback(*args, **kwargs)
            else:
                for i in xrange(len(result)):
                    result[i] = cls(**result[i])
                callback(result, error)
        cursor.to_list(cls.find_list_len(), callback=wrap_callback)

    @classmethod
    def get_fields(cls, role):
        rl = cls._options.roles[role]
        fields = []
        for field in cls._fields:
            if not rl(field, None):
                fields.append(field)
        return fields

    def validate(self):
        return validate_instance(self)
