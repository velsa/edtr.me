class DB(object):
    @staticmethod
    def instance():
        if not hasattr(DB, "_instance"):
            return None
        return DB._instance

    @staticmethod
    def set_instance(instance):
        DB._instance = instance
