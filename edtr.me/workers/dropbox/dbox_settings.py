# -*- coding: utf-8 -*-

# Strange dropbox behaviour:
# File with ANSI (cp1251) encoding, dropbox output as ISO-8859-8 encoding
DROPBOX_ENCODE_MAP = {
    'ISO-8859-8': 'cp1251',
}
DEFAULT_ENCODING = 'utf8'
DELTA_PERIOD_SEC = 5
F_CONT_PER_SEC = 5

MIME_MD = 'application/octet-stream'
TEXT_MIMES = (
    'text/plain',
    'text/html',
    MIME_MD,
)

MAND_MD_HEADERS = ['status', ]


class MdState:
    draft = 'draft'
    published = 'published'


class ContentType:
    directory = 0
    text_file = 1
    image = 2
    binary = 3
