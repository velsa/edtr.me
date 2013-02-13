class DB(object):
    @staticmethod
    def instance():
        if not hasattr(DB, "_instance"):
            return None
        return DB._instance

    @staticmethod
    def set_instance(instance):
        DB._instance = instance


class SocketPool(object):
    _dbox_cbk = dict()

    @staticmethod
    def notify_dbox_update(uname, *args, **kwargs):
        if uname in SocketPool._dbox_cbk:
            SocketPool._dbox_cbk[uname](*args, **kwargs)

    @staticmethod
    def add_socket(uname, dbox_callback):
        SocketPool._dbox_cbk[uname] = dbox_callback

    @staticmethod
    def remove_socket(uname):
        if uname in SocketPool._dbox_cbk:
            del SocketPool._dbox_cbk[uname]

    @staticmethod
    def is_socket_opened(uname):
        return uname in SocketPool._dbox_cbk
