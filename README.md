# remote-happy-hour
A chat room web app that allows you to control a (super cute) 2D avatar. Audio volume is modulated so that you can hear the people closest to you the loudest.

## Dev Setup ##
- Install pyenv / Install python 3.6.5
- Install nvm / Install Node 11.9.0 / nvm use in the dir
- Run ./scripts/init_venv
- source venv/bin/activate

## Dev Iteration ##
- in 1 tab, `cd frontend` and run `yarn build:dev`
- in another tab, run `./scripts/start` from the root dir (make sure you're in the virtual env)

## After pulling ##
- `cd frontend` and run `yarn install`
