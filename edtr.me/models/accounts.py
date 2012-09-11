from base import BaseModel
from collections import defaultdict
from utils.auth import check_password, make_password

class UserModel(BaseModel):
    collection = "accounts"
    skeleton = {
        "username": None,
        "password": None,
    }

    def validate(self):
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

        return None