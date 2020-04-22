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

import { WebRTC } from '../webRTC';
import TexturesManager from '../TexturesManager';
import { LayoutsManager } from '../LayoutsManager';
import HappyHourRoomContainer from './HappyHourRoomContainer';
import BackgroundAudioContainer from './BackgroundAudioContainer';
import SceneController from '../controllers/SceneController';
import Video from '../components/Video';

import '../../scss/app.scss';

class App extends React.PureComponent {
  constructor(props) {
    super(props);

    this.layoutsManager = LayoutsManager();
    this.texturesManager = new TexturesManager();

    // Cache these once
    this.layoutNames = this.layoutsManager.GetLayoutNames();
    this.avatarNames = this.texturesManager.GetAvatarNames();

    this.state = {
      playerId: null,
      nextRoomId: '',
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
    this.onJoinedRoom = this.onJoinedRoom.bind(this);
  }

  componentDidMount() {
    this.startConnection();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.getRoomId() !== this.getRoomId(prevProps)) {
      console.log(
        `Room ID changed from ${this.getRoomId(
          prevProps
        )} to ${this.getRoomId()}`
      );
      if (this.getRoomId(prevProps)) {
        // Currently, we force the browser to reload if the user is leaving a room
        window.location.reload();
      } else {
        this.startConnection();
      }
    }
  }

