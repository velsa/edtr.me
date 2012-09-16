"""
Custom class for MarkDBox implementing Dropbox session methods
"""
import os
import time
from datetime import datetime
from dropbox import client, rest, session
import settings
import logging
from dropbox_rest import RESTClient

l = logging.getLogger('edtr_logger')

# You can find these at http://www.dropbox.com/developers/apps
APP_KEY 	= settings.settings['dropbox_consumer_key']
APP_SECRET 	= settings.settings['dropbox_consumer_secret']
ACCESS_TYPE = settings.settings['dropbox_access_type'] # should be 'dropbox' or 'app_folder' as configured for your app

class MDBDropboxSession(session.DropboxSession):
	"""
	A wrapper around DropboxSession
	When passed token_string in constructor - creates DropboxClient
	"""

	def __init__(self, token_string=None):
		global APP_KEY, APP_SECRET, ACCESS_TYPE
		session.DropboxSession.__init__(self, APP_KEY, APP_SECRET, ACCESS_TYPE)
		# If we have token_string - set it and create DropboxClient
		if token_string:
			self.set_token(*token_string.split('|'))
			self.db_client = client.DropboxClient(self)

	def get_account_info(self, callback=None):
		"""returns user account information"""
		if callback:
			RESTClient.set_callback(callback)
		return self.db_client.account_info()

	def dir_changed(self, dir_name, hash, callback=None):
		"""
		Returns True and new_hash if dir in dropbox has new hash (was modified)
		False, None otherwise
		"""
		if callback:
			RESTClient.set_callback(callback)
		resp = None
		try:
			resp = self.db_client.metadata(dir_name, hash=hash)
		except rest.ErrorResponse, e:
			# No changes in dir
			if e.status == 304:
				return None
		except Exception, e:
			l.error("dir_changed: metadata error for %s: %s" % (dir_name, e, ))
			return None
		if resp:
			if 'hash' in resp:
				return resp
			else:
				l.error("dir_changed: no hash for %s ???" % (dir_name, ))
		else:
			l.error("dir_changed: no resp for %s ???" % (dir_name, ))
		return None

	def read_file(self, file_path, callback=None):
		"""read contents of the file"""
		if callback:
			RESTClient.set_callback(callback)
		f = self.db_client.get_file(file_path)
		content = f.read()
		# Convert to utf-8 !
		if type(content) != unicode:
			# Find out file encoding from REST headers
			db_enc = f.msg['content-type']
			l.info("read %s from dropbox. encoding '%s'" %\
					(file_path, db_enc))
			if 'charset' in db_enc:
				# Text file, decode to unicode as early as possible
				py_enc = db_enc[db_enc.find('charset=')+8:]
				# TODO: maybe leave errors='strict' and act on exception ?
				content = content.decode(py_enc) # Doesn't work in python 2.6 !, errors='ignore')
			else:
				# Otherwise we treat the file as binary and keep it as it is
				if os.path.splitext(file_path)[1] in settings.SUPPORTED_EXTS:
					# Shouldn't get here
					l.error("%s doesn't have text encoding (%s) ?!" % \
							(file_path, db_enc))
		return content

	def write_file(self, file_path, content, callback=None):
		"""write contents to the file"""
		if callback:
			RESTClient.set_callback(callback)
		return self.db_client.put_file(file_path,
			content.encode('utf-8'),
			overwrite=True, )

	def get_files_as_dicts(self, dir_path, callback=None):
		"""
		Get list files in dropbox directory as a list of dicts
		"""
		if callback:
			RESTClient.set_callback(callback)
		resp = None
		try:
			resp = self.db_client.metadata(dir_path)
		except rest.ErrorResponse, e:
			l.error("get_files_as_dicts: metadata error for %s: %s" % \
					(dir_path, e))
		keys_available_in_resp = """
		size			A human-readable description of the file
						size (translated by locale).
		bytes			The file size in bytes.
		is_dir			Whether the given entry is a folder or not.
		is_deleted		Whether the given entry is deleted
						(only included if deleted files are being returned).
		rev				A unique identifier for the current revision of a file.
						This field is the same rev as elsewhere in the API and can
						be used to detect changes and avoid conflicts.
		hash			The hash of a folder's metadata useful in later calls to /metadata.
		thumb_exists	True if the file is an image can be converted to a
						thumbnail via the /thumbnails call.
		icon			The name of the icon used to illustrate the file type
						in Dropbox's icon library.
		modified		The last time the file was modified on Dropbox, in the standard
						date format (not included for the root folder).
		root			The root or top-level folder depending on your access level.
						All paths returned are relative to this root level.
						Permitted values are either dropbox or app_folder.
		contents		List of dicts with files/dirs info
		[
			{
				"size": 		"0 bytes",
				"rev": 			"35c1f029684fe",
				"thumb_exists": false,
				"bytes": 		0,
				"modified": 	"Mon, 18 Jul 2011 20:13:43 +0000",
				"path": 		"/Public/latest.txt",
				"is_dir": 		false,
				"icon": 		"page_white_text",
				"root": 		"dropbox",
				"mime_type": 	"text/plain",
				"revision": 	220191
			},
		]
		"""
		if resp and 'contents' in resp:
			return resp['contents']


#
# Helpers:
#
def dict_last_modified(file_dict):
	"""
	Converts this format: "Mon, 18 Jul 2011 20:13:43 +0000" into datetime
	"""
	time_format = "%a, %d %b %Y %H:%M:%S +0000"
	return datetime.fromtimestamp(time.mktime(time.strptime(file_dict["modified"], time_format)))

def dicts_find(file_dicts, file_path):
	"""
	Returns file dict matching filename
	"""
	for f in file_dicts:
		if file_path == f['path']:
			return f

def dicts_to_paths(file_dicts, files_only=False, dirs_only=False):
	"""
	Converts dicts into tuple of file names without path elements
	If files_only is True - skip dirs (dirs_only is ignored)
	if dirs_only is True - skip files
	"""
	list = []
	for f in file_dicts:
		if files_only and f['is_dir']:
			continue
		if dirs_only and not f['is_dir']:
			continue
		name = f['path']
		# TODO: does this really support unicode ?
		#encoding = locale.getdefaultlocale()[1]
		#list.append(name.encode(encoding))
		list.append(name)
	return list
