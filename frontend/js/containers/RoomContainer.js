import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch,
  withRouter,
} from 'react-router-dom';
import { Button, Col, Container, Row } from 'react-bootstrap';
import io from 'socket.io-client';
import moment from 'moment';
import qs from 'qs';
import { startCase } from 'lodash';

import BackgroundAudioContainer from './BackgroundAudioContainer';
import HappyHourRoomContainer from './HappyHourRoomContainer';
import RoomsPanel from '../components/RoomsPanel';
import SceneController from '../controllers/SceneController';
import TexturesManager from '../TexturesManager';
import VideosPanel from '../components/VideosPanel';
import { LayoutsManager } from '../LayoutsManager';
import { WebRTC } from '../webRTC';

class RoomContainer extends React.PureComponent {
  constructor(props) {
    super(props);

    this.layoutsManager = LayoutsManager();
    this.texturesManager = new TexturesManager();

    // Cache these once
    this.layoutNames = this.layoutsManager.GetLayoutNames();
    this.avatarNames = this.texturesManager.GetAvatarNames();

    this.state = {
      currentUser: null,
      playerId: null,
      nextRoomId: '',
      joinedRoomId: null,
      joined: false,
      peers: null,
      players: [],
      currentLayout: 'outside',
      activeRooms: {},
      currentRoom: null,
    };

    this._sceneController = new SceneController(
      this.layoutsManager.GetDataForLayout(this.state.currentLayout),
      this.texturesManager.GetTextureSpecs(),
      []
    );

    this.callUpdateGain = this.callUpdateGain.bind(this);
    this.toggleVideo = this.toggleVideo.bind(this);
    this.joinRoom = this.joinRoom.bind(this);
    this.onMoveCharacter = this.onMoveCharacter.bind(this);
    this.onPeersChanged = this.onPeersChanged.bind(this);
    this.onUpdateCharacter = this.onUpdateCharacter.bind(this);
    this.onSelectLayout = this.onSelectLayout.bind(this);
    this.cleanupComponent = this.cleanupComponent.bind(this);
  }

