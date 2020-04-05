/* eslint-disable no-bitwise */
import React from 'react';
import { mat4, vec4 } from 'gl-matrix';

import CanvasContainer from './CanvasContainer';
import { flattenVertices, getCube } from '../glutils/Geometry';
import { loadShaderProgram } from '../glutils/ShaderProgram';
import { createBuffer } from '../glutils/Buffer';

import vsMesh from '../../glsl/mesh_4.vs.glsl';
import fsMesh from '../../glsl/mesh_4.fs.glsl';

const D2R = (x) => (x * Math.PI) / 180.0;

class CubeContainer extends React.Component {
  constructor(props) {
    super(props);

    this._shader = null;
    this._buffers = [];
    this._vao = null;
    this._aspect = 1.0;

    this.initGL = this.initGL.bind(this);
    this.renderGL = this.renderGL.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  onResize(size) {
    this._aspect = size.width / size.height;
  }

  getProjectionMatrix() {
    return mat4.perspective(mat4.create(), D2R(30.0), this._aspect, 0.01, 10);
  }

  getModelMatrix() {
    const t = new Date().getTime() * 0.001;
    return mat4.fromRotation(mat4.create(), D2R(t * 90), [1, 1, 0]);
  }

  getViewMatrix() {
    return mat4.fromTranslation(mat4.create(), vec4.fromValues(0, 0, -5, 1));
  }

  getModelViewMatrix() {
    return mat4.mul(mat4.create(), this.getViewMatrix(), this.getModelMatrix());
  }

  initGL(gl) {
    this._shader = loadShaderProgram(gl, vsMesh, fsMesh);

    // create cube geometry
    this._cubeVerts = getCube(({ coord }) => {
      const color = vec4.fromValues(0, 0, 0, 1);
      color[coord] = 1;
      return color;
    });
    this._buffers = [
      {
        pos: this._shader.attributes.aPosition,
        buf: createBuffer(gl, flattenVertices(this._cubeVerts.positions)),
      },
      {
        pos: this._shader.attributes.aColor,
        buf: createBuffer(gl, flattenVertices(this._cubeVerts.colors)),
      },
      {
        pos: this._shader.attributes.aNormal,
        buf: createBuffer(gl, flattenVertices(this._cubeVerts.normals)),
      },
    ];

    this._vao = gl.createVertexArray();
    gl.bindVertexArray(this._vao);
    this._buffers.forEach((buffInfo) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffInfo.buf);
      gl.vertexAttribPointer(buffInfo.pos, 4, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(buffInfo.pos);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  renderGL(gl) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._shader.program);
    gl.bindVertexArray(this._vao);

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

    gl.drawArrays(gl.TRIANGLES, 0, this._cubeVerts.positions.length);
    gl.bindVertexArray(null);
  }

  render() {
    return (
      <CanvasContainer
        init={this.initGL}
        render={this.renderGL}
        resize={this.onResize}
        animate
      />
    );
  }
}

export default CubeContainer;
