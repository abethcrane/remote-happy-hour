//
// Thanks to https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
export const loadTexture = (gl, url, onReady) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);

      // Because images have to be download over the internet
      // they might take a moment until they are ready.
      // Until then put a single pixel in the texture so we can
      // use it immediately. When the image has finished downloading
      // we'll update the texture with the contents of the image.
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 1;
      const height = 1;
      const border = 0;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
      gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        width,
        height,
        border,
        srcFormat,
        srcType,
        pixel
      );

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        srcFormat,
        srcType,
        image
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

      resolve({ id: texture, width: image.width, height: image.height });
    };
    image.onerror = () => {
      reject();
    };
    image.src = url;
  });

const isPowerOf2 = (value) => (value & (value - 1)) == 0;
