from handlers.base import BaseHandler
import logging
import tornado.web
from utils.sessions import asyncmongosession

logger = logging.getLogger('edtr_logger')

class HomeHandler(BaseHandler):
    """Handler for home page. If user is authenticated, then redirect him
    to his control page. Else, show information data and suggest to sign in.
    """
    
    @tornado.web.asynchronous
    @asyncmongosession
    @tornado.web.authenticated
    def get(self):
        self.render("base.html")
        self.finish()