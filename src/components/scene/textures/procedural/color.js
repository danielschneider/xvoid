// Small RGB helpers. Colours are [r, g, b] arrays in 0..255.
export function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function scaleRgb(rgb, factor) {
  return rgb.map((channel) => Math.min(255, Math.max(0, channel * factor)));
}
