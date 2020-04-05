/* eslint-disable no-bitwise */
import React from 'react';
import PropTypes from 'prop-types';

import Measure from 'react-measure';

class CanvasContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      size: { width: -1, height: -1 },
    };
  }

  componentDidMount() {
    if (!this.canvasNode) {
      return;
    }

    this._gl = this.canvasNode.getContext('webgl2');
    if (this._gl === null) {
      return;
    }

    // Setup GL defaults
    const gl = this._gl;
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.cullFace(gl.BACK);

    if (this.props.init) {
      this.props.init(this._gl);
    }

    if (this.props.animate) {
      this.renderScene();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.animate && !prevProps.animate && this._gl) {
      this.renderScene();
    }
  }

  componentWillUnmount() {
    // TODO: Proactively release GL resources
    this._gl = null;
  }

  onResize(size) {
    this.setState({ size }, () => {
      if (this._gl) {
        this._gl.viewport(0, 0, size.width, size.height);
      }
      if (this.props.resize) {
        this.props.resize(size);
      }
    });
  }

  renderScene() {
    if (this._gl === null) {
      return;
    }

    if (this.props.render) {
      this.props.render(this._gl);
    } else {
      const gl = this._gl;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    this._gl.flush();

    if (this.props.animate) {
      window.requestAnimationFrame(() => this.renderScene());
    }
  }

  render() {
    return (
      <Measure
        bounds
        onResize={(rect) => {
          this.onResize(rect.bounds);
        }}
      >
        {({ measureRef }) => (
          <div className="full-width full-height" ref={measureRef}>
            <canvas
              ref={(node) => (this.canvasNode = node)}
              width={this.state.size.width}
              height={this.state.size.height}
            />
          </div>
        )}
      </Measure>
    );
  }
}

CanvasContainer.propTypes = {
  init: PropTypes.func,
  render: PropTypes.func,
  resize: PropTypes.func,
  animate: PropTypes.bool,
};

export default CanvasContainer;
