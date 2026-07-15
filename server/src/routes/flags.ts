import { Router } from 'express';
import { COMMON_COUNTRIES } from '@shared/index';

const ALLOWED_FLAG_FILES = new Set(COMMON_COUNTRIES.map(country => country.flagFile));

export const flagsRouter = Router();

flagsRouter.get('/:file', async (req, res, next) => {
  try {
    const file = req.params.file;
    if (!ALLOWED_FLAG_FILES.has(file)) {
      res.status(404).json({ error: 'Flag not found' });
      return;
    }

    const requestedWidth = Number.parseInt(String(req.query.width ?? '96'), 10);
    const width = Number.isFinite(requestedWidth)
      ? Math.min(192, Math.max(24, requestedWidth))
      : 96;
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Build-A-Baller/1.0 (baballersupport@gmail.com)' },
    });

    if (!response.ok) {
      res.status(502).json({ error: 'Could not load flag' });
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/svg+xml';
    if (!contentType.startsWith('image/')) {
      res.status(502).json({ error: 'Invalid flag response' });
      return;
    }

    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.type(contentType);
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    next(err);
  }
});
