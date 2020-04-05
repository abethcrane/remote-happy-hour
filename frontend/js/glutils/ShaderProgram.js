export const loadShaderProgram = (gl, vsSource, fsSource, preLinkCallback) => {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  if (preLinkCallback) {
    preLinkCallback(program);
  }
  gl.linkProgram(program);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        program
      )}`
    );
    return null;
  }

  // Now, automatically get all attributes and uniforms
  const attributes = {};
  const uniforms = {};
  vsSource
    .split('\n')
    .map((s) => s.match(/^(?:layout *\([^)]*\) *)?in \w+ (\w+)/))
    .filter((m) => m)
    .forEach((m) => (attributes[m[1]] = gl.getAttribLocation(program, m[1])));
  [vsSource, fsSource]
    .join('\n')
    .split('\n')
    .map((s) => s.match(/^uniform \w+ (\w+)/))
    .filter((m) => m)
    .forEach((m) => (uniforms[m[1]] = gl.getUniformLocation(program, m[1])));

  return {
    program,
    attributes,
    uniforms,
  };
};

const loadShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};
