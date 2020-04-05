import { flatten, mapValues, range } from 'lodash';
import { vec2, vec4 } from 'gl-matrix';

export const getCube = (getColor) => {
  const unitVertices = range(8)
    .map((i) => vec4.fromValues(i & 1, (i & 2) >> 1, (i & 4) >> 2, 1))
    .map((v) => vec4.sub(v, v, vec4.fromValues(0.5, 0.5, 0.5, 0)));

  const getFace = (idx) => ({
    coord: idx % 3,
    pos: idx >= 3,
    ccw: idx % 2,
  });

  // Calls a function 6 times, one for each face
  // Expects a list of 6 vectors in return, which it flattens
  const getVertexAttributeByFace = (fn) =>
    flatten(range(6).map(getFace).map(fn));

  const positions = getVertexAttributeByFace(({ coord, pos, ccw }) => {
    const face = range(8).filter((i) => !!(i & (1 << coord)) === pos);
    return [
      face[0],
      face[2 - ccw],
      face[1 + ccw],
      face[3],
      face[1 + ccw],
      face[2 - ccw],
    ].map((vertId) => unitVertices[vertId]);
  });
  const normals = getVertexAttributeByFace(({ coord, pos }) =>
    range(6).map(() => {
      const normal = vec4.create();
      normal[coord] = pos ? 1 : -1;
      return normal;
    })
  );
  const colors = getVertexAttributeByFace((faceInfo) =>
    range(6).map(() =>
      getColor !== undefined ? getColor(faceInfo) : vec4.fromValues(1, 1, 1, 1)
    )
  );

  return {
    positions,
    normals,
    colors,
  };
};

export const getScreenQuad = () => {
  return {
    positions: [
      [-1, -1, 0, 1],
      [1, -1, 0, 1],
      [1, 1, 0, 1],

      [1, 1, 0, 1],
      [-1, 1, 0, 1],
      [-1, -1, 0, 1],
    ],
    texCoords: [
      [0, 1],
      [1, 1],
      [1, 0],
      [1, 0],
      [0, 0],
      [0, 1],
    ],
  };
};

export const flattenVertices = (vertArray) => {
  const length = vertArray.map((v) => v.length).reduce((x, y) => x + y, 0);
  const output = new Float32Array(length);

  let offset = 0;
  vertArray.forEach((vert) => {
    output.set(vert, offset);
    offset += vert.length;
  });
  return output;
};

export const replicate = (count, array) => {
  const card = array.length;
  const output = new Float32Array(card * count);
  range(count).forEach((i) => {
    output.set(array, i * card);
  });
  return output;
};

export const fitRectToFrame = (aspect, frame) => {
  const size = fitAspectToFrame(aspect, frame.size);
  const ctr = {
    x: frame.position.x + frame.size.w * 0.5,
    y: frame.position.y + frame.size.h * 0.5,
  };
  return {
    position: {
      x: ctr.x - size.w * 0.5,
      y: ctr.y - size.h * 0.5,
    },
    size,
  };
};

export const fitAspectToFrame = (aspect, frameSize) => {
  const frameAspect = frameSize.w / frameSize.h;
  return aspect > frameAspect
    ? { ...frameSize, w: frameSize.h * aspect }
    : { ...frameSize, h: frameSize.w / aspect };
};

export const getPointBounds = (points) => {
  const range = mapValues({ min: vec2.min, max: vec2.max }, (reduceFn) =>
    points.reduce((out, val) => reduceFn(out, out, val), vec2.clone(points[0]))
  );
  return {
    position: {
      x: range.min[0],
      y: range.min[1],
    },
    size: {
      w: range.max[0] - range.min[0],
      h: range.max[1] - range.min[1],
    },
  };
};
