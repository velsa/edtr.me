from tornado import gen
import logging

l = logging.getLogger('edtr_logger')


class DropBoxSync(object):
    """synchronize with dropbox"""
    def __init__(self, user):
        self.user = user


@gen.engine
def process_web_sync(user, callback=None):
    """
    Execute sync_all_dirs_from_dropbox() for user
    Arguments:
        user:               user to update the tree for
    """
    try:

        #if (datetime.utcnow()-user.last_synced).seconds > 990:#user.sync_interval:
        #else:
        #l.info("To early for a sync.. mnyamm.. (%d)" %\
        #      (datetime.utcnow()-user.last_synced).seconds, )
        #ust_clear_ids(user)
        # Clear the list of changed files
        # It will be updated by the following sync operations

        print "syncing"
    #     MDBUser.objects.filter(pk=user.pk).update(
    #         changes_list= ""
    #     )
    #     # Sync ALL dirs
    #     if django_settings.ASYNC_DROPBOX:
    #         yield gen.Task(sync_all_dirs_from_dropbox,
    #             user.id)
    #     else:
    #         sync_all_dirs_from_dropbox(user.id)
    except Exception, e:
        l.error("Error syncing (%s) ! Will rebuild the whole tree on next sync." % (e, ))
    #     user.cleanup()
    #     raise MDBException('FATAL: PROBLEM WHILE SYNCING ! (%s)'\
    #                        '<br>Please refresh the page to RESYNC ALL FILES. This may take some time....' % (e, ))
    finally:
        if callback:
            callback(user)
