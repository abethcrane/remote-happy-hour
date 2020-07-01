import React from 'react';
import { Button, Form } from 'react-bootstrap';
import { Col, Container, Row } from 'react-bootstrap';
import { Formik } from 'formik';
import { capitalize, sortBy, toPairs } from 'lodash';

import Panel from './Panel';

function RoomTile({ room_id, num_players, onSelectRoom }) {
  return (
    <a onClick={() => onSelectRoom(room_id)} className="room-tile">
      <span>{room_id}</span>
      <span>{num_players}</span>
    </a>
  );
}

function RoomsPanel({ activeRooms, currentRoom, onSelectRoom }) {
  const header = currentRoom && currentRoom.is_public && (
    <div className="font-size-header">
      <span>Room</span>
      <span className="bold px1">{capitalize(currentRoom.room_id)}</span>
    </div>
  );

  const joinRoomSection = activeRooms.length ? (
    <Row>
      <Container>
        <Row className="bold">Join active rooms:</Row>
        <Row>
          <div className="flex-horizontal-center flex-wrap">
            {activeRooms.map((room, idx) => (
              <RoomTile
                key={room.room_id + idx}
                onSelectRoom={onSelectRoom}
                {...room}
              />
            ))}
          </div>
        </Row>
      </Container>
    </Row>
  ) : null;

  const firstRoom = !(
    (currentRoom && currentRoom.is_public) ||
    activeRooms.length
  );

  const createRoomFooter = (
    <Row className="flex-horizontal-center justify-space-be">
      <Formik
        onSubmit={({ roomName }) => onSelectRoom(roomName)}
        initialValues={{ roomName: '' }}
      >
        {({ handleSubmit, handleChange, values }) => (
          <Form onSubmit={handleSubmit}>
            <Container>
              <Row className="flex-horizontal-center">
                <Col sm="7">
                  {firstRoom ? (
                    <span>Create a room to get started!</span>
                  ) : null}
                </Col>
                <Col sm="3">
                  <Form.Control
                    name="roomName"
                    placeholder="New room..."
                    value={values.roomName}
                    onChange={handleChange}
                  />
                </Col>
                <Col>
                  <Button variant="primary" type="submit">
                    Create
                  </Button>
                </Col>
              </Row>
            </Container>
          </Form>
        )}
      </Formik>
    </Row>
  );

  return (
    <Panel>
      {header}
      {joinRoomSection}
      {createRoomFooter}
    </Panel>
  );
}

export default RoomsPanel;