  getRoomId(props) {
    if (this.state.joined) {
      return this.state.currentRoom;
    }

    return (props || this.props).match.params.roomId;
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
    this._serverConnection = io.connect();
    this._serverConnection.on('connect', () => {
      console.log('CLIENT CONNECTED', this._serverConnection.id);

      this.webRTC = WebRTC(
        this._serverConnection.id,
        this.getDisplayName(),
        this.onPeersChanged,
        this.onJoinedRoom
      );
      this.webRTC.SetUpSockets(this._serverConnection);

      // If we're reconnecting, attempt to send our preexisting player's info while joining
      const player = this.state.playerId
        ? this._sceneController.getPlayerById(this.state.playerId)
        : createDefaultPlayer(this.getDisplayName(), this.getIconName());
      // The server requires that the player first send positions to a room w/ their own sid
      this._serverConnection.emit('player_update', {
        player,
        room: this._serverConnection.id,
      });
      this.setState({ playerId: this._serverConnection.id, joined: false });
    });

    this._serverConnection.on('player_update', (data) => {
      this._sceneController.setPlayers(data.players);
      this.setState({ players: data.players });
    });

    this._serverConnection.on('room_update', (data) => {
      console.log('got a room_update from server');
      console.log(data.activeRooms);

      this.setState({ activeRooms: data.activeRooms });
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

  joinRoom(roomId) {
    if (!roomId) {
      roomId = this.getRoomId();
    }
    try {
      this.webRTC.JoinRoom(roomId, this.getDisplayName());
      setInterval(this.callUpdateGain, 30); // or whatever step is reasonable
    } catch (e) {
      console.log('Caught error while setting up RTC', e);
    }
  }

  callUpdateGain() {
    this.webRTC.UpdateGain(
      this._sceneController.getPlayerPositions(),
      this.state.playerId
    );
  }

  componentWillUnmount() {
    this._serverConnection.disconnect();
    this._serverConnection = null;
  }

  onPeersChanged(peers) {
    this.setState({ peers });
  }

  onJoinedRoom(roomId) {
    this.setState({ joined: true, currentRoom: roomId });
  }

  onMoveCharacter(direction) {
    if (this.state.playerId) {
      this._sceneController.moveCharacter(
        direction,
        this.state.playerId,
        (player) => {
          this._serverConnection.emit('player_update', {
            player,
            room: this.state.joined ? this.getRoomId() : this.state.playerId,
          });
        }
      );
    }
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
          //transparentBackground
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

  renderRoomSelect() {
    return null;
    return (
      <FlexContainer direction="horizontal" alignItems="center">
        <FlexItem>
          <Label>Go to room:</Label>
        </FlexItem>
        <FlexItem className="pt2 ml2">
          <TextBox
            value={this.state.nextRoomId}
            onChange={(nextRoomId) => {
              this.setState({ nextRoomId });
            }}
          />
        </FlexItem>
        <FlexItem className="ml2">
          <ActionButton
            disabled={
              !this.state.nextRoomId || this.state.nextRoomId.length === 0
            }
            onClick={() => this.joinRoom(this.state.nextRoomId)}
          >
            GO
          </ActionButton>
        </FlexItem>
      </FlexContainer>
    );
  }

  renderPeers() {
    if (this.state.peers === null) {
      return null;
    }

    return (
      <div id="videos" className="videos">
        <Container className="full-width scroll-x">
          <Row>
            {this.state.peers
              .filter((p) => this._sceneController.hasPlayerId(p.id))
              .map(({ id, stream }) => (
                <Col className="mx2" key={id}>
                  <Container>
                    <Row>
                      <span>
                        {startCase(
                          this._sceneController.getPlayerById(id).displayName
                        )}
                      </span>
                    </Row>
                    <Row>
                      {stream ? (
                        <Video id={id} width={180} stream={stream} />
                      ) : (
                        <p className="missing-video">No video</p>
                      )}
                    </Row>
                  </Container>
                </Col>
              ))}
          </Row>
        </Container>
      </div>
    );
  }

  renderActiveRooms() {
    return null;
    const { activeRooms } = this.state;
    const roomIds = Object.keys(activeRooms);

    if (roomIds.length == 0) {
      return <h4>No active rooms - be the first to start one!</h4>;
    }

    return (
      <div>
        <h3>Active Rooms</h3>
        <h4>Click to join</h4>
        <ContainerFluid>
          {roomIds.map((id) => (
            <ul key={'activeRoom-' + id}>
              <a
                id={'joinRoomLink-' + id}
                href="#"
                onClick={() => this.joinRoom(id)}
              >
                {id}
              </a>
              : {activeRooms[id]} friend{activeRooms[id] > 1 ? 's' : ''}
            </ul>
          ))}
        </ContainerFluid>
      </div>
    );
  }

  render() {
    const roomId = this.getRoomId();

    return (
      <Container className="app">
        <Row>
          <Col>Happy Hour</Col>
          {roomId ? (
            <Col>
              <h2>{'/' + roomId}</h2>
            </Col>
          ) : null}
          <Col>
            <Button onClick={this.toggleVideo}>Toggle Video</Button>
            &nbsp;
            <Button
              disabled={this.state.joined || !this.getRoomId()}
              onClick={this.joinRoom}
            >
              Join Room
            </Button>
          </Col>
          {roomId ? <Col>{this.renderCharacterControls()}</Col> : null}
          {!roomId ? <Col>{this.renderRoomSelect()}</Col> : null}
        </Row>
        <Row>{this.renderPeers()}</Row>
        <Row>
          {roomId && this.state.playerId ? this.renderRoomPanel() : null}
        </Row>
        <Row>
          <h4 className="center">WASD or arrow keys to move</h4>
          <h5 className="center">
            Volume is based on distance apart from other avatars!
          </h5>
        </Row>
        <Row>{this.renderActiveRooms()}</Row>
      </Container>
    );

    // return (
    //   <div className="app container full-width">
    //     <FlexContainer
    //       direction="horizontal"
    //       alignItems="center"
    //       justifyContent="space-between"
    //     >
    //       <FlexItem>
    //         <FlatironLogo height={80} />
    //       </FlexItem>
    //       <FlexItem>
    //         <ActionButton onClick={this.toggleVideo}>Toggle Video</ActionButton>
    //         &nbsp;
    //         <ActionButton
    //           disabled={this.state.joined || !this.getRoomId()}
    //           onClick={this.joinRoom}
    //         >
    //           Join Room
    //         </ActionButton>
    //       </FlexItem>
    //       {roomId ? this.renderCharacterControls() : null}
    //       {!roomId ? this.renderRoomSelect() : null}
    //     </FlexContainer>
    //     {this.renderPeers()}
    //     {roomId && this.state.playerId ? this.renderRoomPanel() : null}
    //     <h4 className="center">WASD or arrow keys to move</h4>
    //     <h5 className="center">
    //       Volume is based on distance apart from other avatars!
    //     </h5>
    //     {this.renderActiveRooms()}
    //     <BackgroundAudioContainer
    //       key={this.state.currentLayout}
    //       layout={this.state.currentLayout}
    //     />
    //   </div>
    // );
  }
}

const createDefaultPlayer = (displayName, iconName) => ({
  actions: [],
  lastAction: null,
  lastPosition: { x: 0, y: 0 },
  lastTime: moment().valueOf(),
  iconName: iconName || 'character_jesse',
  secsPerStep: 0.5,
  displayName: displayName,
});

const AppWithConnectedRouter = withRouter(App);

const AppContainer = () => (
  <Router>
    <Switch>
      <Route path="/:roomId" component={AppWithConnectedRouter} />
      <Route path="/" component={AppWithConnectedRouter} />
    </Switch>
  </Router>
);

export default AppContainer;
