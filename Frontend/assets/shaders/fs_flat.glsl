#version 300 es
precision highp float;

in vec3 v_normal;

uniform vec4 u_color;

out vec4 outColor;

void main() {
    // Simple directional light, so the faces of the cubes can be told apart
    vec3 lightDirection = normalize(vec3(0.4, 1.0, 0.6));
    float light = 0.45 + 0.55 * max(dot(normalize(v_normal), lightDirection), 0.0);
    outColor = vec4(u_color.rgb * light, u_color.a);
}