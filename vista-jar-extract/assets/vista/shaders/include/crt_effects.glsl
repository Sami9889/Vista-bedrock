// ===================== CRT Vignette (pure, no randomness) =====================
// UV must be in [0,1] within the current sprite frame. Needs to be normalized first.
float crt_vignette(in vec2 texCoord) {
    // ===================== Apply CRT Vignette =====================
    // Compute sprite-local UV (0..1 across the sprite rect)
    vec2 minUV  = vec2(0,0);
    vec2 sizeUV = vec2(1,1);
    vec2 uvLocal = clamp((texCoord - minUV) / sizeUV, 0.0, 1.0);

    float v = 44.0 * (uvLocal.x * (1.0 - uvLocal.x) * uvLocal.y * (1.0 - uvLocal.y));
    // Base/gain chosen to match the referenced style: 0.6 + 0.4 * v
    return 0.6 + 0.4 * v;
}
#define PI 3.14159265359


// ------------------------------------------------------------------
// Golden-ratio procedural noise
// ------------------------------------------------------------------
#define PHI 1.61803398874989484820459
#define NOISE_SPEED 1000.0
#define NOISE_SCALE 10000.0

float gold_noise(in vec2 xy, in float seed) {
    return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);
}

vec4 crt_noise(in vec2 uv, in float timeSeed) {
    uv = uv * NOISE_SCALE;
    timeSeed = fract(timeSeed * NOISE_SPEED);
    return vec4(
    gold_noise(uv, timeSeed + 0.1),
    gold_noise(uv, timeSeed + 0.2),
    gold_noise(uv, timeSeed + 0.3),
    gold_noise(uv, timeSeed + 0.4)
    );
}


// ==========================================================
// Helper: returns 0->1 smoothly between startTime and duration
// ==========================================================
float animate(float t, float startTime, float duration) {
    if (duration == 0.0) return 1.0;               // avoid division by zero
    float a = (t - startTime) / duration;         // normalized offset
    return clamp(a, 0.0, 1.0);                    // works whether a positive or negative
}

// ==========================================================
// Ellipse + dot effect with background replacement
// ==========================================================
vec4 crt_turn_on(vec4 inColor, vec2 fragPx, vec2 resolutionPx, float t) {
    t = 1-t;
    // --------------------------------------------------
    // PIXEL LOCK (this is the important bit)
    // --------------------------------------------------
    vec2 uv = ((floor(fragPx) + 0.5) / resolutionPx) - 0.5;   // center origin, same space as before

    //non pixelataed loook:
    //vec2 uv = (fragPx - 0.5 * resolutionPx) / resolutionPx;

    // --- PARAMETERS ---
    float fadeStart = 0.0;
    float fadeDuration = 0.20;

    float ryAnimStart = 0.1;
    float ryAnimDuration = 0.4;
    float ryStart = 0.25;
    float ryEnd = 0.0035;

    float rxAnimStart = 0.38;
    float rxAnimDuration = 0.62;
    float rxStart = 0.25;
    float rxEnd = 0.0;

    float dotStart = 0.49;
    float dotDuration = 0.51;
    float dotRadiusMax = 0.13;

    // --- RADII ---
    float r_y = mix(ryStart, ryEnd, animate(t, ryAnimStart, ryAnimDuration));
    float r_x = mix(rxStart, rxEnd, animate(t, rxAnimStart, rxAnimDuration));

    vec2 r_in = vec2(r_x, r_y);
    vec2 r_out = r_in * 10.0;

    // --- ELLIPSE MASK (now pixelated) ---
    vec2 norm = uv / r_out;
    float d = length(norm);

    vec2 norm_in = uv / r_in;
    float inside = length(norm_in) < 1.0 ? 1.0 : 0.0;
    float ellipse = max(inside, smoothstep(1.0, r_in.x / r_out.x, d));

    vec4 glow = vec4(vec3(ellipse), ellipse);

    // --- DOT (also pixelated automatically) ---
    float dotT = animate(t, dotStart, dotDuration);
    if (dotT > 0.0) {
        float s = sin(dotT * PI);
        float radius = dotRadiusMax * s;

        float dist = length(uv);
        float dot = smoothstep(radius, 0.0, dist);

        glow.rgb += dot;
        glow.a = max(glow.a, dot);
    }

    float fade = animate(t, fadeStart, fadeDuration);
    vec4 color = mix(inColor, glow, fade);

    return color;
}

// ===================== VHS PAUSE EFFECT =====================


