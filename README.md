edtr.me
===============================================================================

## Description
Web based editor for perfectionists - http://edtr.me

For more information look [here](http://velsa.calepin.co/edtr.me/)

## Directory Structure

    edtr.me/
        handlers/
            base.py
        logconfig/
        static/
        templates/
        tests/

        app.py
        settings.py
        urls.py
        requirements.txt

    etc/

### edtr.me/handlers

All of Tornado RequestHandlers go in this directory.

### edtr.me/logconfig

An extended version of the
[log_settings](https://github.com/jbalogh/zamboni/blob/master/log_settings.py)
module from Mozilla's [zamboni](https://github.com/jbalogh/zamboni).

### edtr.me/static

A subfolder each for CSS, Javascript and images.

### edtr.me/templates

Folder for all templates

### edtr.me/tests

Folder for all tests

### etc/

Contains configuration files, needed to launch project (nginx, etc)


### Files

#### edtr.me/app.py

The main Tornado application, and also a runnable file that starts the Tornado 
server.

to start tornado server in debug mode:

    python app.py --debug=True

#### edtr.me/settings.py

A place to collect application settings ala Django. There's undoubtedly a better
way to do this, considering all of the flak Django is taking lately for this
global configuration. For now, it works.

#### edtr.me/urls.py

Contains all url_patterns and their handlers