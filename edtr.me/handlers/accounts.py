from handlers.base import BaseHandler
from models.accounts import UserModel
from tornado import gen
import tornado.web
import tornado.escape
from collections import defaultdict
from utils.sessions import asyncmongosession
from utils.main import DB

import logging

logger = logging.getLogger('edtr_logger')

class LogoutHandler(BaseHandler):
    """Handler for logout url. Delete session and redirect to home page.
    """

    @tornado.web.asynchronous
    @asyncmongosession
    def get(self):
        if hasattr(self, 'session'):
            self.set_current_user(None)
        self.redirect(self.get_url_by_name("home"))

class LoginHandler(BaseHandler):
    """Handler for login page. Show and process login form.
    """

    def get(self):
        self.render("registration/login.html")

    @tornado.web.asynchronous
    @asyncmongosession
    @gen.engine
    def post(self):
        tmpl = 'registration/login.html'
        context = {"errors": True}

        username = self.get_argument("username", "")
        password = self.get_argument("password", "")

        # empty user
        if not username:
            self.render_async(tmpl, context)
            return

        # find user with specified username
        response, not_used = yield gen.Task(UserModel.find_one, 
            {"username": username})

        # error from database
        if response[DB.error]:
            self.render_async(tmpl, context)
            return

        # user not found
        user = response[DB.model]
        if not user:
            self.render_async(tmpl, context)
            return

        # passwords mismatch
        user = UserModel(user)
        if not user.check_password(password):
            self.render_async(tmpl, context)
            return

        # username and password correct
        context['errors'] = False
        self.set_current_user(username)
        next = self.get_argument('next')
        if next:
            self.redirect(next)
        else:
            self.redirect(self.get_url_by_name("home"))

class RegisterHandler(BaseHandler):
    """Handler for registration page. Show and process register form.
    """

    def init_context(self):
        return {'errors': defaultdict(list),}

    def get(self):
        context = self.init_context()
        self.render("registration/register.html", context)

    @tornado.web.asynchronous
    @asyncmongosession
    @gen.engine
    def post(self):
        tmpl = "registration/register.html"
        context = self.init_context()
        username = self.get_argument('username', None)

        # username not specified
        if not username:
            context['errors']['username'].append("Field is required")
            self.render_async(tmpl, context)
            return

        # find user with specified username
        response, not_used = yield gen.Task(UserModel.find_one, 
            {"username": username})

        # on error from database
        if response[DB.error]:
            context['errors']['non_field'].append(str(response[DB.error]))
            self.render_async(tmpl, context)
            return

        # user already exists
        if response[DB.model]: 
            context['errors']['username'].append("Already taken. Sorry.")
            self.render_async(tmpl, context)
            return

        # passwords not equal
        pwd1 = self.get_argument('password1', None)
        pwd2 = self.get_argument('password2', None)

        if pwd1 != pwd2:
            context['errors']['password2'].append("Passwords not equal")
            self.render_async(tmpl, context)
            return

        # try to save user
        user = UserModel({
            'username': username,
            'password': pwd1,
        })
        response, not_used = yield gen.Task(user.insert)

        # user save failed
        error = response[DB.error]
        if error:
            if isinstance(error, dict):
                context['errors'] = error
            else:
                context['errors']['non_field'].append(str(error))
            self.render_async(tmpl, context)
            return

        # user save succeeded
        self.set_current_user(username)

        self.redirect(self.get_url_by_name("home"))


class UserNameAvailabilityHandler(BaseHandler):
    
    @tornado.web.asynchronous
    @gen.engine
    def get(self, username):
        response, not_used = yield gen.Task(UserModel.find_one, 
            {"username": username})
        self.set_header("Content-Type", "text/plain")
        if response[DB.error] or response[DB.model]:
            self.write('error')
        else:
            self.write("success")
        self.finish()
