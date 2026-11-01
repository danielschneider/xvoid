// Describes one body mesh as plain data so builders stay free of React and three.js objects.
// Options: rotation [x, y, z], roughness and metalness (defaults apply when omitted).
export function part(shape, size, position, color, options = {}) {
  return { shape, size, position, color, ...options };
}

// Torso and armour tint for a unit: aliens use the dark purple armour, player units the teal one.
export function armorColorFor(unit) {
  return unit.team === 'alien' ? '#492b35' : '#324c43';
}
