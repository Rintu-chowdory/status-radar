import type { VercelRequest, VercelResponse } from '@vercel/node';
import { boardStatuses } from './_lib.js';

export const config = { regions: ['fra1'] };

/**
 * GET /api/status — all tracked services in one small payload.
 *
 * Two cache layers: the module cache (45s) saves upstream calls from the same instance,
 * and the CDN header lets Vercel serve repeat traffic without waking the function at all.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const result = await boardStatuses();
    res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=60');
    res.setHeader('Vercel-CDN-Cache-Control', 'max-age=45, stale-while-revalidate=60');
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Status refresh failed' });
  }
}
