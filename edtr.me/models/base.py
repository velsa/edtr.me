import logging
from bson.objectid import ObjectId
from schematics.models import Model
from schematics.types import NumberType
from schematics.validation import validate_instance
from schematics.serialize import to_python

logger = logging.getLogger('edtr_logger')


class BaseModel(Model):
    _id = NumberType(number_class=ObjectId, number_type="ObjectId")

    @classmethod
    def check_collection(cls, collection):
        return collection or getattr(cls, 'MONGO_COLLECTION', None)

    @classmethod
    def find_one(cls, db, params, collection=None, callback=None):
        def wrap_callback(*args, **kwargs):
            result = args[0]
            error = args[1]
            if error or not result:
                callback(*args, **kwargs)
            else:
                callback(cls(**result), error)

        db[cls.check_collection(collection)].find_one(
            params, callback=wrap_callback)

    @classmethod
    def remove_entries(cls, db, params, collection=None, callback=None):
        c = cls.check_collection(collection)
        logger.debug('MONGODB:remove_entries:{0}:{1}:params:{2}'.format(
            c, cls.__name__, params))
        db[c].remove(params, callback=callback)

    def save(self, db, collection=None, callback=None):
        c = self.check_collection(collection)
        logger.debug('MONGODB:save:{0}:{1}:fields:{2}'.format(
            c, self.__class__.__name__,
            ','.join(["\n{0}={1}".format(n, getattr(self, n)) for n in sorted(self._fields)])))
        db[c].save(to_python(self), callback=callback)

    def validate(self):
        return validate_instance(self)
