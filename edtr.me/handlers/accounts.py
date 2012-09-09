from handlers.base import BaseHandler
import logging

logger = logging.getLogger('edtr_logger')


class LoginHandler(BaseHandler):
    """Handler for login page. Show and process login form.
    """

    def get(self):
        self.render("registration/login.html")

class RegisterHandler(BaseHandler):
	"""Handler for registration page. Show and process register form.
	"""

	def get(self):
		self.render("registration/register.html")