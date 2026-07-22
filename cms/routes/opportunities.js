const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { makeSlug, slugify } = require('../lib/slug');

const router = express.Router();

const CATEGORIES = ['Grant', 'Fellowship', 'Internship', 'Training', 'Accelerator', 'Competition', 'Scholarship', 'Other'];
const LOCATIONS = ['Remote', 'Nigeria', 'Africa', 'Global'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAuthorName(userId) {
  if (!userId) return null;
  return db.findUserById(userId)?.name || null;
}

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    featured: Boolean(row.featured),
    tags: row.tags || [],
    author_name: getAuthorName(row.created_by),
  };
}

function validateOpportunity(body, partial = false) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (!body.title?.trim()) errors.push('Title is required');
  }
  if (!partial || body.apply_url !== undefined) {
    if (!body.apply_url?.trim()) errors.push('Apply URL is required');
    else if (!/^https?:\/\//i.test(body.apply_url.trim()) && !body.apply_url.trim().startsWith('mailto:')) {
      errors.push('Apply URL must start with http://, https://, or mailto:');
    }
  }
  if (body.category && !CATEGORIES.includes(body.category)) {
    errors.push('Invalid category');
  }
  if (body.location && !LOCATIONS.includes(body.location)) {
    errors.push('Invalid location');
  }
  if (body.status && !['draft', 'published'].includes(body.status)) {
    errors.push('Status must be draft or published');
  }
  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) {
      errors.push('Slug may only contain lowercase letters, numbers, and hyphens');
    }
  }
  return errors;
}

function queryOpportunities({ statusFilter, category, search, featured, page, limit }) {
  let items = db.getOpportunities();

  if (statusFilter === 'published') {
    items = items.filter((o) => o.status === 'published');
  }

  if (category && category !== 'all') {
    items = items.filter((o) => o.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        (o.summary || '').toLowerCase().includes(q) ||
        (o.content || '').toLowerCase().includes(q) ||
        (o.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }

  if (featured === 'true') {
    items = items.filter((o) => o.featured);
  }

  items.sort((a, b) => {
    if (a.featured !== b.featured) return b.featured - a.featured;
    const aDate = a.published_at || a.created_at;
    const bDate = b.published_at || b.created_at;
    return bDate.localeCompare(aDate);
  });

  const total = items.length;
  const offset = (page - 1) * limit;
  const data = items.slice(offset, offset + limit);

  return { data, total };
}

function canViewDraft(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  try {
    require('jsonwebtoken').verify(header.slice(7), process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

function buildOpportunityPayload(body, existing = null) {
  const all = db.getOpportunities();
  const title = body.title?.trim() || existing?.title || '';
  let slug = body.slug?.trim() || existing?.slug;

  if (body.slug !== undefined && body.slug?.trim()) {
    slug = slugify(body.slug.trim()) || makeSlug(title, all, existing?.id);
  } else if (!slug && title) {
    slug = makeSlug(title, all, existing?.id);
  } else if (body.title !== undefined && title !== existing?.title) {
    slug = makeSlug(title, all, existing?.id);
  }

  const status = body.status ?? existing?.status ?? 'draft';
  const now = new Date().toISOString();
  let published_at = existing?.published_at ?? null;
  if (status === 'published' && !published_at) {
    published_at = now;
  }
  if (status === 'draft') {
    published_at = null;
  }

  return {
    title,
    slug,
    summary: body.summary !== undefined ? (body.summary?.trim() || '') : (existing?.summary || ''),
    content: body.content !== undefined ? (body.content || '') : (existing?.content || ''),
    apply_url: body.apply_url?.trim() || existing?.apply_url || '',
    category: body.category || existing?.category || 'Other',
    location: body.location || existing?.location || 'Global',
    deadline: body.deadline !== undefined ? (body.deadline || null) : (existing?.deadline ?? null),
    tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags : []) : (existing?.tags || []),
    featured: body.featured !== undefined ? Boolean(body.featured) : Boolean(existing?.featured),
    status,
    image: body.image !== undefined ? (body.image || null) : (existing?.image ?? null),
    image_alt: body.image_alt !== undefined ? (body.image_alt?.trim() || title) : (existing?.image_alt || title),
    published_at,
  };
}

router.get('/meta', (_req, res) => {
  const published = db.getOpportunities().filter((o) => o.status === 'published');
  const categoryCounts = {};
  for (const o of published) {
    categoryCounts[o.category] = (categoryCounts[o.category] || 0) + 1;
  }
  res.json({
    categories: CATEGORIES,
    locations: LOCATIONS,
    categoryCounts,
    totalPublished: published.length,
  });
});

router.get('/by-slug/:slug', (req, res) => {
  const row = db.findOpportunityBySlug(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Not found' });

  if (row.status !== 'published' && !canViewDraft(req)) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(mapRow(row));
});

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const category = req.query.category;
  const search = req.query.search?.trim();
  const featured = req.query.featured;

  let statusFilter = 'published';
  if (req.query.admin === 'true' && canViewDraft(req)) {
    statusFilter = 'all';
  }

  const { data, total } = queryOpportunities({
    statusFilter,
    category,
    search,
    featured,
    page,
    limit,
  });

  res.json({
    data: data.map(mapRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  let row = null;

  if (UUID_RE.test(id)) {
    row = db.findOpportunityById(id);
  } else {
    row = db.findOpportunityBySlug(id);
  }

  if (!row) return res.status(404).json({ error: 'Not found' });

  if (row.status !== 'published' && !canViewDraft(req)) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(mapRow(row));
});

router.post('/', authRequired, (req, res) => {
  const errors = validateOpportunity(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const payload = buildOpportunityPayload(req.body);
  const slugErrors = validateOpportunity({ ...payload, apply_url: req.body.apply_url }, false);
  if (slugErrors.length) return res.status(400).json({ error: slugErrors.join(', ') });

  const created = db.createOpportunity({
    id: uuidv4(),
    ...payload,
    created_by: req.user.id,
  });

  res.status(201).json(mapRow(created));
});

router.put('/:id', authRequired, (req, res) => {
  const existing = db.findOpportunityById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const errors = validateOpportunity(req.body, true);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const payload = buildOpportunityPayload(req.body, existing);
  if (payload.deadline === '') payload.deadline = null;

  const updated = db.updateOpportunity(req.params.id, payload);
  res.json(mapRow(updated));
});

router.delete('/:id', authRequired, (req, res) => {
  const deleted = db.deleteOpportunity(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

module.exports = router;
