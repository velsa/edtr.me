"""Contains utils for auth. Password processing mostly taken from
https://github.com/hmarr/mongoengine/blob/master/mongoengine/django/auth.py
"""
import hashlib
from django.utils.encoding import smart_str

def get_hexdigest(algorithm, salt, raw_password):
    raw_password, salt = smart_str(raw_password), smart_str(salt)
    if algorithm == 'md5':
        return hashlib.md5(salt + raw_password).hexdigest()
    elif algorithm == 'sha1':
        return hashlib.sha1(salt + raw_password).hexdigest()
    raise ValueError('Got unknown password algorithm type in password')

def check_password(raw_password, password):
    algo, salt, hash = password.split('$')
    return hash == get_hexdigest(algo, salt, raw_password)

def make_password(raw_password):
    from random import random
    algo = 'sha1'
    salt = get_hexdigest(algo, str(random()), str(random()))[:5]
    hash = get_hexdigest(algo, salt, raw_password)
    return '%s$%s$%s' % (algo, salt, hash)