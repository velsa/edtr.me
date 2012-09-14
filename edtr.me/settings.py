import logging
import tornado
import tornado.template
import os
from tornado.options import define, options
import sys
from logconfig import dictconfig
from jinja2 import Environment, FileSystemLoader

# Make filepaths relative to settings.
path = lambda root,*a: os.path.join(root, *a)
ROOT = os.path.dirname(os.path.abspath(__file__))

define("port", default=8888, help="run on the given port", type=int)
define("config", default=None, help="tornado config file")
define("debug", default=False, help="debug mode")
tornado.options.parse_command_line()

STATIC_ROOT = path(ROOT, 'static')
TEMPLATE_ROOT = path(ROOT, 'templates')

# Deployment Configuration
settings = {
    'debug': options.debug,
    'static_path': STATIC_ROOT,
    'cookie_secret': "vZS/c+BKTASaEjrBJ51uMMX+AwCyp0bcmXHOlX0jd0s=",
    'xsrf_cookies': True,
    'login_url': '/accounts/login',
}

# Jinja settings
# for all options see http://jinja.pocoo.org/docs/api/#jinja2.Environment
jinja_settings = {
    'autoescape': True,
}
jinja_env = Environment(loader = FileSystemLoader(TEMPLATE_ROOT), 
            **jinja_settings)

# Mongo settings
mongo_address = {    
    'host': '127.0.0.1',
    'port': 27017,
}
MONGO_DB = "edtrme"

# Sessions settings
session = {
    "COOKIE_NAME": "asyncmongo_session",
    "DEFAULT_COOKIE_PATH": "/",
    "SESSION_EXPIRE_TIME": 7200,    # sessions are valid for 7200 seconds
                                    # (2 hours)
    "SET_COOKIE_EXPIRES": True,     # Set to True to add expiration field to
                                    # cookie
    "SESSION_TOKEN_TTL": 5,         # Number of seconds a session token is valid
                                    # for.
    "UPDATE_LAST_ACTIVITY": 60,     # Number of seconds that may pass before
                                    # last_activity is updated
    "MONGO_COLLECTION": 'sessions',
    "MONGO_COLLECTION_SIZE": 100000,
}

# Log settings
if "win" in sys.platform:
    LOG_FILE = 'd:/temp/logs/edtrme.log'
else:
    #TBD
    LOG_FILE = '/var/log/edtrme.log'

# See PEP 391 and logconfig for formatting help.  Each section of LOGGERS
# will get merged into the corresponding section of log_settings.py.
# Handlers and log levels are set up automatically based on LOG_LEVEL and DEBUG
# unless you set them here.  Messages will not propagate through a logger
# unless propagate: True is set.
LOGGING = {
    'version': 1,
    'formatters': {
        'verbose': {
            'format':       '%(asctime)s %(levelname)s: %(filename)s:%(lineno)d '
                            '%(process)d/%(thread)d - %(message)s',
            },
        'readable': {
            'format':       '%(levelname)-7s: %(filename)15s:%(lineno)4d  -  %(message)s',
            },
        'simple': {
            'format':       '%(levelname)-7s: %(message)s',
        },
    },

    'handlers': {
        'console': {
            'level':        'DEBUG',
            'class':        'logging.StreamHandler',
            'formatter':    'readable',
        },
        'rotating_file': {
            'level' :       'DEBUG',
            'formatter' :   'verbose',
            'class' :       'logging.handlers.TimedRotatingFileHandler',
            'filename' :    LOG_FILE, # full path works
            'when' :        'midnight',
            'interval' :    1, # day
            'backupCount' : 7,
        },
    },

    'loggers': {
        # Usage: logger = logging.getLogger('edtr_logger')
        'edtr_logger': {
            'handlers':     ['console', 'rotating_file', ],
            'level':        'DEBUG' if settings['debug'] else "INFO",
        },
    }
}

dictconfig.dictConfig(LOGGING)

if options.config:
    tornado.options.parse_config_file(options.config)
