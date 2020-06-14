import React from 'react';
import { Container, Row } from 'react-bootstrap';

function Panel({ children }) {
  return <Container className="panel">{children}</Container>;
}

export default Panel;
