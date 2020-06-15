import os

# TODO: Load different config based on environment
settings = {
    # TODO: Load this secret from an env variable!
    "auth_secret_key": b'_5#y2L"F4Q8z\n\xec]/',
    "debug": False,
    "dev_server_url": None,  #'http://localhost:9081',
    "port": 8000,
    "user_config_file": "config/users.yml",
    "max_players_per_room": 20, #It was 5 because it got laggy, we're trying 20
    "turn_creds_url": "turn:52.249.193.205:3478",
    "turn_creds_username": os.getenv("KANTO_TURN_CREDS_USERNAME"),
    "turn_creds_pass": os.getenv("KANTO_TURN_CREDS_PASS"),
}
