/**
 * Quotations Router
 * Handles listing, saving/publishing, and deleting client quotations.
 */
import express from 'express';
import db from '../db.js';
import {
  sendJsonResponse,
  requireAuth,
  requireMutatingAuth,
} from '../utils.js';

const router = express.Router();

export function slugifyClient(name) {
  return String(name || 'client')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'client';
}

export async function ensureQuotationsTable() {
  await db
    .query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(191) UNIQUE NOT NULL,
        quotation_no VARCHAR(100) NOT NULL,
        client_name VARCHAR(200) NOT NULL,
        payload TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    .catch(() => {});
}

// List all quotations
router.get(['/list', '/list.php'], requireAuth, async (req, res) => {
  try {
    await ensureQuotationsTable();
    const result = await db.query(
      'SELECT id, slug, quotation_no, client_name, payload, created_at, updated_at FROM quotations ORDER BY updated_at DESC'
    );
    const items = (result.rows || []).map((row) => {
      let parsed = {};
      try {
        parsed = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
      } catch {
        parsed = {};
      }
      return {
        ...parsed,
        id: String(row.id),
        slug: row.slug,
        quotationNo: parsed.quotationNo || row.quotation_no,
        clientName: parsed.clientName || row.client_name,
        updatedAt: row.updated_at || parsed.updatedAt || row.created_at,
      };
    });
    return sendJsonResponse(res, 'success', 'Quotations retrieved.', items);
  } catch (err) {
    console.error('Quotations List API Error:', err);
    return sendJsonResponse(res, 'error', 'Failed to retrieve quotations.', null, 500);
  }
});

// Save / Publish quotation by slug
router.post(['/save', '/save.php'], requireMutatingAuth, async (req, res) => {
  const body = req.body || {};
  const clientName = String(body.clientName || '').trim();
  const quotationNo = String(body.quotationNo || '').trim();

  if (!clientName || !quotationNo) {
    return sendJsonResponse(res, 'error', 'Client name and quotation number are required.', null, 400);
  }

  const resolvedSlug = slugifyClient(body.slug || clientName);
  const payloadObj = {
    ...body,
    slug: resolvedSlug,
    clientName,
    quotationNo,
    updatedAt: new Date().toISOString(),
  };
  const payloadStr = JSON.stringify(payloadObj);

  try {
    await ensureQuotationsTable();
    const existing = await db.query(
      'SELECT id FROM quotations WHERE slug = $1 LIMIT 1',
      [resolvedSlug]
    );

    let savedId;
    if (existing.rows && existing.rows.length > 0) {
      savedId = existing.rows[0].id;
      await db.query(
        'UPDATE quotations SET quotation_no = $1, client_name = $2, payload = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [quotationNo, clientName, payloadStr, savedId]
      );
    } else {
      const ins = await db.query(
        'INSERT INTO quotations (slug, quotation_no, client_name, payload) VALUES ($1, $2, $3, $4) RETURNING id',
        [resolvedSlug, quotationNo, clientName, payloadStr]
      );
      savedId = ins.rows?.[0]?.id || resolvedSlug;
    }

    return sendJsonResponse(res, 'success', 'Quotation published.', {
      id: String(savedId),
      slug: resolvedSlug,
      quotation: {
        ...payloadObj,
        id: String(savedId),
      },
    });
  } catch (err) {
    console.error('Quotation Save API Error:', err);
    return sendJsonResponse(res, 'error', 'Failed to save quotation.', null, 500);
  }
});

// Delete quotation
router.post(['/delete', '/delete.php'], requireMutatingAuth, async (req, res) => {
  const { id, slug } = req.body || {};
  if (!id && !slug) {
    return sendJsonResponse(res, 'error', 'Quotation ID or slug required.', null, 400);
  }

  try {
    await ensureQuotationsTable();
    if (slug) {
      await db.query('DELETE FROM quotations WHERE slug = $1', [slugifyClient(slug)]);
    } else {
      await db.query('DELETE FROM quotations WHERE id = $1', [id]);
    }
    return sendJsonResponse(res, 'success', 'Quotation deleted.');
  } catch (err) {
    console.error('Quotation Delete API Error:', err);
    return sendJsonResponse(res, 'error', 'Failed to delete quotation.', null, 500);
  }
});

export default router;
