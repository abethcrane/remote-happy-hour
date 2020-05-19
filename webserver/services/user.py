import yaml

from ..model.user import User


class UserService:
    def __init__(self, config_path):
        with open(config_path, "r") as f:
            data = yaml.safe_load(f)
        self._users = [User(**u) for u in data["users"]]

    def get_user_by_id(self, user_id):
        matching = [u for u in self._users if u.id == user_id]
        return matching[0] if matching else None
