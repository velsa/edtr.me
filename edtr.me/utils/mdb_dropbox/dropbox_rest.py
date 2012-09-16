"""
A simple JSON REST request abstraction layer that is used by the
dropbox.client and dropbox.session modules. You shouldn't need to use this
directly unless you're implementing new methods we haven't added to the SDK yet.
"""

import httplib
import simplejson as json
import socket
import urllib
import urlparse
import os
from tornado.httpclient import AsyncHTTPClient
from tornado import gen, web

SDK_VERSION = "1.2"

_CALLBACK = None

class RESTClient(object):
	"""
An class with all static methods to perform JSON REST requests that is used internally
by the Dropbox Client API. It provides just enough gear to make requests
and get responses as JSON data (when applicable). All requests happen over SSL.
"""

	@staticmethod
	def set_callback(func):
		"""
		Set callback for request()
		IMPORTANT: there should be no yields or passing control to
		Tornado's IO loop between set_callback() and request() calls !
		"""
		global _CALLBACK
		_CALLBACK = func

	@staticmethod
	@gen.engine
	def request(method, url, post_params=None, body=None, headers=None, raw_response=False):
		"""Perform a REST request and parse the response.

Args:
	method: An HTTP method (e.g. 'GET' or 'POST').
	url: The URL to make a request to.
	post_params: A dictionary of parameters to put in the body of the request.
		This option may not be used if the body parameter is given.
	body: The body of the request. Typically, this value will be a string.
		It may also be a file-like object in Python 2.6 and above. The body
		parameter may not be used with the post_params parameter.
	headers: A dictionary of headers to send with the request.
	raw_response: Whether to return the raw httplib.HTTPReponse object. [default False]
		It's best enabled for requests that return large amounts of data that you
		would want to .read() incrementally rather than loading into memory. Also
		use this for calls where you need to read metadata like status or headers,
		or if the body is not JSON.

Returns:
	The JSON-decoded data from the server, unless raw_response is
	specified, in which case an httplib.HTTPReponse object is returned instead.

Raises:
	dropbox.rest.ErrorResponse: The returned HTTP status is not 200, or the body was
		not parsed from JSON successfully.
	dropbox.rest.RESTSocketError: A socket.error was raised while contacting Dropbox.
"""
		# Store callback in local scope in case it changes after yield
		global _CALLBACK
		callback = _CALLBACK

		post_params = post_params or {}
		headers = headers or {}
		headers['User-Agent'] = 'AsyncDropboxPythonSDK/' + SDK_VERSION

		if post_params:
			if body:
				raise ValueError("body parameter cannot be used with post_params parameter")
			body = urllib.urlencode(post_params)
			headers["Content-type"] = "application/x-www-form-urlencoded"

		# Tornado's async http client
		http = AsyncHTTPClient()
		yield_key = object() # should be unique
		http.fetch(url, method=method, body=body, headers=headers,
			callback=(yield gen.Callback(yield_key)))
		response = yield gen.Wait(yield_key)
		# Throw an exception in case we got one
		if response.error:
			#response.rethrow()
			raise ErrorResponse(response)

		#conn = httplib.HTTPSConnection(host, 443)

		#except socket.error, e:
		#	raise RESTSocketError(host, e)

		#r = conn.getresponse()
		#if response.status != 200:
		#	raise ErrorResponse(r)

		if raw_response:
			# Since we've read all data from http, present it as file
			# this is what callers expect when raw_response is True
			#from StringIO import StringIO
			ret = response #StringIO(response.body)
		else:
			try:
				ret = json.loads(response.body)
			except ValueError:
				raise ErrorResponse(response)
		callback(ret)

	@classmethod
	def GET(cls, url, headers=None, raw_response=False):
		"""Perform a GET request using RESTClient.request"""
		assert type(raw_response) == bool
		return cls.request("GET", url, headers=headers, raw_response=raw_response)

	@classmethod
	def POST(cls, url, params=None, headers=None, raw_response=False):
		"""Perform a POST request using RESTClient.request"""
		assert type(raw_response) == bool
		if params is None:
			params = {}

		return cls.request("POST", url, post_params=params, headers=headers, raw_response=raw_response)

	@classmethod
	def PUT(cls, url, body, headers=None, raw_response=False):
		"""Perform a PUT request using RESTClient.request"""
		assert type(raw_response) == bool
		return cls.request("PUT", url, body=body, headers=headers, raw_response=raw_response)

class RESTSocketError(socket.error):
	"""
A light wrapper for socket.errors raised by dropbox.rest.RESTClient.request
that adds more information to the socket.error.
"""

	def __init__(self, host, e):
		msg = "Error connecting to \"%s\": %s" % (host, str(e))
		socket.error.__init__(self, msg)

class ErrorResponse(Exception):
	"""
Raised by dropbox.rest.RESTClient.request for requests that return a non-200
HTTP response or have a non-JSON response body.

Most errors that Dropbox returns will have a error field that is unpacked and
placed on the ErrorResponse exception. In some situations, a user_error field
will also come back. Messages under user_error are worth showing to an end-user
of your app, while other errors are likely only useful for you as the developer.
"""

	def __init__(self, http_resp):
		self.status = http_resp.code
		if http_resp.error.message:
			self.reason = http_resp.error.message
		elif hasattr(http_resp.error, 'strerror'):
			self.reason = http_resp.error.strerror
		else:
			self.reason = None
		self.body = http_resp.body

		try:
			body = json.loads(self.body)
			self.error_msg = body.get('error')
			self.user_error_msg = body.get('user_error')
		except (ValueError, Exception):
			self.error_msg = None
			self.user_error_msg = None

	def __str__(self):
		if self.user_error_msg and self.user_error_msg != self.error_msg:
			# one is translated and the other is English
			msg = "%s (%s)" % (self.user_error_msg, self.error_msg)
		elif self.error_msg:
			msg = self.error_msg
		elif not self.body:
			msg = self.reason
		else:
			msg = "Error parsing response body: %s" % self.body

		return "[%d] %s" % (self.status, repr(msg))
