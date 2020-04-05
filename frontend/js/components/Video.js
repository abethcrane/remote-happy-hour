import React from 'react';

class Video extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    return this.props.stream !== nextProps.stream;
  }

  render() {
    const { stream, id, ...rest } = this.props;
    return (
      <video
        autoPlay
        muted
        playsInline
        {...rest}
        ref={(node) => {
          // Why?
          if (!node) return;
          node.srcObject = stream;
        }}
      />
    );
  }
}

export default Video;
