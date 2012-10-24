# -*- coding: utf-8 -*-
import motor
from settings import mongo_address, MONGO_DB

database = motor.MotorConnection(**mongo_address).open_sync()[MONGO_DB]


class BaseModel(dict):
    """Base class for database object abstration. Async features of
    pymongo motor are used (http://emptysquare.net/motor/)
    """

    # must be specified
    collection = None
    skeleton = None

    def __init__(self, base_dict=None, **kwargs):
        model = dict(self.skeleton)
        if base_dict:
            model.update(base_dict)
        if kwargs:
            model.update(kwargs)
        super(BaseModel, self).__init__(model)

    database = database

    @property
    def skeleton(self):
        return self.get_static_property("skeleton")

    @property
    def collection(self):
        return self.get_static_property("collection")

    def get_static_property(self, name):
        prop = getattr(type(self), name, None)
        if not prop:
            raise NotImplementedError(
                "You must specify {0} property for class {1}".format(
                    name, self.__class__.__name__
            ))
        return prop

    def validate(self):
        """ This method will be called before saving model to database.
        Define here fields checks and preparations.
        If validation succeeded, it must return empty defaultdict (or another
        object, that treats by python as false: None, False, [], {}, ets)
        Otherwise it must return collections.defaultdict(list) with errors in
        format:
        {'field_name1': "error description",
         'field_name2': "error description",}
        """
        raise NotImplementedError(
            "Define validate method for class {0}".format(
                self.__class__.__name__
        ))

    def save(self, *args, **kwargs):
        errors = self.validate()
        if errors:
            callback = kwargs.get('callback')
            callback(None, errors)
            return
        return BaseModel.database[self.collection].save(self, *args, **kwargs)

    def insert(self, *args, **kwargs):
        errors = self.validate()
        if errors:
            callback = kwargs.get('callback')
            callback(None, errors)
            return
        return self.database[self.collection].insert(self, *args, **kwargs)

    @classmethod
    def find(cls, pattern, limit=None):
        """Async find method, wraper for motor to_list method.
        The caller is responsible for making sure that there is enough memory
        to store the results – it is strongly recommended you use a limit.
        For details look
        http://emptysquare.net/motor/pymongo/api/motor/motor_cursor.html#motor.MotorCursor.to_list
        """
        cursor = BaseModel.database[cls.collection].find(pattern)
        if limit:
            return cursor.limit(limit).to_list
        else:
            return cursor.to_list

    @classmethod
    def find_one(cls, *args, **kwargs):
        return BaseModel.database[cls.collection].find_one(*args, **kwargs)
