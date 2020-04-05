#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uTexture;
uniform vec2 uPixelSize;

in vec2 vTexCoord;

out vec4 color;

void main()
{
  // vec4 outColor = vec4(0.0);
  // const int S = 2;
  // for (int i = -S; i <= S; ++i) {
  //   for (int j = -S; j <= S; ++j) {
  //     outColor = outColor + texture(uTexture, vTexCoord + vec2(i, j) * uPixelSize);
  //   }
  // }
  // color = outColor / float((S + 1) * (S + 1));

  // color = texture(uTexture, vTexCoord);

  color = texture(uTexture, vTexCoord) * vec4(1, 0, 0, 1);
}
