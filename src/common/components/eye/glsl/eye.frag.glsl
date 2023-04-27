#version 300 es

precision highp float;

in vec3 ray_origin;
in vec2 ray_angles;

out vec4 frag_color;

const vec3 CAMERA_DIRECTION = vec3(0.0, 0.0, -1.0);

const vec3 ORB_CENTER = vec3(0.0, 0.0, -2.0);
const float ORB_RADIUS = 1.8;

float orb_sd(vec3 position) {
    return length(position - ORB_CENTER) - ORB_RADIUS;
}

vec3 orb_normal(vec3 position) {
    return normalize(position - ORB_CENTER);
}

const float MAX_LENGTH = 20.0;
const float DIST_THRESHOLD = 0.001;

vec4 march_ray(vec3 origin, vec3 direction) {    
    vec3 position = origin;
    float dist_travelled = 0.0;

    while (dist_travelled < MAX_LENGTH) {
        float sd = orb_sd(position);
        if (sd < DIST_THRESHOLD) return vec4(1.0, 1.0, 1.0, 1.0);
        position += direction * sd;
        dist_travelled += sd;
    }

    return vec4(0.0, 0.0, 0.0, 0.0);
}

void main() {
    vec3 ray_direction = vec3(sin(ray_angles.x), sin(ray_angles.y), -1.0 * cos(ray_angles.x) * cos(ray_angles.y));
    frag_color = march_ray(ray_origin, ray_direction);
}