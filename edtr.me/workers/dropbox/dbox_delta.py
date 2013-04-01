# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from tornado import gen
from django.utils import simplejson as json
import motor
from schematics.serialize import make_safe_python

from utils.async_dropbox import DropboxMixin
from models.dropbox import DropboxFile
from models.accounts import UserModel
from utils.gl import DB, SocketPool
from utils.error import ErrCode
from .dbox_utils import (check_bad_response, update_meta, is_image_thumb,
    delta_called_recently)
from .dbox_thumb import remove_thumbnail, create_thumbnail
from .dbox_publish import dbox_process_publish, dbox_unpublish
logger = logging.getLogger('edtr_logger')


@gen.engine
def update_dbox_delta(db, async_dbox, user, reg_update=False,
                                           force_update=False, callback=None):
    # TODO: don't make any actions
    # if previous call of this method is not finished for current user
    updates = None
    # check, that update_delta is not called very often
    if force_update or not delta_called_recently(user):
        # Get delta metadata from dropbox
        access_token = user.get_dropbox_token()
        post_args = {}
        if user.dbox_cursor:
            post_args['cursor'] = user.dbox_cursor
        has_more = True
        cursor = None
        updates = {}
        while has_more:
            # make dropbox request
            user.last_delta = datetime.now()
            # TODO find a way to call save one time in this func
            yield motor.Op(user.save, db)
            response = yield gen.Task(async_dbox.dropbox_request,
                "api", "/1/delta",
                access_token=access_token,
                post_args=post_args)
            if check_bad_response(response, callback):
                return
            dbox_delta = json.loads(response.body)
            has_more = dbox_delta['has_more']
            cursor = dbox_delta['cursor']
            if dbox_delta['reset']:
                logger.debug(
                    u"Reseting user all files for '{0}'".format(user.name))
                yield motor.Op(db[user.name].drop)
            for i, (e_path, entry) in enumerate(dbox_delta['entries']):
                # TODO: find a way not call db on every file
                dfile = yield motor.Op(DropboxFile.find_one,
                    db, {"_id": e_path}, user.name)
                if entry is None:
                    if dfile:
                        # TODO
                        # maybe there is a way to delete files in one db call
                        updates[e_path] = None
                        dbox_unpublish(dfile, user)
                        yield motor.Op(DropboxFile.remove_entries, db,
                            {"_id": e_path}, collection=user.name)
                        if is_image_thumb(dfile.mime_type, dfile.thumb_exists):
                            remove_thumbnail(dfile.path, user.name)
                else:
                    # TODO
                    # maybe there is a way to save files in one db call
                    if is_image_thumb(entry.get('mime_type', None),
                                 entry.get('thumb_exists', None)):
                        if not dfile or dfile['modified'] != entry['modified']:
                            thumb_rst = yield gen.Task(create_thumbnail,
                                entry, user, async_dbox)
                            if thumb_rst['errcode'] == ErrCode.ok:
                                entry['thumbnail_url'] = thumb_rst['thumb_url']

                    meta = yield gen.Task(update_meta,
                        db, entry, user.name, False)
                    if not dfile:
                        updates[e_path] = DropboxFile(**meta)
                    elif dfile['modified'] != entry['modified']:
                        for f in entry:
                            if hasattr(dfile, f) and f != 'path':
                                setattr(dfile, f, entry[f])
                        updates[e_path] = dfile
        user.dbox_cursor = cursor
        yield motor.Op(user.save, db)
    else:
        logger.debug("Delta called recently")
    if callback:
        ret_val = {'errcode': ErrCode.ok}
        if reg_update:
            ret_val['updates'] = updates
        else:
            pub_rst = yield gen.Task(dbox_process_publish,
                updates, user, db, async_dbox)
            if pub_rst['errcode'] != ErrCode.ok:
                # TODO process errors
                pass
        callback(ret_val)


@gen.engine
def dbox_sync_user(user, error):
    if error:
        try:
            raise error
        except:
            logger.exception("dbox_sync_user error:")
    elif user:
        user = UserModel(**user)
        async_dbox = DropboxMixin()
        db = DB.instance()
        rst = yield gen.Task(update_dbox_delta,
            db, async_dbox, user, reg_update=True)
        if rst['errcode'] != ErrCode.ok:
            logger.warning(u"Dropbox periodic update for user {0}"
                "ended with status = {1}".format(user.name, rst['errcode']))
        elif 'updates' in rst and rst['updates']:
            updates = rst['updates']
            pub_rst = yield gen.Task(dbox_process_publish,
                updates, user, db, async_dbox)
            if pub_rst['errcode'] != ErrCode.ok:
                # TODO process errors
                pass
            # TODO notify user, that reg_publish failed.
            # For exmaple, it can be due to bad md headers
            skt_opened = SocketPool.is_socket_opened(user.name)
            if skt_opened:
                logger.debug(u"Sending updates to socket. "
                    "User: {0}, updates: {1}".format(
                        user.name, rst['updates']))
                for p in rst['updates']:
                    if rst['updates'][p]:
                        rst['updates'][p] = make_safe_python(
                            DropboxFile, rst['updates'][p], 'public')
                SocketPool.notify_dbox_update(user.name, rst)
            else:
                logger.debug(u"Updates found, but socket is closed. "
                    "User: {0}, updates: {1}".format(
                        user.name, rst['updates']))
    else:
        logger.error("dbox_sync_user user not found")
