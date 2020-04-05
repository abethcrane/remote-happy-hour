import sys
import os

import gevent
from webserver import settings
from webserver.app import create_app


if __name__ == '__main__':
    print('Listening on port', settings.settings['port'])
    sio, app = create_app()
    sio.run(app, host='0.0.0.0', port=settings.settings['port'], debug=settings.settings['debug'], log_output=True)
