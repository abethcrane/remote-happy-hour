from collections import namedtuple


class Room(namedtuple("_Room", ("room_id", "is_public"))):
    def to_dict(self):
        return self._asdict()
