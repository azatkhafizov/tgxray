const { nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const DIGITS = {
  '0': ['111','101','101','101','111'],
  '1': ['010','110','010','010','111'],
  '2': ['111','001','111','100','111'],
  '3': ['111','001','111','001','111'],
  '4': ['101','101','111','001','001'],
  '5': ['111','100','111','001','111'],
  '6': ['111','100','111','101','111'],
  '7': ['111','001','010','010','010'],
  '8': ['111','101','111','101','111'],
  '9': ['111','101','111','001','111'],
  '+': ['000','010','111','010','000']
};

function drawBadgeOnBitmap(bitmap, width, height, count) {
  const buf = Buffer.from(bitmap);
  const text = count > 99 ? '99+' : String(count);
  
  // Badge circle center and radius
  const r = 16;
  const cx = width - r - 2;
  const cy = r + 2;

  // Draw circle (red with dark outline)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distSq = (x - cx) ** 2 + (y - cy) ** 2;
      const idx = (y * width + x) * 4;
      if (distSq <= r ** 2) {
        if (distSq >= (r - 2) ** 2) {
          // Dark border #17212b
          buf[idx] = 43;
          buf[idx + 1] = 33;
          buf[idx + 2] = 23;
          buf[idx + 3] = 255;
        } else {
          // Red badge #e74c3c
          buf[idx] = 60;   // B
          buf[idx + 1] = 76;  // G
          buf[idx + 2] = 231; // R
          buf[idx + 3] = 255; // A
        }
      }
    }
  }

  // Draw digits (each digit is 3x5 pixels, scaled 2x => 6x10)
  const scale = 2;
  const charW = 3 * scale;
  const charH = 5 * scale;
  const charSpacing = scale;
  const totalW = text.length * charW + (text.length - 1) * charSpacing;
  
  const startX = Math.round(cx - totalW / 2);
  const startY = Math.round(cy - charH / 2);

  for (let c = 0; c < text.length; c++) {
    const ch = text[c];
    const pattern = DIGITS[ch] || DIGITS['+'];
    const charOffsetX = startX + c * (charW + charSpacing);

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (pattern[row][col] === '1') {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = charOffsetX + col * scale + sx;
              const py = startY + row * scale + sy;
              if (px >= 0 && px < width && py >= 0 && py < height) {
                const idx = (py * width + px) * 4;
                buf[idx] = 255;     // B
                buf[idx + 1] = 255; // G
                buf[idx + 2] = 255; // R
                buf[idx + 3] = 255; // A
              }
            }
          }
        }
      }
    }
  }

  return nativeImage.createFromBitmap(buf, { width, height });
}

const baseImg = nativeImage.createFromPath(path.resolve('resources/icons/tray-connected.png'));
const { width, height } = baseImg.getSize();
const badged = drawBadgeOnBitmap(baseImg.toBitmap(), width, height, 5);
fs.writeFileSync('/tmp/badged-5.png', badged.toPNG());
console.log('generated /tmp/badged-5.png, length:', badged.toPNG().length);
