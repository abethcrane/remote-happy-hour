#version 300 es
precision highp float;
precision highp int;

struct Light {
  vec4 position;
  vec3 color;
  float intensity;
};

const Light[] lights = Light[1](
  Light(
    vec4(0, 0, 10, 1),
    vec3(0.5),
    1.0
  )
);
const vec3 ambientLight = vec3(.1);
const float specularFocus = 32.0;

in vec3 vEyePos;
in vec4 vColor;
in vec3 vNormal;

out vec4 color;

void main()
{
  vec3 sumColor = vec3(0);
  vec3 N = normalize(vNormal);

  for (int i = 0; i < lights.length(); ++i) {
    // Diffuse
    vec3 lightDir = normalize(
      lights[i].position.w < 1e-6 ?
        lights[i].position.xyz :
        (lights[i].position.xyz / lights[i].position.w - vEyePos)
    );

    vec3 Idiff = (vColor.rgb * lights[i].color.rgb) * max(dot(N, lightDir), 0.0);

    // Specular
    vec3 viewDir = -normalize(vEyePos);
    float spec = pow(max(dot(viewDir, reflect(-lightDir, N)), 0.0), specularFocus);
    vec3 Ispec = lights[i].color.rgb * spec * lights[i].intensity;

    sumColor += Idiff;
    sumColor += Ispec;
  }
  sumColor += ambientLight * vColor.rgb;

  color = vec4(clamp(sumColor, 0.0, 1.0), 1.0) * vColor.a;
}
