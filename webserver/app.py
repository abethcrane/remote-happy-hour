from flask_login import current_user, login_required
from flask_socketio import SocketIO, emit, join_room, leave_room
from functools import wraps
from http import HTTPStatus
from werkzeug.exceptions import HTTPException
import flask
import json
import traceback
import urllib.parse
import yaml

from webserver.settings import settings
from .authentication import AuthenticationManager
from .services.room import RoomService
from .services.user import UserService


def create_app():
    app = flask.Flask(__name__)
    sio = SocketIO(app, cors_allowed_origins="*")

    # Load users
    user_service = UserService(settings["user_config_file"])

    app.secret_key = settings["auth_secret_key"]
    auth_manager = AuthenticationManager(user_service)
    auth_manager.init_app(app)

    app.static_folder = "../static"

    room_service = RoomService()

    @app.route("/", defaults={"path": ""}, methods=["GET"])
    @app.route("/<path:path>", methods=["GET"])
    def index(path):
        return flask.render_template("index.html")

    @app.route("/static/<path:filename>")
    def dev_static(filename):
        return app.send_static_file(filename)

    @app.route("/api/login", methods=["POST"])
    def login():
        print("login")
        try:
            username = flask.request.form["username"]
            password = flask.request.form["password"]
        except HTTPException as e:
            raise APIError("Missing required login parameters", HTTPStatus.BAD_REQUEST)

        try:
            user = auth_manager.login(username, password)
        except ValueError as e:
            raise APIError(e, HTTPStatus.UNAUTHORIZED)

        return json.dumps({"message": "Successfully logged in.", "user": user_to_json(user)})

    @app.route("/api/logout", methods=["POST"])
    def logout():
        auth_manager.logout()
        return json.dumps({"message": "Logged out.", "user": None})

    @app.route("/api/me")
    def get_me():
        return json.dumps({"user": user_to_json(current_user), "turnCreds": {"url": settings.get("turn_creds_url"), "username": settings.get("turn_creds_username"), "pass": settings.get("turn_creds_pass") } })

    @app.errorhandler(APIError)
    def handle_api_error(error):
        return json.dumps({"message": error.message}), error.status_code

    if not settings.get("debug"):

        @app.errorhandler(Exception)
        def handle_generic_error(err):
            app.logger.exception(err)
            return handle_api_error(APIError("Server encountered unknown error.", HTTPStatus.INTERNAL_SERVER_ERROR))

    # NB: There's a difference between sio.emit() and emit()
    # The former is used for server-initiated emits
    # The latter is used if the server is emitting something in reply to an @sio.on() and has more context
    # It allows us to easily only reply back to the sender if e.g. their room is full, only they need to know
    @sio.on("player_update")
    def player_update(data):
        """ Update a single player and echo back all player data to listeners.

        Args:
            { player: PlayerData }
        """
        sid = flask.request.sid
        # NB: When this is first called the player will be in a room by themselves
        # So this room_id will be their sid
        # When they join a group room we remove them from their own room
        room_id = data["room"]
        room_service.update_player(data["player"])
        emit("player_update", room_service.get_room_details_response(room_id), room=room_id)

    @sio.on("join")
    def join(data):
        print("Start of join2")
        room_id = data["room"]
        player = data["player"]

        if room_service.is_player_in_room(player["id"], room_id):
            joined_room_successfully(room_id)
            return

        # Remove the player from any old rooms
        old_room = room_service.delete_player(player["id"])
        if old_room:
            leave_room(old_room)
            player_left_room(player["id"], old_room)

        if not room_service.player_can_join_room(player["id"], room_id):
            emit("join_failure", dict(message="Cannot join room"), broadcast=False)
        else:
            room_service.insert_player_in_room(player, room_id)
            join_room(room_id)
            player_entered_room(player, room_id)
        rooms_changed()

    @sio.on("welcome")
    def welcome(data):
        sid = flask.request.sid
        print("WELCOME from: %s (%s)" % (data["sourceSid"], data["displayName"]))
        emit("welcome", data, room=data["destSid"])  # Only send it to the intended recipient

    @sio.on("ice")
    def ice(data):
        sid = flask.request.sid
        print("ICE to:", data["destSid"])
        emit("ice", data, room=data["destSid"])  # Only send it to the intended recipient

    @sio.on("sdp")
    def sdp(data):
        sid = flask.request.sid
        print("SDP to:", data["destSid"])
        emit("sdp", data, room=data["destSid"])  # Only send it to the intended recipient

    @sio.on("connect")
    def connect():
        sid = flask.request.sid
        print("CONNECT", sid)
        # Give an inital rooms update to the connecting user
        emit("room_update", {"active_rooms": room_service.get_all_rooms_response()}, room=sid)

    @sio.on("disconnect")
    def disconnect():
        sid = flask.request.sid
        print("DISCONNECT", sid)

        old_room = room_service.delete_player(sid)
        player_left_room(sid, old_room)

    @sio.on_error_default
    def default_error_handler(e):
        print(
            "Server Error [{}]:".format(flask.request.event["message"]),
            e,
            "Received data:",
            flask.request.event.get("args"),
        )
        print(traceback.format_exc())
        sio.emit("server_error", str(e))

    def player_left_room(player_id, room_id):
        print("player_left_room", player_id, room_id)
        emit("player_update", room_service.get_room_details_response(room_id), room=room_id)
        emit("bye", player_id, room=room_id, include_self=False)

    def player_entered_room(player, room_id):
        print("player_entered_room", player["id"], room_id)
        emit("player_update", room_service.get_room_details_response(room_id), room=room_id)
        emit("new_user", dict(player=player), include_self=False, room=room_id)
        joined_room_successfully(room_id)

    def joined_room_successfully(room_id):
        emit("join_success", dict(room=room_service.get_room_details_response(room_id)), broadcast=False)

    def rooms_changed():
        emit("room_update", dict(active_rooms=room_service.get_all_rooms_response()), broadcast=True)

    return app


class APIError(Exception):
    def __init__(self, message, status_code):
        self.message = str(message)
        self.status_code = status_code


def api_login_required(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated:
            raise APIError("Login required", HTTPStatus.UNAUTHORIZED)
        return handler(*args, **kwargs)

    return wrapper


def user_to_json(user):
    if user.is_authenticated:
        return {"id": user.id, "displayName": user.display_name}
    else:
        return None
