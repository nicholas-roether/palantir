#version 300 es

precision highp float;

in vec3 ray_origin;
in vec2 ray_angles;

uniform highp sampler3D noise_texture;

out vec4 frag_color;

vec4 mix_colors(vec4 lower, vec4 higher) {
    float mixed_alpha = 1.0 - (1.0 - lower.a) * (1.0 - higher.a);
    float t = higher.a / (higher.a + lower.a);
    return vec4(mix(lower.rgb, higher.rgb, t), mixed_alpha);
}

const vec3 ORB_CENTER = vec3(0.0, 0.0, -2.0);
const float ORB_RADIUS = 1.8;

float orb_sd(vec3 position) {
    return length(position - ORB_CENTER) - ORB_RADIUS;
}

vec3 orb_normal(vec3 position) {
    return normalize(position - ORB_CENTER);
}

const vec3 LIGHT_DIRECTION = normalize(vec3(-1.0, -1.0, -1.0));
const float LIGHT_STRENGTH = 0.1;

vec4 get_light_color(vec3 direction) {
    float dot_prod = dot(direction, -LIGHT_DIRECTION);
    return max(dot_prod, 0.0) * vec4(1.0, 1.0, 1.0, LIGHT_STRENGTH);
}

const float SMOKE_TEX_SIZE = 50.0;

const float SMOKE_CUTOFF = 0.7;

float get_smoke_translucency(vec3 position) {
    vec3 pos_orbspace = (position - ORB_CENTER) / ORB_RADIUS * sqrt(2.0);
    vec3 pos_texspace = (pos_orbspace - vec3(0.5, 0.5, 0.5));
    float raw_value = texture(noise_texture, pos_texspace).r;
    float normalized = max(0.0, raw_value);
    return (min(1.0, raw_value + SMOKE_CUTOFF) - SMOKE_CUTOFF) / (1.0 - SMOKE_CUTOFF);
}

const float SMOKE_SAMPLE_DIST = 0.001;
const vec4 SMOKE_BASE_COLOR = vec4(0.2, 0.2, 0.2, 0.2);
const vec4 SMOKE_LIGHT_COLOR = vec4(1.0, 0.3, 0.2, 1.0);
const float SMOKE_LIGHT_SPREAD = 1.0;
const float SMOKE_LIGHT_STRENGTH = 0.6;

vec4 get_smoke_light_color(float closest_to_center) {
    float light_strength = exp(-closest_to_center / SMOKE_LIGHT_SPREAD) * SMOKE_LIGHT_STRENGTH;
    return vec4(SMOKE_LIGHT_COLOR.rgb, SMOKE_LIGHT_COLOR.a * light_strength);
}

vec4 ray_render_smoke(vec3 origin, vec3 direction, float max_length) {
    vec3 position = origin;
    float translucency = 1.0;
    float dist_travelled = 0.0;
    float closest_to_center = 100000.0;

    while (dist_travelled < max_length) {
        position += SMOKE_SAMPLE_DIST * direction;
        dist_travelled += SMOKE_SAMPLE_DIST;
        float dist_to_orb_center = distance(position, ORB_CENTER);
        if (dist_to_orb_center < closest_to_center) closest_to_center = dist_to_orb_center;
        if (dist_to_orb_center >= ORB_RADIUS) continue;

        translucency *= mix(1.0, get_smoke_translucency(position), SMOKE_SAMPLE_DIST);
        if (translucency == 0.0) break;
    }
    
    vec4 light_color = get_smoke_light_color(closest_to_center);
    vec4 combined_color = mix_colors(SMOKE_BASE_COLOR, light_color);

    return vec4(combined_color.rgb, (1.0 - translucency) * combined_color.a);
}

const float ORB_RAY_MAX_LENGTH = 20.0;
const float DIST_THRESHOLD = 0.0001;

vec4 ray_render_orb(vec3 origin, vec3 direction, float max_length) {    
    vec3 position = origin;
    float dist_travelled = 0.0;

    while (dist_travelled < max_length) {
        float sd = orb_sd(position);
        if (sd < DIST_THRESHOLD) {
            vec3 normal = orb_normal(position);
            vec3 refracted_direction = direction - 2.0 * normal * dot(direction, normal);
            vec4 light_color = get_light_color(refracted_direction);
            vec4 smoke_color = ray_render_smoke(position, direction, ORB_RADIUS);
            return mix_colors(smoke_color, light_color);
        }
        position += direction * sd;
        dist_travelled += sd;
    }

    return vec4(0.0, 0.0, 0.0, 0.0);
}

void main() {
    vec3 ray_direction = vec3(sin(ray_angles.x), sin(ray_angles.y), -1.0 * cos(ray_angles.x) * cos(ray_angles.y));
    frag_color = ray_render_orb(ray_origin, ray_direction, 10.0);
}