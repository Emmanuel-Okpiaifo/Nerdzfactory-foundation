import { decodeHtml } from './opportunities';

/**
 * Prefer same-origin /api (htaccess → nf-cms).
 * Fallback hits PHP directly if rewrite is broken on the host.
 */
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function apiUrls(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const primary = `${API_BASE}${normalized}`;

  // Direct PHP entry (works even when /api rewrite fails)
  const q = normalized.startsWith('/api/')
    ? `nf_path=${encodeURIComponent(normalized.replace(/^\//, ''))}`
    : null;
  const fallback = q ? `${API_BASE}/nf-cms/index.php?${q}` : null;

  return fallback && fallback !== primary ? [primary, fallback] : [primary];
}

function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return url;
}

export function mapOpportunity(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: decodeHtml(row.title),
    summary: row.summary || '',
    content: row.content || '',
    applyUrl: row.apply_url,
    image: resolveImageUrl(row.image),
    imageAlt: decodeHtml(row.image_alt || row.title),
    category: row.category,
    location: row.location,
    deadline: row.deadline,
    tags: row.tags || [],
    featured: Boolean(row.featured),
    publishedAt: row.published_at || row.created_at,
    status: row.status,
  };
}

async function apiGet(path) {
  const urls = apiUrls(path);
  let lastError = new Error('Request failed');

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: '*/*' },
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.path ? `${data.error || 'Error'} (${data.path})` : (data.error || `Request failed (${res.status})`);
        lastError = new Error(detail);
        // Try fallback URL on 404
        if (res.status === 404) continue;
        throw lastError;
      }
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError;
}

export async function fetchOpportunitiesMeta() {
  return apiGet('/api/opportunities/meta');
}

export async function fetchOpportunities({
  search = '',
  category = 'all',
  page = 1,
  limit = 12,
  featured = false,
} = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (category && category !== 'all') params.set('category', category);
  if (search.trim()) params.set('search', search.trim());
  if (featured) params.set('featured', 'true');

  // Primary path with query string
  const path = `/api/opportunities?${params}`;
  const urls = [
    `${API_BASE}${path}`,
    `${API_BASE}/nf-cms/index.php?nf_path=${encodeURIComponent('api/opportunities')}&${params}`,
  ];

  let lastError = new Error('Request failed');
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: '*/*' },
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.path ? `${data.error || 'Error'} (${data.path})` : (data.error || `Request failed (${res.status})`);
        lastError = new Error(detail);
        if (res.status === 404) continue;
        throw lastError;
      }
      return {
        data: (data.data || []).map(mapOpportunity),
        pagination: data.pagination || { page: 1, total: 0, totalPages: 1 },
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError;
}

export async function fetchOpportunityBySlug(slug) {
  const row = await apiGet(`/api/opportunities/by-slug/${encodeURIComponent(slug)}`);
  return mapOpportunity(row);
}

export async function fetchFeatured(limit = 4) {
  const { data } = await fetchOpportunities({ featured: true, limit });
  return data.slice(0, limit);
}

export async function fetchRelated(opportunity, limit = 8) {
  const { data } = await fetchOpportunities({
    category: opportunity.category,
    limit: limit + 1,
  });
  const sameCategory = data.filter((o) => o.slug !== opportunity.slug);

  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);

  const { data: more } = await fetchOpportunities({ limit: limit + 5 });
  const others = more.filter(
    (o) => o.slug !== opportunity.slug && o.category !== opportunity.category
  );

  return [...sameCategory, ...others].slice(0, limit);
}
