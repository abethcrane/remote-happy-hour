export const createBuffer = (gl, values, type) => {
  const buffer = gl.createBuffer();

  if (values !== undefined) {
    updateBuffer(gl, buffer, values, type);
  }

  return buffer;
};

export const updateBuffer = (gl, buffer, values, type) => {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  type = type || gl.STATIC_DRAW;
  if (typeof values === 'number') {
    gl.bufferData(gl.ARRAY_BUFFER, values, type);
  } else {
    // array
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), type);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};