// RNG
float vhs_rand(vec2 co)
{
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

#define VHS_WOBBLE_WAVELENGTH 1.2// UV units; 1.0 = one full sine across the frame vertically
#define VHS_WOBBLE_SINE_SPEED      -400.0// speed of sine scroll (loops per second)
#define VHS_WOBBLE_SINE_THRESHOLD  0.9// only lines where sine > threshold wobble
#define VHS_LINE_JITTER_AMPLITUDE  0.016// horizontal wobble strength (triad units)
#define VHS_FRAME_JITTER_AMPLITUDE 0.008// vertical wobble strength (triad units)

#define VHS_COLOR_NOISE_STRENGTH     0.5

vec3 vcr_pause(
vec2 uv,
vec2 frameOriginUV,
vec2 spriteDimensions,
vec2 atlasSize,   // in pixels
float time,
vec2 tpp){

    vec2 localUV = (uv - frameOriginUV) / spriteDimensions;

    float phase = time * 2.0 * PI * VHS_WOBBLE_SINE_SPEED;
    float sineValue = sin(localUV.y * 2.0 * PI / VHS_WOBBLE_WAVELENGTH + phase);

    float gate = step(VHS_WOBBLE_SINE_THRESHOLD, sineValue);

    vec2 spriteSizePx = spriteDimensions * atlasSize;
    vec2 p = localUV * spriteSizePx;

    vec2 triadSizePx = 1.0 / max(tpp, 1e-6);
    vec2 triadCell = floor(p / triadSizePx);

    float lineNoise  = vhs_rand(vec2(time * 100.0, triadCell.y));
    float frameNoise = vhs_rand(vec2(time * 100.0, 0.0));

    localUV.x += gate * (lineNoise - 0.5) * VHS_LINE_JITTER_AMPLITUDE;
    localUV.y += (frameNoise - 0.5) * VHS_FRAME_JITTER_AMPLITUDE;

    // Convert back to atlas UV first
    vec2 newUV = frameOriginUV + localUV * spriteDimensions;

    // --- TEXEL-SAFE CLAMP ---
    vec2 halfTexel = 0.5 / atlasSize;

    vec2 minUV = frameOriginUV + halfTexel;
    vec2 maxUV = frameOriginUV + spriteDimensions - halfTexel;

    newUV = clamp(newUV, minUV, maxUV);


    return vec3(newUV, 0.02 * gate);
}

float vhs_hash(vec2 p)
{
    return fract(sin(dot(p, vec2(89.44, 19.36))) * 22189.22);
}

float vhs_iHash(vec2 p, vec2 r)
{
    vec2 i = floor(p * r) / r;
    vec2 f = fract(p * r);

    float h00 = vhs_hash(i);
    float h10 = vhs_hash(i + vec2(1.0/r.x, 0.0));
    float h01 = vhs_hash(i + vec2(0.0, 1.0/r.y));
    float h11 = vhs_hash(i + vec2(1.0/r.x, 1.0/r.y));

    vec2 u = smoothstep(vec2(0.0), vec2(1.0), f);

    return mix(mix(h00, h10, u.x),
    mix(h01, h11, u.x),
    u.y);
}

float vhs_noise(vec2 p)
{
    float sum = 0.0;
    float amp = 0.5;

    for (int i = 0; i < 5; i++)
    {
        sum += vhs_iHash(p + float(i), vec2(2.0 * pow(2.0, float(i)))) * amp;
        amp *= 0.5;
    }

    return sum;
}

#define VHS_AC_BEAT_STRENGTH  1.0
#define VHS_AC_BEAT_BIAS      0.125
#define VHS_AC_BEAT_MAX       1.0
#define VHS_AC_BEAT_SPEED     200.2

float vhs_ac_beat(
vec2 uv,
vec2 frameOriginUV,
vec2 spriteDimensions,
float time)
{
    vec2 localUV = (uv - frameOriginUV) / spriteDimensions;
    float beat =
    clamp(
    vhs_noise(vec2(
    0.0,
    localUV.y + time * VHS_AC_BEAT_SPEED
    )) * VHS_AC_BEAT_STRENGTH
    + VHS_AC_BEAT_BIAS,
    0.0,
    VHS_AC_BEAT_MAX
    );

    return beat;
}

// ------------------------
// AC BEAT USING SUM-OF-SINES
// ------------------------

// user-adjustable knobs
#define VHS_WAVE_SPEED 200.0  // how fast the wave moves along Y
#define VHS_WAVE_SCALE 0.15  // vertical zoom

float vhs_wave(
vec2 localUV,
vec2 frameOriginUV,
vec2 spriteDimensions,
float time)
{
    float y = localUV.y * VHS_WAVE_SCALE;
    float xOffset = 0;

    // ---- normalize time 0->1 and apply speed ----
    float t = fract(time * VHS_WAVE_SPEED);

    // ---- sum-of-sines strips ----
    float beat = 0.0;
    beat += 0.4  * sin(2.0*PI*t + 10.0*(y + xOffset));   // largest amplitude, loops once
    beat += 0.2  * sin(3.0*2.0*PI*t + 70.0*(y + xOffset));
    beat += 0.1  * sin(4.0*2.0*PI*t + 133.0*(y + xOffset));
    beat += 0.05 * sin(5.0*2.0*PI*t + 98.0*(y + xOffset));

    // normalize to 0..1
    beat = beat*0.5 + 0.5;

    return beat;
}