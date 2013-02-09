class DB(object):
    @staticmethod
    def instance():
        print "Getting instance from {0}".format(id(DB))
        if not hasattr(DB, "_instance"):
            return None
        return DB._instance

    @staticmethod
    def set_instance(instance):
        print "Setting instance to {0}".format(id(DB))
        DB._instance = instance
