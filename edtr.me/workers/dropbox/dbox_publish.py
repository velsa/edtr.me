# -*- coding: utf-8 -*-
import logging
import os.path

from tornado import gen
import motor
from schematics.serialize import make_safe_python

from utils.error import ErrCode
from models.dropbox import DropboxFile, PS
from utils.main import (get_user_root, parse_md_headers, FolderType,
    create_path_if_not_exist)
from .dbox_utils import is_md
from .dbox_settings import (DEFAULT_ENCODING, MAND_MD_HEADERS, MdState,
    ContentType)
from .dbox_op import get_obj_content
logger = logging.getLogger('edtr_logger')


@gen.engine
def _publish_binary(fm, user, preview, pub_paths, body, db, callback):
    if not preview and fm.pub_status == PS.published:
        logger.debug(u"{0} is already published".format(fm.path))
        callback({"errcode": ErrCode.already_published})
        return
    for pp in pub_paths:
        path_file = os.path.join(pp, fm.path.lstrip('/'))
        create_path_if_not_exist(path_file)
        with open(path_file, 'wb') as f:
            f.write(body)
    if preview:
        if not (fm.pub_status == PS.published or fm.rev == fm.pub_rev):
            fm.pub_status = PS.draft
    else:
        fm.pub_status = PS.published
        fm.pub_rev = fm.rev
    yield motor.Op(fm.update, db, collection=user.name)
    callback({
        "errcode": ErrCode.ok,
        "mime_type": "bin",
        "meta": make_safe_python(DropboxFile, fm, 'public')})


@gen.engine
def _publish_text(fm, user, preview, pub_paths, file_content, db, callback):
    if not preview and fm.pub_status == PS.published:
        logger.debug(u"{0} is already published".format(fm._id))
        callback({"errcode": ErrCode.already_published})
        return
    for pp in pub_paths:
        path_file = os.path.join(pp, fm._id.lstrip('/'))
        create_path_if_not_exist(path_file)
        with open(path_file, 'wb') as f:
            f.write(file_content.encode(DEFAULT_ENCODING))
    if preview:
        if not (fm.pub_status == PS.published and fm.rev == fm.pub_rev):
            fm.pub_status = PS.draft
    else:
        fm.pub_status = PS.published
        fm.pub_rev = fm.rev
    yield motor.Op(fm.update, db, collection=user.name)
    callback({
        "errcode": ErrCode.ok,
        "mime_type": "text",
        "meta": make_safe_python(DropboxFile, fm, 'public')})


@gen.engine
def publish_object(file_meta, user, db, async_dbox, preview=False,
                                                     obj=None, callback=None):
    logger.debug(u"Publishing object. Path: {0}, user: {1}".format(
        file_meta.path, user.name))
    if not obj:
        obj = yield gen.Task(get_obj_content,
            file_meta, user, db, async_dbox, for_publish=True)
    if obj['errcode'] == ErrCode.ok:
        pub_paths = [get_user_root(user.name, FolderType.preview)]
        if not preview:
            pub_paths.append(get_user_root(user.name, FolderType.publish))
        if obj.get('type', None) == ContentType.text_file:
            # Text content
            r = yield gen.Task(_publish_text, DropboxFile(**obj['meta']),
                user, preview, pub_paths, obj['content'], db)
            callback(r)
        else:
            # Non text content. Save from given url.
            r = yield gen.Task(_publish_binary, DropboxFile(**obj['meta']),
                user, preview, pub_paths, obj['body'], db)
            callback(r)
    else:
        callback(obj)


@gen.engine
def dbox_process_publish(updates, user, db, async_dbox, callback):
    errors = []
    for path, meta in updates.items():
        if meta:
            # process updated file
            if is_md(meta):
                # md file
                md_obj = yield gen.Task(get_obj_content,
                    meta, user, db, async_dbox, for_publish=True, rev=meta.rev)
                if md_obj['errcode'] == ErrCode.ok:
                    headers = parse_md_headers(md_obj['content'])
                    missed_headers = [
                        h for h in MAND_MD_HEADERS if h not in headers]
                    if not headers:
                        errors.append(
                            {"description": u"headers not found for {0}".format(
                                path)})
                    elif missed_headers:
                        errors.append(
                            {"description": u"missed headers for {0}".format(
                                path)})
                    else:
                        preview = None
                        if MdState.draft in headers['state']:
                            preview = True
                        elif MdState.published in headers['state']:
                            preview = False
                        if preview is not None:
                            result = yield gen.Task(publish_object, meta,
                                user, db, async_dbox, preview=preview, obj=md_obj)
                            if not result['errcode'] == ErrCode.ok:
                                errors.append(result)
                            else:
                                # update fields in meta
                                for f in result['meta']:
                                    if hasattr(meta, f):
                                        setattr(meta, f, result['meta'][f])
                        elif meta.pub_status != PS.dbox:
                            # TODO md file was published or preview
                            # and now it has state regular
                            # remove it from publish and preview
                            errors.append({"description":
                                u"Removing from pub state not implemented ({0})"\
                                .foramt(path)})
                else:
                    errors.append(md_obj)
            else:
                # non md file
                if meta.pub_status in (PS.draft, PS.published):
                    result = yield gen.Task(publish_object, meta,
                        user, db, async_dbox, preview=True)
                    if not result['errcode'] == ErrCode.ok:
                        errors.append(result)
        else:
            # process deleted file
            print "Processing DELETED file", path
            pass
    if errors:
        logger.error(u"dbox_process_publish errors: {0}".format(
            errors))
        callback({"errcode": ErrCode.unknown_error, "errors": errors})
    else:
        callback({"errcode": ErrCode.ok})
