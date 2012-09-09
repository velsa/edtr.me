from handlers.home import HomeHandler
from handlers.accounts import LoginHandler, RegisterHandler

url_patterns = [
    (r"/", HomeHandler),
    (r'/accounts/login', LoginHandler),
    (r'/accounts/register', RegisterHandler),
]
