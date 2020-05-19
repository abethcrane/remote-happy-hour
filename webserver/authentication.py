from flask_login import LoginManager, login_user, logout_user


from .model.user import User
from .utils.passwords import hash_password


class AuthenticationManager:
    def __init__(self, user_service):
        self.user_service = user_service

    def init_app(self, app):
        login_manager = LoginManager()

        login_manager.user_loader(self.load_user)

        login_manager.init_app(app)
        return login_manager

    def load_user(self, user_id):
        return self.user_service.get_user_by_id(user_id)

    def login(self, user_id, password):
        user = self.load_and_validate_user(user_id, password)
        if user:
            login_user(user)
            return user
        else:
            raise ValueError("Incorrect credentials")

    def logout(self):
        logout_user()

    def load_and_validate_user(self, user_id, password):
        user = self.user_service.get_user_by_id(user_id)
        if not user:
            return None

        password_hash = hash_password(password)
        if password_hash != user.password_hash:
            return None

        return user
