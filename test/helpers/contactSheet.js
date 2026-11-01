// Lays out equally sized RGBA images in a grid and scales them up with nearest-neighbour sampling.
// Each cell is separated by `gap` source pixels and the sheet sits on an opaque `background` colour.
export function buildContactSheet(rows, { scale = 4, gap = 4, background = [16, 24, 32] } = {}) {
  const cellWidth = rows[0][0].width;
  const cellHeight = rows[0][0].height;
  const columns = Math.max(...rows.map((row) => row.length));
  const sourceWidth = columns * (cellWidth + gap) + gap;
  const sourceHeight = rows.length * (cellHeight + gap) + gap;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = background[0];
    data[i + 1] = background[1];
    data[i + 2] = background[2];
    data[i + 3] = 255;
  }
  rows.forEach((row, rowIndex) => {
    row.forEach((image, columnIndex) => {
      const originX = gap + columnIndex * (cellWidth + gap);
      const originY = gap + rowIndex * (cellHeight + gap);
      for (let y = 0; y < cellHeight; y++) {
        for (let x = 0; x < cellWidth; x++) {
          const src = (y * cellWidth + x) * 4;
          if (image.data[src + 3] === 0) continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = (originX + x) * scale + sx;
              const py = (originY + y) * scale + sy;
              data.set(image.data.subarray(src, src + 4), (py * width + px) * 4);
            }
          }
        }
      }
    });
  });
  return { width, height, data };
}
