// Pure view selection for the unit sprite. No three.js or React imports.

// Wraps an angle difference into (-PI, PI].
export function angleDelta(radians) {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

// Picks which sprite view to show from the unit's facing relative to the camera.
export function selectSpriteView(relativeFacing) {
  return Math.abs(relativeFacing) < Math.PI / 4
    ? 'front'
    : Math.abs(relativeFacing) > Math.PI * 3 / 4
      ? 'back'
      : relativeFacing > 0 ? 'right' : 'left';
}
