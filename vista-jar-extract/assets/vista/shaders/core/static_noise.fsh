#version 150

#moj_import <fog.glsl>
#moj_import <vista:crt_effects.glsl>

uniform sampler2D Sampler0;

uniform vec4 ColorModulator;
uniform float FogStart;
uniform float FogEnd;
uniform vec4 FogColor;

uniform float GameTime;
uniform float NoiseIntensity;

uniform float VignetteIntensity;

in float vertexDistance;
in vec4 vertexColor;
in vec4 lightMapColor;
in vec4 overlayColor;
in vec2 texCoord0;
in vec4 normal;

out vec4 fragColor;


// ------------------------------------------------------------------

void main() {
    // Base texture

    // Get procedural noise
    vec4 noise = crt_noise(texCoord0, GameTime);

    // Blend texture with noise

    // Lighting / material tinting
    vec4 tint = vertexColor * ColorModulator * lightMapColor;
    vec4 shaded = NoiseIntensity * noise * tint;

    float vignette = mix(1.0, crt_vignette(texCoord0), clamp(VignetteIntensity, 0.0, 1.0));
    shaded.rgb *= vignette;

    // Fog
    vec4 fogged = linear_fog(shaded, vertexDistance, FogStart, FogEnd, FogColor);



    fragColor = fogged;
}
