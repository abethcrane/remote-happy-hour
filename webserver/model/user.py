from collections import namedtuple


from flask_login import UserMixin


class User(namedtuple("_User", ("id", "display_name", "password_hash")), UserMixin):
    pass
