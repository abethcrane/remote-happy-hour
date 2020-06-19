import React from 'react';
import { cloneDeep, findIndex, flatten, mapValues, range } from 'lodash';
import { mat4, vec2, vec4 } from 'gl-matrix';
import { startCase } from 'lodash';

import CanvasContainer from './CanvasContainer';
import { createBuffer, updateBuffer } from '../glutils/Buffer';
import {
  flattenVertices,
  fitRectToFrame,
  getPointBounds,
} from '../glutils/Geometry';
import { loadShaderProgram } from '../glutils/ShaderProgram';
import { loadTexture } from '../glutils/Texture';

import vsMesh from '../../glsl/2d_unit_sprite.vs.glsl';
import fsMesh from '../../glsl/2d_unit_sprite.fs.glsl';

class HappyHourRoomController extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      size: {
        width: 1,
        height: 1,
      },
    };

    this._shader = null;
    this._buffers = [];
    this._vao = null;
    this._aspect = 1.0;
    this._numElements = null;
    this._hudCanvasNode = null;
    this._context2d = null;
    this._displayNameData = [];

    this.initGL = this.initGL.bind(this);
    this.renderGL = this.renderGL.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.modelToPosData = this.modelToPosData.bind(this);
    this.modelToTexOffsetData = this.modelToTexOffsetData.bind(this);
    this.modelToTexData = this.modelToTexData.bind(this);
    this.modelToDisplayNameData = this.modelToDisplayNameData.bind(this);

    this._shouldRebuildGeometry = true;
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown, false);

    if (this._hudCanvasNode) {
      this._context2d = this._hudCanvasNode.getContext('2d');
      if (!this._context2d) {
        throw Error('Could not initialize 2d context');
      }
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown, false);
  }

  onKeyDown(e) {
    if (document.activeElement !== document.body) {
      return;
    }

    const actions = {
      a: () => this.props.moveCharacter('left'),
      s: () => this.props.moveCharacter('down'),
      d: () => this.props.moveCharacter('right'),
      w: () => this.props.moveCharacter('up'),
      ArrowRight: () => this.props.moveCharacter('right'),
      ArrowLeft: () => this.props.moveCharacter('left'),
      ArrowUp: () => this.props.moveCharacter('up'),
      ArrowDown: () => this.props.moveCharacter('down'),
    };

    if (!!actions[e.key]) {
      actions[e.key]();
    }
  }

  onResize(size) {
    this._aspect = size.width / size.height;
    this.setState({ size });
  }

  getGeometryBounds() {
    const allRects = this.props.getRenderModels();
    if (!allRects.length) {
      return { min: [-1, -1], max: [1, 1] };
    }
    const allPoints = flatten(
      allRects.map(({ x, y, w, h }) => [
        [x, y],
        [x + w, y + h],
      ])
    );
    return getPointBounds(allPoints);
  }

  getProjectionMatrix() {
    const bounds = this.getGeometryBounds();
    const frame = fitRectToFrame(this._aspect, bounds);
    return mat4.ortho(
      mat4.create(),
      frame.position.x,
      frame.position.x + frame.size.w,
      frame.position.y,
      frame.position.y + frame.size.h,
      -10,
      10
    );
  }

  getModelMatrix() {
    return mat4.create();
  }

  getViewMatrix() {
    return mat4.create();
  }

  getModelViewMatrix() {
    return mat4.mul(mat4.create(), this.getViewMatrix(), this.getModelMatrix());
  }

  rebuildGeometry(gl) {
    const allRects = this.props.getRenderModels();

    Object.keys(this._buffers).forEach((key) => {
      const data = allRects.map((rect) =>
        this._buffers[key].modelToData(rect, this._texIds)
      );
      updateBuffer(gl, this._buffers[key].buf, flattenVertices(flatten(data)));
    });
    this._numElements = allRects.length * 6;

    this._displayNameData = allRects
      .map(this.modelToDisplayNameData)
      .filter((x) => !!x);
  }

  initGL(gl) {
    this._shader = loadShaderProgram(gl, vsMesh, fsMesh);

    this._buffers = {
      pos: {
        pos: this._shader.attributes.aPosition,
        card: 4,
        modelToData: this.modelToPosData,
      },
      tex: {
        pos: this._shader.attributes.aTexCoord,
        card: 3,
        modelToData: this.modelToTexData,
      },
      texOffset: {
        pos: this._shader.attributes.aTexOffset,
        card: 4,
        modelToData: this.modelToTexOffsetData,
      },
    };

    this._vao = gl.createVertexArray();
    gl.bindVertexArray(this._vao);
    Object.keys(this._buffers).forEach((key) => {
      const buffInfo = this._buffers[key];
      buffInfo.buf = createBuffer(gl);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffInfo.buf);
      gl.vertexAttribPointer(
        buffInfo.pos,
        buffInfo.card,
        gl.FLOAT,
        false,
        0,
        0
      );
      gl.enableVertexAttribArray(buffInfo.pos);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    gl.disable(gl.DEPTH_TEST);

    this._texIds = this.props.textureSpecs.map(() => ({}));
    this.props.textureSpecs.forEach((texInfo, idx) => {
      loadTexture(gl, texInfo.path, (id, width, height) => {
        this._texIds[idx] = {
          id,
          width,
          height,
        };
      });
    });
  }

  renderGL(gl) {
    this.rebuildGeometry(gl);

    gl.clearColor(0, 0, 0, this.props.transparentBackground ? 0 : 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (this._texIds.some((texInfo) => texInfo.id === undefined)) {
      return;
    }

    gl.useProgram(this._shader.program);
    gl.bindVertexArray(this._vao);

    window.gl = gl;
    this._texIds.forEach((texInfo, idx) => {
      gl.activeTexture(gl.TEXTURE0 + idx);
      gl.bindTexture(gl.TEXTURE_2D, texInfo.id);
    });

    gl.uniformMatrix4fv(
      this._shader.uniforms.uProjectionMatrix,
      false,
      this.getProjectionMatrix()
    );
    gl.uniformMatrix4fv(
      this._shader.uniforms.uModelViewMatrix,
      false,
      this.getModelViewMatrix()
    );
    const uniformTexIds = range(this._texIds.length);
    gl.uniform1iv(
      this._shader.uniforms.uSamplers,
      new Int32Array(uniformTexIds)
    );

    gl.drawArrays(gl.TRIANGLES, 0, this._numElements);
    gl.bindVertexArray(null);

    // Now, render our 2D canvas!
    this.renderHUDCanvas();
  }

  renderHUDCanvas() {
    if (!this._hudCanvasNode) {
      return;
    }

    const ctx = this._context2d;
    const { width, height } = this._hudCanvasNode;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = this.props.displayNameColor || 'white';
    ctx.textAlign = 'center';
    ctx.font = '18px sans-serif';
    this._displayNameData.forEach(({ x, y, text }) => {
      ctx.fillText(text, x, y);
    });
  }

  render() {
    return (
      <div className="full-width full-height relative">
        <CanvasContainer
          init={this.initGL}
          render={this.renderGL}
          resize={this.onResize}
          animate
        />
        <canvas
          className="roomCanvas absolute"
          width={this.state.size.width}
          height={this.state.size.height}
          ref={(node) => (this._hudCanvasNode = node)}
        />
      </div>
    );
  }

  modelToPosData({ x, y, w, h }) {
    return [
      [x, y, 0, 1],
      [x + w, y, 0, 1],
      [x + w, y + h, 0, 1],
      [x + w, y + h, 0, 1],
      [x, y + h, 0, 1],
      [x, y, 0, 1],
    ];
  }

  modelToTexData({ x, y, w, h, texture, subtexture, tile }) {
    const index = this.getTexIndex(texture);

    if (tile === undefined) {
      tile = 1;
    }
    if (typeof tile === 'number') {
      tile = { x: tile, y: tile };
    }
    const tx = !!tile.x ? 1 / tile.x : 1.0;
    const ty = !!tile.y ? 1 / tile.y : 1;
    // This is where we deal with our textures being inverted
    return [
      [0, ty * h, index],
      [tx * w, ty * h, index],
      [tx * w, 0, index],
      [tx * w, 0, index],
      [0, 0, index],
      [0, ty * h, index],
    ];
  }

  modelToTexOffsetData({ texture, subtexture }) {
    // Cheat in our texture by this many pixels b/c we're getting seams
    const margin = 1;
    const idx = this.getTexIndex(texture);
    if (idx < 0) {
      throw Error(`No texture found matching ${texture}.`);
    }
    const spec = this.props.textureSpecs[idx];

    const dsdp = 1.0 / this._texIds[idx].width;
    const dtdp = 1.0 / this._texIds[idx].height;

    let ds = 1.0 / spec.layout[1];
    let dt = 1.0 / spec.layout[0];
    const s = spec.tiles[subtexture][1] * ds;
    const t = spec.tiles[subtexture][0] * dt;

    return range(6).map(() => [
      s + margin * dsdp,
      t + margin * dtdp,
      ds - 2 * margin * dsdp,
      dt - 2 * margin * dtdp,
    ]);
  }

  getTexIndex(texture) {
    return findIndex(this.props.textureSpecs, (spec) => spec.name === texture);
  }

  modelToDisplayNameData(model) {
    const { x, y, w, h, text } = model;
    if (text === undefined) {
      return null;
    }

    const pjm = mat4.mul(
      mat4.create(),
      this.getProjectionMatrix(),
      this.getModelViewMatrix()
    );
    // Let's use the top-left corner? Shrug?
    const point = vec4.fromValues(x + 0.5 * w, y + h + 0.25, 0, 1);
    // console.log('Model', point);
    const clip = vec4.transformMat4(vec4.create(), point, pjm);
    // console.log('Clip', clip);
    vec4.scaleAndAdd(
      clip,
      vec4.fromValues(0.5, 0.5, 0, 0),
      clip,
      0.5 / clip[3]
    );
    // console.log('Clip Scaled', clip);
    const screen = vec2.mul(
      vec2.create(),
      clip,
      vec2.fromValues(this.state.size.width, this.state.size.height)
    );
    // console.log('Screen', screen);
    return {
      x: screen[0],
      // Let's flip Y for the 2d canvas here
      y: this.state.size.height - screen[1],
      text: startCase(text),
    };
  }
}

export default HappyHourRoomController;
