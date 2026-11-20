import fs from 'fs';

// Simple PNG pixel extractor
const buf = fs.readFileSync('C:/Users/aichc/.gemini/antigravity/brain/b132546c-449e-4274-9049-a82ddf3f4125/.user_uploaded/media_1795152902504_8a6f97ae.png');

console.log('PNG size:', buf.length);

// Let's search for the dominant RGB in the banner
// PNG header is 8 bytes, then IHDR chunk
// Let's use a quick buffer scan or zlib inflate if needed
import zlib from 'zlib';

try {
  let offset = 8;
  const idatChunks = [];
  let width = 0, height = 0;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
      console.log('Width:', width, 'Height:', height);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(offset + 8, offset + 8 + len));
    }
    offset += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  console.log('Decompressed length:', decompressed.length);
  // Scan row around y = 40 (inside purple banner)
  const bytesPerPixel = 4; // RGBA
  const rowStride = 1 + width * bytesPerPixel;
  const targetY = 50;
  const targetX = Math.floor(width / 2);
  const pixelOffset = targetY * rowStride + 1 + targetX * bytesPerPixel;
  const r = decompressed[pixelOffset];
  const g = decompressed[pixelOffset + 1];
  const b = decompressed[pixelOffset + 2];
  const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  console.log(`Banner center pixel at (${targetX}, ${targetY}): rgb(${r},${g},${b}) -> ${hex}`);

  // Button target Y ~ height - 60
  const btnY = height - 50;
  const btnOffset = btnY * rowStride + 1 + targetX * bytesPerPixel;
  const br = decompressed[btnOffset];
  const bg = decompressed[btnOffset + 1];
  const bb = decompressed[btnOffset + 2];
  const btnHex = '#' + [br, bg, bb].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  console.log(`Button center pixel at (${targetX}, ${btnY}): rgb(${br},${bg},${bb}) -> ${btnHex}`);
} catch (e) {
  console.error(e);
}
