edtr.me
===============================================================================

## Quick run guide

- `pip install -r requirements.txt`
- `cp config.flags.sample config.flags`
- Specify `dropbox_consumer_key`, `dropbox_consumer_secret`, `dropbox_access_type` in config.flags. You can find these at [http://www.dropbox.com/developers/apps](http://www.dropbox.com/developers/apps). Access type should be either `'dropbox'` or `'app_folder'`
- Download and install mongodb from [here](http://www.mongodb.org/downloads). On Mac OS with [Homebrew](http://mxcl.github.com/homebrew/) you can simply run `brew install mongodb`
- Run `mongod`. It will automatically bind to port `27017` with simple web UI on [localhost:28017](localhost:28017)
- Run `python app.py` *or for debug mode* `python app.py --debug=True`
- Access the site on [localhost:8888](localhost:8888)

## Description
Web based editor for perfectionists - http://edtr.me

For more information look [here](http://velsa.calepin.co/edtr.me/)

## Directory Structure

    edtr.me/
        handlers/
            base.py
        logconfig/
        models/
        static/
        templates/
        tests/
        utils/

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

### edtr.me/models

Contains all model definitions


### edtr.me/static

A subfolder each for CSS, Javascript and images.

### edtr.me/templates

Folder for all templates

### edtr.me/tests

Folder for all tests

### edtr.me/utils

Contains function-helpers

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
