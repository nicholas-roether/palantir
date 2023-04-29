#version 300 es

precision highp float;

in vec3 ray_origin;
in vec2 ray_angles;

out vec4 fragment_color;

void main() {
    fragment_color = vec4(1.0, 1.0, 1.0, 1.0);
}