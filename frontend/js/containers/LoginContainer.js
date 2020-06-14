import React from 'react';
import { Formik } from 'formik';
import { Button, Col, Form, FormControl, Row } from 'react-bootstrap';

import api from '../utils/api';

import '../../scss/app.scss';

const USERNAME = 'guest';

class LoginContainer extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      errorMessage: null,
    };
  }

  handleLogin(values) {
    const { updateCurrentUser } = this.props;
    console.log('Form submit', values);

    api
      .postForm('/api/login', {
        ...values,
        username: USERNAME,
      })
      .then(({ user }) => updateCurrentUser(user))
      .catch(({ message }) => this.setState({ errorMessage: message }));
  }

  render() {
    const { errorMessage } = this.state;

    return (
      <div className="flex-vertical-center">
        {errorMessage && <div>{errorMessage}</div>}
        <Formik
          onSubmit={(values) => this.handleLogin(values)}
          initialValues={{
            password: '',
          }}
        >
          {({ handleSubmit, handleChange, values }) => (
            <Form onSubmit={handleSubmit} className="flex-vertical-center">
              <div className="flex-horizontal-center">
                <Form.Label className="px2">Password</Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  placeholder="Enter password"
                  value={values.password}
                  onChange={handleChange}
                />
              </div>
              <Button className="m2" variant="primary" type="submit">
                Log In
              </Button>
            </Form>
          )}
        </Formik>
      </div>
    );
  }
}

export default LoginContainer;
