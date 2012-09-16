from base import BaseModel
from collections import defaultdict
from utils.auth import check_password, make_password
from utils.mdb_dropbox.mdb_session import MDBDropboxSession

class UserModel(BaseModel):
    collection = "accounts"
    skeleton = {
        "username": "",
        "password": "",
        "token_string": "",
        "first_name": "",
        "last_name": "",
        "email": "",
        "validated": False,
    }

    def validate(self):
        if self['validated']:
            return None

        errors = defaultdict(list)
        # validate username
        username = self.get('username')        
        if not username:
            errors['username'].append("Field is required")
        elif len(username) < 4:
            errors['username'].append("at least 4 characters")
        else:
            forbidden_chars = '!@#$%^&*()+=[]\\\';,/{}|":<>?'
            for c in username:
                if c in forbidden_chars:
                    errors['username'].append('Invalid characters in username')
                    break

        # validate password
        raw_password = self.get("password")
        if not raw_password:
            errors['password'].append("Field is required")
        elif len(raw_password) < 6:
            errors['password'].append("at least 6 characters")

        if errors:
            return errors

        # validation succeded
        self["password"] = make_password(raw_password)
        self["validated"] = True
        return None

    def check_password(self, entered_password):
        return check_password(entered_password, self['password'])

    def set_dropbox_account_info(self):
        """ Sets user account information from dropbox in database. 
        Remember: you need to save set data by yourself, this method won't
        do it. Must be called only when self['token_string'] is defined. """
        
        token_string = self.get('token_string', None)
        assert token_string, "set_dropbox_account_info is called with \
            undefined 'token_string'"

        db_sess = MDBDropboxSession(token_string)
        info = db_sess.get_account_info()
        if 'display_name' in info:
            self['first_name'], self['last_name'] = \
                info['display_name'].split(" ")
        if 'email' in info:
            self['email'] = info['email']