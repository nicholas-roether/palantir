#version 300 es

in vec2 vertex_position;

uniform float aspect_ratio;
uniform float field_of_view;

out vec3 ray_origin;
out vec2 ray_angles;

void main() {
    gl_Position = vec4(vertex_position.xy, 0.0, 1.0);

    float camera_bounding_radius;

    if (aspect_ratio >= 1.0) {
        ray_origin = vec3(vertex_position.x, vertex_position.y / aspect_ratio, 0.0);
        camera_bounding_radius = aspect_ratio;
    } else {
        ray_origin = vec3(vertex_position.x * aspect_ratio, vertex_position.y, 0.0);
        camera_bounding_radius = 1.0 / aspect_ratio;
    }

    float max_angle = field_of_view / 2.0;
    ray_angles = max_angle * ray_origin.xy / camera_bounding_radius;
}
