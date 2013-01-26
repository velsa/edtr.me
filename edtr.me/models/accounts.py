from schematics.types import (StringType, EmailType, DictType)
from django.utils import simplejson as json
from utils.auth import check_password, make_password
from models.base import BaseModel


class UserModel(BaseModel):
    _id = StringType(required=True, min_length=4, max_length=50,
        regex="^[a-zA-Z0-9]+$")
    password = StringType(required=True, min_length=6, max_length=50)
    dbox_access_token = DictType()
    dbox_cursor = StringType()
    first_name = StringType()
    last_name = StringType()
    email = EmailType()

    MONGO_COLLECTION = 'accounts'

    @property
    def name(self):
        return self._id

    @name.setter
    def name(self, value):
        self._id = value

    def check_password(self, entered_password):
        return check_password(entered_password, self.password)

    def set_password(self, plaintext):
        self.password = make_password(plaintext)

    def set_dropbox_token(self, api_token):
        self.dbox_access_token = api_token['access_token']

    def get_dropbox_token(self):
        return self.dbox_access_token

    def create_dropbox_collection(self, db, callback):
        db[self.name].ensure_index("root_path", callback=callback)

    def set_dropbox_account_info(self, api_response):
        info = json.loads(api_response.body)
        if 'display_name' in info:
            self.first_name, self.last_name =\
                info['display_name'].split(" ")
        if 'email' in info:
            self.email = info['email']