  componentDidMount() {
    window.addEventListener('beforeunload', this.cleanupComponent);
    this.startConnection();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.getRoomId() !== this.getRoomId(prevProps)) {
      console.log(
        `Room ID changed from ${this.getRoomId(
          prevProps
        )} to ${this.getRoomId()}`
      );
      this.joinRoom();
    }
  }

  getRoomId(props) {
    const urlRoom = (props || this.props).match.params.roomId;
    const personal = this._serverConnection && this._serverConnection.id;
    return urlRoom || personal || null;
  }

  getDisplayName(props) {
    return this.getQueryArgs().displayName !== undefined
      ? this.getQueryArgs().displayName
      : 'player';
  }

  getIconName(props) {
    const name = this.getQueryArgs().iconName;
    const avatarNames = this.avatarNames;
    if (!name || !avatarNames.some((x) => x === name)) {
      return avatarNames[0];
    }
    return name;
  }

  updateDisplayName(displayName) {
    this.updateQueryArgs({ displayName });
  }

  getQueryArgs() {
    return qs.parse(this.props.location.search.replace(/^\??/, ''));
  }

  updateQueryArgs(newArgs) {
    const current = this.getQueryArgs();
    this.props.history.replace({
      pathname: this.props.location.pathname,
      search: qs.stringify({
        ...current,
        ...newArgs,
      }),
    });
  }

  startConnection() {
    const { turnCreds } = this.props;

    this._serverConnection = io.connect();
    this._serverConnection.on('connect', () => {
      console.log('CLIENT CONNECTED', this._serverConnection.id);

      this.webRTC = WebRTC(
        this._serverConnection.id,
        this.getDisplayName(),
        this.onPeersChanged,
        turnCreds
      );
      this.webRTC.SetUpSockets(this._serverConnection);

      this.setState({ playerId: this._serverConnection.id }, () => {
        if (this.getRoomId()) {
          this.joinRoom();
        }
      });
    });

    this._serverConnection.on('join_success', (data) => {
      console.log('join_success', data);
      this.setState({
        joinedRoomId: data.room.room_id,
        currentRoom: data.room,
      });
      this.webRTC.onJoinedRoom(data.room.room_id);
    });

    this._serverConnection.on('join_failure', (data) => {
      console.log('join_failure', data);
      alert('Could not join room');
    });

    this._serverConnection.on('player_update', (data) => {
      this._sceneController.setPlayers(data.players);
      this.setState({ players: data.players });
    });

    this._serverConnection.on('room_update', (data) => {
      console.log('room update', data);

      this.setState({ activeRooms: data.active_rooms });
      // data = roomName and numPlayers
      // and we want to just update our list down the bottom!!
    });
  }

  toggleVideo() {
    try {
      this.webRTC.ToggleMyVideoStream();
    } catch (e) {
      console.log('Caught error while setting up RTC', e);
    }
  }

  joinRoom() {
    if (!this._serverConnection) {
      throw Error('Cannot call joinRoom without serverConnection');
    }
    const room = this.getRoomId();
    this.setState(
      {
        joinedRoomId: null,
        currentRoom: null,
      },
      () => {
        const { playerId } = this.state.playerId;
        const player =
          playerId && this._sceneController.hasPlayerId(playerId)
            ? this._sceneController.getPlayerById(playerId)
            : createDefaultPlayer(
                this._serverConnection.id,
                this.getDisplayName(),
                this.getIconName()
              );
        this._serverConnection.emit('join', { player, room });
      }
    );
  }

  callUpdateGain() {
    this.webRTC.UpdateGain(
      this._sceneController.getPlayerPositions(),
      this.state.playerId
    );
  }

  cleanupComponent() {
    this._serverConnection.disconnect();
    this._serverConnection = null;
  }

  componentWillUnmount() {
    this.cleanupComponent();
    window.removeEventListener('beforeunload', this.cleanupComponent);
  }

  getVisiblePeerObjects() {
    const { peers } = this.state;

    return (peers || [])
      .filter(({ id }) => this._sceneController.hasPlayerId(id))
      .map(({ id, stream }) => ({
        id,
        stream,
        ...this._sceneController.getPlayerById(id),
      }));
  }

  onPeersChanged(peers) {
    this.setState({ peers });
  }

  onMoveCharacter(direction) {
    if (this.state.playerId) {
      this._sceneController.moveCharacter(
        direction,
        this.state.playerId,
        (player) => {
          this._serverConnection.emit('player_update', {
            player,
            room: this.getRoomId(),
          });
        }
      );
    }
  }

  onSelectRoom(room) {
    const { history } = this.props;
    history.push(`/${room}`);
  }

  onUpdateCharacter(params) {
    if (this.state.playerId) {
      const player = this._sceneController.getPlayerById(this.state.playerId);
      this._serverConnection.emit('player_update', {
        player: {
          ...player,
          ...params,
        },
        room: this.state.joined ? this.getRoomId() : this.state.playerId,
      });
    }
    this.updateQueryArgs(params);
  }

  onSelectLayout(layoutName) {
    console.log(
      `onSelectLayout - requesting a change from ${this.state.currentLayout} to ${layoutName}`
    );
    this.setState({ currentLayout: layoutName });
    const newLayoutData = this.layoutsManager.GetDataForLayout(layoutName);
    this._sceneController.setLayout(newLayoutData);
  }

  renderRoomPanel() {
    return (
      <div className="full-width glPanel p2">
        <HappyHourRoomContainer
          transparentBackground
          getRenderModels={this._sceneController.getRenderModels}
          textureSpecs={this._sceneController.getTextureSpecs()}
          moveCharacter={this.onMoveCharacter}
          displayNameColor="white"
        />
      </div>
    );
  }

  renderCharacterControls() {
    return null;
    const makeItem = (name) =>
      name
        ? {
            displayText: startCase(name.replace(/character/, '')),
            iconName: name,
          }
        : null;
    return (
      <FlexContainer direction="horizontal" alignItems="center">
        <FlexItem>
          <Label>Name:</Label>
        </FlexItem>
        <FlexItem className="ml2 pt2">
          <TextBox
            value={this.getDisplayName()}
            onChange={(displayName) => this.onUpdateCharacter({ displayName })}
          />
        </FlexItem>
        <FlexItem className="ml2">
          <Label>Avatar:</Label>
        </FlexItem>
        <FlexItem className="ml2">
          <SingleSelect
            label="Avatar"
            horizontalDirection="left"
            items={this.avatarNames.map((x) => makeItem(x))}
            selectedItem={makeItem(this.getIconName())}
            onChange={({ iconName }) => this.onUpdateCharacter({ iconName })}
          />
        </FlexItem>
        <FlexItem className="ml2">
          <Label>Layout:</Label>
        </FlexItem>
        <FlexItem className="ml2">
          <SingleSelect
            label="Layout"
            horizontalDirection="left"
            items={this.layoutNames.map((layout) => ({
              displayText: layout,
              layoutName: layout,
            }))}
            selectedItem={{
              displayText: this.state.currentLayout,
              layoutName: this.state.currentLayout,
            }}
            onChange={({ layoutName }) => this.onSelectLayout(layoutName)}
          />
        </FlexItem>
      </FlexContainer>
    );
  }

  render() {
    const roomId = this.getRoomId();
    const { activeRooms, currentRoom } = this.state;
    const peers = this.getVisiblePeerObjects();

    return (
      <Container className="app">
        <RoomsPanel
          activeRooms={activeRooms}
          currentRoom={currentRoom}
          onSelectRoom={(room) => this.onSelectRoom(room)}
        />
        {!!peers.length && (
          <VideosPanel peers={peers} onToggleVideo={this.toggleVideo} />
        )}
        <Row>
          {roomId && this.state.playerId ? this.renderRoomPanel() : null}
        </Row>
        <Row>
          <h4 className="center">WASD or arrow keys to move</h4>
          <h5 className="center">
            Volume is based on distance apart from other avatars!
          </h5>
        </Row>
      </Container>
    );
  }
}

const createDefaultPlayer = (id, displayName, iconName) => ({
  id,
  actions: [],
  lastAction: null,
  lastPosition: { x: 0, y: 0 },
  lastTime: moment().valueOf(),
  iconName: iconName || 'beth',
  secsPerStep: 0.5,
  displayName: displayName,
});

export default RoomContainer;
