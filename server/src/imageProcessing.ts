import sharp from 'sharp';

const MAX_INPUT_PIXELS = 40_000_000;
const DRAWING_MARGIN_PX = 12;

export interface NormalizedDrawing {
  buffer: Buffer;
  dataUrl: string;
  mime: 'image/png';
}

export async function normalizeDrawingDataUrl(dataUrl: string): Promise<NormalizedDrawing> {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) throw new Error('Invalid drawing data URL.');

  const input = Buffer.from(dataUrl.slice(commaIndex + 1), 'base64');
  if (!input.length) throw new Error('Drawing is empty.');

  const source = sharp(input, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  });
  const metadata = await source.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) {
    throw new Error('Drawing must be a PNG, JPG, or WEBP image.');
  }

  const trimOptions = metadata.hasAlpha
    ? {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        threshold: 4,
        margin: DRAWING_MARGIN_PX,
      }
    : { threshold: 4, margin: DRAWING_MARGIN_PX };

  const buffer = await sharp(input, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .rotate()
    .trim(trimOptions)
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    buffer,
    dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    mime: 'image/png',
  };
}
