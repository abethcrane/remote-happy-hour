
from flask_socketio import SocketIO, emit, join_room, leave_room
from webserver.settings import settings
import flask
import traceback
import urllib.parse

def create_app():
    app = flask.Flask(__name__)
    sio = SocketIO(app,
        cors_allowed_origins="*"
    )

    app.static_folder = '../static'

    rooms = {}

    @app.route('/', defaults={'path': ''}, methods=['GET'])
    @app.route('/<path:path>', methods=['GET'])
    def index(path):
        return flask.render_template('index.html')

    @app.route('/dev_static/<path:filename>')
    def dev_static(filename):
        return app.send_static_file(filename)

    # NB: There's a difference between sio.emit() and emit()
    # The former is used for server-initiated emits
    # The latter is used if the server is emitting something in reply to an @sio.on() and has more context
    # It allows us to easily only reply back to the sender if e.g. their room is full, only they need to know
    @sio.on('player_update')
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

        if room_id not in rooms:
            rooms[room_id] = RoomMetadata(room_id, sid)
        room_metadata = rooms[room_id]

        # Add them to the room and send a player_update
        room_metadata.upsert_player(sid, data["player"])
        emit('player_update', room_metadata.to_response(), room=room_id)

    @sio.on('join')
    def join(data):
        sid = flask.request.sid
        room_id = data["room"]

        # create room if necessary
        if room_id not in rooms:
            rooms[room_id] = RoomMetadata(room_id, sid)
        room_metadata = rooms[room_id]

        # If the player's not already in this room, and the room has space for the player
        if room_metadata.get_player(sid) is None and room_metadata.num_players() < 5:
            # Get the player data from their own 'room' now that they're in a shared one
            player_data = rooms[sid].get_player(sid)
            # Now add them to the room
            room_metadata.upsert_player(sid, player_data)
            join_room(room_id)
            emit('player_update', room_metadata.to_response(), room=room_id)

            print ("JOIN: %s (%s) in room %s" %(data["sourceSid"], data["displayName"], room_id))

            # Send an update to tell our game that the room's changed!!allRooms
            emit('room_update', {"activeRooms": get_active_rooms_response()}, broadcast=True)

            emit("new_user", data, include_self=False, room=room_id)
            emit("joined", room_id, broadcast=False)
        elif room_metadata.num_players() >= 5:
            emit("full", room_id, broadcast=False)
        # else they're already in the room...shrug?

    @sio.on('welcome')
    def welcome(data):
        print(data)
        sid = flask.request.sid
        print("WELCOME from: %s (%s)" %(data["sourceSid"], data["displayName"]))
        emit("welcome", data, room=data["destSid"]) # Only send it to the intended recipient

    @sio.on('ice')
    def ice(data):
        sid = flask.request.sid
        print("ICE to:", data["destSid"])
        emit("ice", data, room=data["destSid"]) # Only send it to the intended recipient

    @sio.on('sdp')
    def sdp(data):
        sid = flask.request.sid
        print("SDP to:", data["destSid"])
        emit("sdp", data, room=data["destSid"]) # Only send it to the intended recipient

    @sio.on('exit_room')
    def bye(data):
        sid = flask.request.sid
        print('EXIT ROOM', sid)
        remove_player_from_room(sid, data["room"])
        take_away_old_room_users_for_player(sid, data["room"])

    @sio.on('connect')
    def connect():
        sid = flask.request.sid
        print('CONNECT', sid)
        # Give an inital rooms update to the connecting user
        emit('room_update', {"activeRooms": get_active_rooms_response()}, room=sid)

    @sio.on('disconnect')
    def disconnect():
        sid = flask.request.sid
        print('DISCONNECT', sid)

        # remove_player_from_room also cleans up the room, maybe deleting it from rooms
        # so we have to do the deletes after, not while we're looping through the dictionary
        rooms_to_remove_player_from = []
        for room_id, room_metadata in rooms.items():
            # For each room the player is in (should only be 1 at the moment)
            if room_metadata.get_player(sid) is not None:
                rooms_to_remove_player_from.append(room_id)

        for room in rooms_to_remove_player_from:
            remove_player_from_room(sid, room)

    @sio.on_error_default
    def default_error_handler(e):
        print(
            'Server Error [{}]:'.format(flask.request.event['message']),
            e,
            'Received data:',
            flask.request.event.get('args'))
        print(traceback.format_exc())
        sio.emit('server_error', str(e))

    def remove_player_from_room(sid, room_id):
        print("Removing %s from room %s" %(sid, room_id))
        room_metadata = rooms[room_id]
        room_metadata.delete_player(sid)
        emit('player_update', room_metadata.to_response(), room=room_id)

        emit('bye', sid, room=room_id, include_self=False)
        leave_room(room_id)  #NB this is a socketio function

        # If the last player is leaving, delete the room
        if (room_metadata.num_players() == 0):
            print ("Deleting a room!", room_id)
            del rooms[room_id]

        # Send an update to tell our game that the room's changed!!
        emit('room_update', {"activeRooms": get_active_rooms_response()}, broadcast=True)

    # TODO: Name this better lol
    def take_away_old_room_users_for_player(sid, room_id):
        # We're going to emit 'byes' to just the player who is leaving, for all players in the old room
        room_metadata = rooms[room_id]
        for player in room_metadata.get_players():
            emit('bye', player['id'], room=sid)

    def get_active_rooms_response():
        print("Getting active rooms")
        room_stats = {}
        for room_id, room_metadata in rooms.items():
            if room_metadata.is_public():
                room_stats[room_id] = room_metadata.num_players()
        return room_stats

    return app


class RoomMetadata:
    def __init__(self, room_id, creating_sid):
        print("Creating a new room", room_id, creating_sid, creating_sid == room_id)
        self._players = {}
        self._room_id = room_id
        self._is_players_private_room = creating_sid == room_id

    def is_public(self):
        return not self._is_players_private_room

    def num_players(self):
        return len(self._players)

    def get_player(self, player_id):
        if player_id in self._players:
            return self._players[player_id]
        return None

    def get_players(self):
        return self._players.values()

    def upsert_player(self, player_id, player):
        # If the player_id is changing, move the object
        # This could happen maybe if the client tries to connect a player with old data
        if player_id != player.get('id') and player.get('id') in self._players:
            del self._players[player.get('id')]
        player['id'] = player_id
        self._players[player_id] = player

    def delete_player(self, player_id):
        if player_id in self._players:
            del self._players[player_id]

    def to_response(self):
        return dict(room_id=self._room_id, players=list(self._players.values()))