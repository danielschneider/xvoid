// Void Stalker pixel drawer: a spider-like wraith in one colour. Low, wide body with eight thin legs; no arms,
// head-on-torso or visor. Every fill uses the enemy colour.

// Draws a 2px-wide leg along the waypoints [[x, y], ...] with a pixel every step.
function drawLeg(pixel, color, waypoints) {
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const [x0, y0] = waypoints[index];
    const [x1, y1] = waypoints[index + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(x0 + ((x1 - x0) * step) / steps);
      const y = Math.round(y0 + ((y1 - y0) * step) / steps);
      pixel(x, y, 2, 2, color);
    }
  }
}

// Left-side leg waypoints; the right side mirrors them across the body centre (x = 24).
const LEFT_LEGS = [
  [
    [16, 30],
    [8, 22],
    [3, 16],
  ],
  [
    [15, 36],
    [5, 34],
    [1, 42],
  ],
  [
    [15, 41],
    [6, 48],
    [4, 58],
  ],
  [
    [16, 46],
    [11, 56],
    [14, 62],
  ],
];

export function drawStalker({ pixel, color }) {
  pixel(14, 36, 20, 12, color); // abdomen, the widest segment
  pixel(18, 28, 12, 9, color); // thorax
  pixel(20, 24, 8, 5, color); // head
  for (const legPoints of LEFT_LEGS) {
    drawLeg(pixel, color, legPoints);
    drawLeg(
      pixel,
      color,
      legPoints.map(([x, y]) => [46 - x, y])
    );
  }
}
