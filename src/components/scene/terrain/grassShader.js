// Procedural grass ground. The fragment shader reads per-cell data from a DataTexture
// (layout in groundData.js) and paints grass dots from integer hashes that mirror seededNoise
// (src/components/scene/textures/tiles.js). Output is raw sRGB (ShaderMaterial is not
// colour-converted), same convention as FogOfWar.jsx.

export const GRASS_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const GRASS_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform sampler2D uCells;
  uniform float uSize;
  uniform int uSeed;
  uniform vec3 uBase;
  uniform vec3 uDotLight;
  uniform vec3 uDotDark;
  uniform vec3 uStructure;
  uniform vec3 uFog;
  uniform float uFogAlpha;
  varying vec2 vUv;

  // GLSL port of seededNoise: same xor/multiply sequence on uint (wraps mod 2^32).
  // The final division is float, so values can differ from JS in the last bits only.
  float seededHash(uint seed, uint x, uint z, uint salt) {
    uint v = seed ^ (x * 374761393u) ^ (z * 668265263u) ^ (salt * 2246822519u);
    v = (v ^ (v >> 13u)) * 1274126177u;
    return float(v ^ (v >> 16u)) / 4294967296.0;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // Plane is rotated -PI/2 about X, so uv.y = 1 is map row z = 0 (see groundData.js).
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
    vec2 cell = floor(p);
    vec2 local = fract(p);
    // DataTexture row 0 sits at v = 0 and holds z = size - 1, so lookup v = 1 - (z + 0.5) / size.
    vec4 info = texture2D(uCells, vec2((cell.x + 0.5) / uSize, 1.0 - (cell.y + 0.5) / uSize));
    bool structure = info.r > 0.5;
    
    // Low-frequency colour drift across the ground.
    float n = valueNoise(p * 0.12) * 0.6 + valueNoise(p * 0.37) * 0.4;
    vec3 colour = uBase * (0.92 + 0.16 * n);

    if (structure) {
      colour = uStructure;
    } else {
      uint cx = uint(cell.x);
      uint cz = uint(cell.y);
      uint seed = uint(uSeed) ^ (uint(floor(info.b * 255.0 + 0.5)) * 2654435761u);
      // 2..4 dots per cell.
      float count = 2.0 + floor(seededHash(seed, cx, cz, 100u) * 3.0);
      // Anti-alias width in cell-local units, from screen-space derivatives of the cell coordinate.
      float edge = max(fwidth(p.x), 0.02);
      float coverage = 0.0;
      for (int k = 0; k < 4; k += 1) {
        if (float(k) < count) {
          uint salt = 110u + uint(k) * 4u;
          vec2 centre = vec2(seededHash(seed, cx, cz, salt), seededHash(seed, cx, cz, salt + 1u)) * 0.8 + 0.1;
          float radius = mix(0.04, 0.09, seededHash(seed, cx, cz, salt + 2u));
          float mask = 1.0 - smoothstep(radius - edge, radius + edge, length(local - centre));
          float light = step(0.5, seededHash(seed, cx, cz, salt + 3u));
          colour = mix(colour, mix(uDotDark, uDotLight, light), mask * (1.0 - coverage));
          coverage = max(coverage, mask);
        }
      }
    }

    // Fog strength: 1 deep fog (never seen), ~0.5 slight fog (seen before), 0 visible.
    float fogAmount = info.g;
    if (fogAmount > 0.0) colour = mix(colour, uFog, uFogAlpha * fogAmount);
    gl_FragColor = vec4(colour, 1.0);
  }
`;

// Default colours as sRGB 0..1 triples. Base is green; the dark tones match the old atlas
// structure (#303c39) and fog (#080d0e) colours.
export const GRASS_DEFAULTS = {
  base: [0x3a / 255, 0x64 / 255, 0x40 / 255],
  dotLight: [0x5a / 255, 0x8a / 255, 0x5f / 255],
  dotDark: [0x2e / 255, 0x52 / 255, 0x36 / 255],
  structure: [0x30 / 255, 0x3c / 255, 0x39 / 255],
  fog: [0x08 / 255, 0x0d / 255, 0x0e / 255],
  fogAlpha: 0.9,
};
