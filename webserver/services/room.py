from collections import defaultdict

from ..model.room import Room


class RoomService:
    def __init__(self):
        self._rooms = {}
        self._players = {}
        self._player_id_to_room_id = {}
        self._room_id_to_player_ids = defaultdict(set)

    def get_room_details_response(self, room_id):
        print("get_room_details_response", room_id, self._get_players_for_room_id(room_id))
        room = self._rooms[room_id]
        return dict(players=self._get_players_for_room_id(room_id), **self._rooms[room_id].to_dict(),)

    def get_all_rooms_response(self):
        return list(
            filter(
                lambda room: room["is_public"] and room["num_players"],
                [
                    dict(**room.to_dict(), num_players=len(self._get_players_for_room_id(room.room_id)),)
                    for room in self._rooms.values()
                ],
            )
        )

    def is_player_in_room(self, player_id, room_id):
        return self._player_id_to_room_id.get(player_id) == room_id

    def insert_player_in_room(self, player, room_id):
        self._add_player(player)
        old_room_id = self._set_player_room(player["id"], room_id)
        self._sanity_check()
        return old_room_id

    def delete_player(self, player_id):
        if not player_id in self._players:
            return None
        old_room_id = self._player_id_to_room_id[player_id]
        del self._player_id_to_room_id[player_id]
        del self._players[player_id]
        self._room_id_to_player_ids[old_room_id].remove(player_id)
        return old_room_id

    def update_player(self, player):
        if player["id"] not in self._players:
            raise KeyError(f"Player {player['id']} not recognized.")
        self._players[player["id"]] = player
        return self._player_id_to_room_id[player["id"]]

    def player_can_join_room(self, player_id, room_id):
        return True

    def _get_players_for_room_id(self, room_id):
        return [self._players[pid] for pid in self._room_id_to_player_ids[room_id]]

    def _add_player(self, player):
        self._players[player["id"]] = player

    def _set_player_room(self, player_id, room_id):
        if not room_id in self._rooms:
            self._create_room_for_player(room_id, player_id)

        old_room_id = self._player_id_to_room_id.get(player_id)
        if old_room_id:
            self._room_id_to_player_ids[old_room_id].remove(player_id)
        if old_room_id != room_id:
            self._room_id_to_player_ids[room_id].add(player_id)
            self._player_id_to_room_id[player_id] = room_id
            return old_room_id
        return None

    def _create_room_for_player(self, room_id, player_id):
        self._rooms[room_id] = Room(room_id, room_id != player_id)

    def _sanity_check(self):
        if not set(self._rooms) == set(self._room_id_to_player_ids):
            print("rooms", self._rooms)
            print("room id to player ids", self._room_id_to_player_ids)
            raise RuntimeError("Rooms does not match room ids to player ids")
        if not set(self._players) == set(self._player_id_to_room_id):
            print(self._players)
            print(self._player_id_to_room_id)
            raise RuntimeError("Player ids do not match player to room ids")
        for room_id, player_ids in self._room_id_to_player_ids.items():
            for player_id in player_ids:
                if not self._player_id_to_room_id.get(player_id) == room_id:
                    raise RuntimeError("Room id does not match")
        for player_id, room_id in self._player_id_to_room_id.items():
            if not player_id in self._room_id_to_player_ids.get(room_id, {}):
                raise RuntimeError("Room id does not match in player id -> room id")
