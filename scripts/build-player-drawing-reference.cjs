const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const imageDir = path.join(root, 'client', 'public', 'archetype-players');
const outputDir = path.join(root, 'player-drawing-reference');

const drawings = [
  ['b1-top-left.png', 'Quickstep', 'B1 Top Left'],
  ['b1-top-middle.png', 'Set Shot', 'B1 Top Middle'],
  ['b1-top-right.png', 'The Prospect', 'B1 Top Right'],
  ['b1-bottom-left.png', 'Skywalker', 'B1 Bottom Left'],
  ['b2-left.png', 'The Tower', 'B2 Left'],
  ['b2-middle.png', 'Spider Guard', 'B2 Middle'],
  ['b2-right.png', 'The Floater', 'B2 Right'],
  ['b3-left.png', 'The King', 'B3 Left'],
  ['b3-middle.png', 'Pickup Legend', 'B3 Middle'],
  ['b3-right.png', 'The Monster', 'B3 Right'],
  ['b4-left.png', 'Big Body', 'B4 Left'],
  ['b4-middle.png', 'Double Trouble', 'B4 Middle'],
  ['b4-right.png', 'The Captain', 'B4 Right'],
  ['b5-left.png', 'Floor General', 'B5 Left'],
  ['b5-right.png', 'High Flyer', 'B5 Right'],
  ['b6-middle.png', 'Golden 99', 'B6 Middle'],
  ['ball-handler.png', 'Ball Handler', 'New Drawing'],
  ['brian.png', 'Brian', 'New Drawing'],
  ['steven.png', 'Steven', 'New Drawing'],
  ['wonder-woman.png', 'Wonder Woman', 'New Drawing'],
];

const columns = 5;
const tileWidth = 280;
const tileHeight = 350;
const gap = 18;
const margin = 24;
const titleHeight = 66;
const sheetWidth = margin * 2 + columns * tileWidth + (columns - 1) * gap;
const sheetHeight = titleHeight + margin + tileHeight * 2 + gap + margin;

const escapeXml = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

async function createPage(pageIndex, pageDrawings) {
  const pageStart = pageIndex * 10;
  const labels = pageDrawings.map(([file, name, source], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (tileWidth + gap);
    const y = titleHeight + margin + row * (tileHeight + gap);
    const number = String(pageStart + index + 1).padStart(2, '0');
    return `
      <rect x="${x}" y="${y}" width="${tileWidth}" height="${tileHeight}" rx="7"
        fill="#fffdf8" stroke="#16181d" stroke-width="3"/>
      <text x="${x + tileWidth / 2}" y="${y + 307}" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#16181d">
        ${number}. ${escapeXml(name)}
      </text>
      <text x="${x + tileWidth / 2}" y="${y + 333}" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="14" fill="#69717d">
        ${escapeXml(source)}
      </text>
    `;
  }).join('');

  const background = Buffer.from(`
    <svg width="${sheetWidth}" height="${sheetHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f5f1e8"/>
      <text x="${margin}" y="43" font-family="Arial, sans-serif" font-size="28"
        font-weight="700" fill="#16181d">PLAYER DRAWINGS ${String(pageStart + 1).padStart(2, '0')}-${pageStart + 10}</text>
      ${labels}
    </svg>
  `);

  const composites = [];
  for (let index = 0; index < pageDrawings.length; index += 1) {
    const [file] = pageDrawings[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tileX = margin + column * (tileWidth + gap);
    const tileY = titleHeight + margin + row * (tileHeight + gap);
    const image = await sharp(path.join(imageDir, file))
      .trim()
      .resize(246, 276, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const metadata = await sharp(image).metadata();
    composites.push({
      input: image,
      left: Math.round(tileX + (tileWidth - metadata.width) / 2),
      top: Math.round(tileY + 12 + (276 - metadata.height) / 2),
    });
  }

  await sharp(background)
    .composite(composites)
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toFile(path.join(outputDir, `player-drawings-${pageIndex + 1}.jpg`));
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await createPage(0, drawings.slice(0, 10));
  await createPage(1, drawings.slice(10, 20));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
