from handlers.home import HomeHandler
from handlers.accounts import (LoginHandler, RegisterHandler, 
	UserNameAvailabilityHandler, LogoutHandler)

# Snippet to get url by name from templates
# this code will execute at each url request
# TODO maybe to remove this
named_url_patterns = [
    (r"/", HomeHandler, "home"),
    (r'/accounts/login', LoginHandler, "login"),
    (r'/accounts/register', RegisterHandler, "register"),
    (r'/accounts/logout', LogoutHandler, "logout"),
    (r'/accounts/check_username_availability/(.+)/', 
    	UserNameAvailabilityHandler, "user_name_avaliability"),

    (r'/accounts/profile', None, "profile"), #TODO
    (r'/accounts/settings', None, "settings"), #TODO
]

url_patterns = [x[:2] for x in named_url_patterns]

url_names = {}
for named_url in named_url_patterns:
	try:
		url_names[named_url[2]] = named_url[0]
	except IndexError:
		raise ValueError("Name for url {0} not specified".format(named_url[0]))