import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch,
  withRouter,
} from 'react-router-dom';

import LoginContainer from './LoginContainer';
import RoomContainer from './RoomContainer';
import api from '../utils/api';

import '../../scss/app.scss';

class App extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      currentUser: null,
    };
  }

  componentDidMount() {
    api
      .get('/api/me')
      .then((result) => this.setState({ currentUser: result.user }))
      .catch((error) => console.log('Error', error));
  }

  updateCurrentUser(currentUser) {
    this.setState({ currentUser });
  }

  handleLogout() {
    api
      .post('/api/logout')
      .then((result) => this.setState({ currentUser: result.user }))
      .catch(() => {});
  }

  renderHeader() {
    const { currentUser } = this.state;

    return (
      <div className="app-header flex-horizontal-center justify-space-between px2">
        <div>
          <h2>Happy Hour</h2>
        </div>
        <div>
          {currentUser && <a onClick={() => this.handleLogout()}>Logout</a>}
        </div>
      </div>
    );
  }

  renderBody() {
    const { currentUser } = this.state;

    return (
      <div className="app-body px2">
        {currentUser ? (
          <RoomContainer {...this.props} />
        ) : (
          <LoginContainer
            updateCurrentUser={(user) => this.updateCurrentUser(user)}
            {...this.props}
          />
        )}
      </div>
    );
  }

  render() {
    return (
      <div>
        {this.renderBody()}
        {this.renderHeader()}
      </div>
    );
  }
}

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
