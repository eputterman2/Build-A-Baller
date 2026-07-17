import html2canvas from 'html2canvas';

// Small helpers shared across components.
export function lastName(name: string): string {
  const parts = name.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}

export function scoreColor(v: number): string {
  if (v >= 85) return '#1f9d63'; // green
  if (v >= 70) return '#5a9e3e'; // olive
  if (v >= 55) return '#c8930f'; // gold
  if (v >= 40) return '#e0701d'; // orange
  return '#d23b30';              // red
}

export function overallTier(overall: number): string {
  if (overall <= 75) return 'bronze';
  if (overall <= 81) return 'silver';
  if (overall <= 87) return 'gold';
  if (overall <= 91) return 'amethyst';
  if (overall <= 95) return 'diamond';
  if (overall <= 98) return 'pink-diamond';
  return 'kryptonite';
}

export async function shareCardLink({
  url,
  title,
  text,
}: {
  url: string;
  title: string;
  text: string;
}): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return 'shared';
  }
  await navigator.clipboard?.writeText(url);
  return 'copied';
}

function safeFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'build-a-baller-card';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(label)), ms);
    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create card image'));
    }, 'image/png');
  });
}

function isLikelyMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
}

async function fetchImage(src: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);
  try {
    return await fetch(src, { cache: 'force-cache', signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function inlineExportImages(root: HTMLElement): Promise<() => void> {
  const restores: Array<() => void> = [];
  const images = [...root.querySelectorAll<HTMLImageElement>('img')];

  await Promise.allSettled(images.map(async img => {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:')) return;

    const previousSrc = img.getAttribute('src');
    const previousSrcset = img.getAttribute('srcset');
    try {
      const response = await fetchImage(src);
      if (!response.ok) return;
      const dataUrl = await withTimeout(blobToDataUrl(await response.blob()), 2500, 'Image export timed out');
      restores.push(() => {
        if (previousSrc == null) img.removeAttribute('src');
        else img.setAttribute('src', previousSrc);
        if (previousSrcset == null) img.removeAttribute('srcset');
        else img.setAttribute('srcset', previousSrcset);
      });
      img.removeAttribute('srcset');
      img.src = dataUrl;
      await withTimeout(img.decode().catch(() => {}), 1200, 'Image decode timed out').catch(() => {});
    } catch {
      // If one optional image is slow or unavailable, keep exporting the rest of the card.
    }
  }));

  return () => {
    restores.reverse().forEach(restore => restore());
  };
}

function lockContainedPlayerArt(root: HTMLElement): () => void {
  const restores: Array<() => void> = [];
  const images = [...root.querySelectorAll<HTMLImageElement>('.card-player-art')];

  images.forEach(img => {
    const rect = img.getBoundingClientRect();
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    if (!rect.width || !rect.height || !naturalWidth || !naturalHeight) return;

    const boxAspect = rect.width / rect.height;
    const imageAspect = naturalWidth / naturalHeight;
    const width = imageAspect > boxAspect ? rect.width : rect.height * imageAspect;
    const height = imageAspect > boxAspect ? rect.width / imageAspect : rect.height;

    const previousWidth = img.style.width;
    const previousHeight = img.style.height;
    const previousObjectFit = img.style.objectFit;
    const previousObjectPosition = img.style.objectPosition;
    const previousMaxWidth = img.style.maxWidth;
    const previousMaxHeight = img.style.maxHeight;

    restores.push(() => {
      img.style.width = previousWidth;
      img.style.height = previousHeight;
      img.style.objectFit = previousObjectFit;
      img.style.objectPosition = previousObjectPosition;
      img.style.maxWidth = previousMaxWidth;
      img.style.maxHeight = previousMaxHeight;
    });

    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    img.style.objectFit = 'fill';
    img.style.objectPosition = 'center center';
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
  });

  return () => {
    restores.reverse().forEach(restore => restore());
  };
}

export async function downloadCardImage(cardId: string, fileName: string): Promise<void> {
  const wrap = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
  const inner = wrap?.querySelector<HTMLElement>('.sports-card-inner');
  const front = wrap?.querySelector<HTMLElement>('.sports-card-front');
  if (!wrap || !inner || !front) throw new Error('Card not found');

  const wasFlipped = wrap.classList.contains('flipped');
  const previousTransition = inner.style.transition;
  const previousBackface = front.style.backfaceVisibility;
  const previousWebkitBackface = front.style.webkitBackfaceVisibility;
  const previousTransform = front.style.transform;
  let restoreImages = () => {};
  let restorePlayerArt = () => {};
  try {
    inner.style.transition = 'none';
    front.style.backfaceVisibility = 'visible';
    front.style.webkitBackfaceVisibility = 'visible';
    front.style.transform = 'none';
    if (wasFlipped) wrap.classList.remove('flipped');

    restoreImages = await inlineExportImages(front);
    restorePlayerArt = lockContainedPlayerArt(front);
    await new Promise(requestAnimationFrame);
    const canvas = await withTimeout(
      html2canvas(front, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
      }),
      15000,
      'Card export timed out',
    );
    const pngBlob = await canvasToPngBlob(canvas);
    const downloadName = `${safeFileName(fileName)}.png`;

    if (isLikelyMobileDevice() && navigator.share) {
      const file = new File([pngBlob], downloadName, { type: 'image/png' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Build-A-Baller card',
          text: 'Save or share this Build-A-Baller card.',
        });
        return;
      }
    }

    const url = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.download = downloadName;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    if (wasFlipped) wrap.classList.add('flipped');
    inner.style.transition = previousTransition;
    front.style.backfaceVisibility = previousBackface;
    front.style.webkitBackfaceVisibility = previousWebkitBackface;
    front.style.transform = previousTransform;
    restorePlayerArt();
    restoreImages();
  }
}
