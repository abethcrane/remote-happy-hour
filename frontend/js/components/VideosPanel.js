import React from 'react';
import { Button } from 'react-bootstrap';
import { Col, Container, Row } from 'react-bootstrap';
import { startCase } from 'lodash';

import Panel from './Panel';
import Video from './Video';

function VideoTile({ id, stream, displayName }) {
  return (
    <div className="flex-vertical-center">
      <div>
        <span>{startCase(displayName)}</span>
      </div>
      <div>
        {stream ? (
          <Video id={id} width={180} stream={stream} />
        ) : (
          <p className="missing-video">No video</p>
        )}
      </div>
    </div>
  );
}

function VideosPanel({ peers, onToggleVideo }) {
  return (
    <Panel>
      <div className="flex-horizontal-center justify-space-between">
        <div>
          <span className="font-size-header">Friends</span>
        </div>
        <div>
          <Button variant="primary" onClick={onToggleVideo}>
            Toggle Video
          </Button>
        </div>
      </div>
      <div className="flex-horizontal-center flex-wrap">
        {peers.map((peer) => (
          <VideoTile key={peer.id} {...peer} />
        ))}
      </div>
    </Panel>
  );
}

export default VideosPanel;
