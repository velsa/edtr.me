from handlers.base import BaseHandler
from models.accounts import UserModel
from tornado import gen
import tornado.web
import tornado.escape
from collections import defaultdict

import motor
from schematics.validation import validate_instance
from schematics.serialize import to_python
from pymongo.errors import DuplicateKeyError

import logging

logger = logging.getLogger('edtr_logger')


class LogoutHandler(BaseHandler):
    """Handler for logout url. Delete session and redirect to home page.
    """

    def get(self):
        self.set_current_user(None)
        self.redirect(self.reverse_url("home"))


class LoginHandler(BaseHandler):
    """Handler for login page. Show and process login form.
    """
    def initialize(self, **kwargs):
        super(LoginHandler, self).initialize(**kwargs)
        self.tmpl = "registration/login.html"

    def get(self):
        self.render(self.tmpl)

    @tornado.web.asynchronous
    @gen.engine
    def post(self):
        username = self.get_argument("username", None)
        result = yield motor.Op(self.db.accounts.find_one, {"username": username})
        if result:
            usr = UserModel(**result)
            password = self.get_argument("password", None)
            if usr.check_password(password):
                self.set_current_user(username)
                next = self.get_argument('next')
                if next:
                    self.redirect(next)
                else:
                    self.redirect(self.reverse_url("home"))
                return

        self.render_async(self.tmpl, {"errors": True})


class RegisterHandler(BaseHandler):
    """Handler for registration page. Show and process register form.
    """
    def initialize(self, **kwargs):
        super(RegisterHandler, self).initialize(**kwargs)
        self.tmpl = "registration/register.html"
        self.context = {'errors': defaultdict(list), }

    def get(self):
        self.render(self.tmpl, self.context)

    @tornado.web.asynchronous
    @gen.engine
    def post(self):
        password = self.get_argument('password1', None)
        password2 = self.get_argument('password2', None)

        if password != password2:
            self.context['errors']['password2'].append("Passwords not equal")
            self.render_async(self.tmpl, self.context)
            return

        usr = UserModel()
        usr.username = self.get_argument("username", None)
        usr.password = password

        result = validate_instance(usr)
        if result.tag == 'OK':
            usr.set_password(usr.password)
            try:
                yield motor.Op(self.db.accounts.insert, to_python(usr))
                # user save succeeded
                self.set_current_user(usr.username)
                self.redirect(self.reverse_url("home"))
                return
            except DuplicateKeyError:
                self.context['errors']['username'].append("Already taken. Sorry.")
        else:
            for err in result.value:
                self.context['errors'][err.name].append(err.message)

        self.render_async(self.tmpl, self.context)


class UserNameAvailabilityHandler(BaseHandler):

    @tornado.web.asynchronous
    @gen.engine
    def get(self, username):
        result = yield motor.Op(self.db.accounts.find_one, {"username": username})
        self.set_header("Content-Type", "text/plain")
        if result:
            self.write('error')
        else:
            self.write("success")
        self.finish()
