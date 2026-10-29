import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceDetail } from './_lib.js';

export const config = { regions: ['fra1'] };

/**
 * GET /api/service?id=cloudflare — full summary plus incident history for one service.
 * Kept separate from /api/status because summary.json payloads reach hundreds of
 * kilobytes for providers with many components, and the board does not need them.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    res.status(400).json({ error: 'Missing id parameter' });
    return;
  }

  const detail = await serviceDetail(id);
  if (!detail) {
    res.status(404).json({ error: `Unknown service: ${id}` });
    return;
  }

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=60, stale-while-revalidate=120');
  res.status(200).json(detail);
}
