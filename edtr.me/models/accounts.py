from bson.objectid import ObjectId
from schematics.models import Model
from schematics.types import (StringType, EmailType, NumberType)
from utils.auth import check_password, make_password
from utils.mdb_dropbox.mdb_session import MDBDropboxSession
from tornado import gen


class UserModel(Model):
    _id = NumberType(number_class=ObjectId, number_type="ObjectId")
    username = StringType(required=True, min_length=4, max_length=50,
        regex="^[a-zA-Z0-9]+$")
    password = StringType(required=True, min_length=6, max_length=50)
    token_string = StringType()
    first_name = StringType()
    last_name = StringType()
    email = EmailType()

    def check_password(self, entered_password):
        return check_password(entered_password, self.password)

    def set_password(self, plaintext):
        self.password = make_password(plaintext)

    @gen.engine
    def set_dropbox_account_info(self, callback):
        """ Sets user account information from dropbox in database.
        Remember: you need to save set data by yourself, this method won't
        do it. Must be called only when self['token_string'] is defined. """

        assert self.token_string, "set_dropbox_account_info is called with \
            undefined 'token_string'"

        db_sess = MDBDropboxSession(self.token_string)
        info = yield gen.Task(db_sess.get_account_info)
        if 'display_name' in info:
            self.first_name, self.last_name = info['display_name'].split(" ")
        if 'email' in info:
            self.email = info['email']
        callback()
