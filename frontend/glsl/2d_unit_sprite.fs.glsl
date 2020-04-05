#version 300 es
precision highp float;
precision highp int;

in vec2 vTexCoord;
flat in int vTexId;
flat in vec4 vTexOffset;

out vec4 color;

uniform sampler2D uSamplers[12];

vec4 staticTextureLoad(int index, vec2 texCoord)
{
  // The sampler that GLSL ES loads from cannot be chosen dynamically, so we basically have to unroll a loop
  // here such that each texture access is technically hardcoded. Gross.
  if (index == 0) {
    return texture(uSamplers[0], texCoord);
  } else if (index == 1) {
    return texture(uSamplers[1], texCoord);
  } else if (index == 2) {
    return texture(uSamplers[2], texCoord);
  } else if (index == 3) {
    return texture(uSamplers[3], texCoord);
  } else if (index == 4) {
    return texture(uSamplers[4], texCoord);
  } else if (index == 5) {
    return texture(uSamplers[5], texCoord);
  } else if (index == 6) {
    return texture(uSamplers[6], texCoord);
  } else if (index == 7) {
    return texture(uSamplers[7], texCoord);
  } else if (index == 8) {
    return texture(uSamplers[8], texCoord);
  } else if (index == 9) {
    return texture(uSamplers[9], texCoord);
  } else if (index == 10) {
    return texture(uSamplers[10], texCoord);
  } else if (index == 11) {
    return texture(uSamplers[11], texCoord);
  } else {
    return vec4(1, 1, 1, 1);
  }
}

void main()
{
  vec2 texCoord = vTexOffset.xy + mod(vTexCoord, 1.0) * vTexOffset.zw;
  color = staticTextureLoad(vTexId, texCoord);
  // Our textures aren't premultiplied alpha
  color.rgb = color.rgb * color.a;
}
