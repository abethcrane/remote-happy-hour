#version 300 es
precision highp float;
precision highp int;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

in vec4 aPosition;
in vec3 aTexCoord;
in vec4 aTexOffset;

out vec2 vTexCoord;
flat out int vTexId;
flat out vec4 vTexOffset;

void main()
{
  vTexCoord = aTexCoord.xy;
  vTexId = int(aTexCoord.z);
  vTexOffset = aTexOffset;

  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition.xyz, 1.0);
}
