#version 300 es
precision highp float;
precision highp int;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

in vec4 aPosition;
in vec4 aNormal;
in vec4 aColor;

out vec3 vEyePos;
out vec4 vColor;
out vec3 vNormal;

void main()
{
  vEyePos = (uModelViewMatrix * vec4(aPosition.xyz, 1.0)).xyz;
  vNormal = normalize((uModelViewMatrix * vec4(aNormal.xyz, 0.0)).xyz);
  vColor = aColor;

  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition.xyz, 1.0);
}
