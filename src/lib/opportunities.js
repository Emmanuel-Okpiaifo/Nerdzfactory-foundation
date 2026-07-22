import opportunitiesData from '../data/opportunities.json';

export function decodeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—');
}

/** Strip deadline prefix from listing summaries for use as a lead / card excerpt. */
export function getOpportunityLead(summary) {
  const text = decodeHtml(summary || '');
  return text
    // "Application Deadline: July 26, 2026 Going into..." (often no period after the date)
    .replace(/^Application\s+Deadline:?\s*.+?\d{4}\.?\s*/i, '')
    .replace(/^Deadline:?\s*.+?\d{4}\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when CMS/Quill HTML has no visible text (e.g. <p><br></p>). */
export function isEffectivelyEmptyHtml(html) {
  if (!html) return true;
  const text = String(html)
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  return text.length === 0;
}

/** Normalize imported WordPress / Elementor markup for clean reading. */
export function isNerdzfactoryPostUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url, 'https://nerdzfactory.org');
    if (!u.hostname.includes('nerdzfactory.org')) return false;
    if (u.pathname.includes('/wp-content/')) return false;
    if (u.pathname.includes('/wp-json/')) return false;
    return true;
  } catch {
    return false;
  }
}

const SOCIAL_HOST_RE =
  /facebook\.com|twitter\.com|x\.com|linkedin\.com|intent\/tweet|sharer/i;

/** Pull the real application URL from imported post HTML. */
export function extractApplyUrlFromHtml(html) {
  if (!html) return null;

  const buttonPatterns = [
    /class="elementor-button[^"]*"[^>]*href="([^"]+)"/i,
    /href="([^"]+)"[^>]*class="elementor-button/i,
  ];

  for (const re of buttonPatterns) {
    const match = html.match(re);
    if (match?.[1] && !isNerdzfactoryPostUrl(match[1])) {
      return match[1];
    }
  }

  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);

  for (const href of links) {
    if (href.startsWith('mailto:')) return href;
    if (!href.startsWith('http')) continue;
    if (isNerdzfactoryPostUrl(href)) continue;
    if (SOCIAL_HOST_RE.test(href)) continue;
    return href;
  }

  return null;
}

/** Prefer external application URLs over WordPress post permalinks. */
export function resolveApplyUrl(item) {
  const fromHtml = extractApplyUrlFromHtml(item?.content);
  if (fromHtml) return fromHtml;

  if (item?.applyUrl && !isNerdzfactoryPostUrl(item.applyUrl)) {
    return item.applyUrl;
  }

  return null;
}

function isApplyCtaAnchor(anchor) {
  const label = (anchor.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    /click\s+(here\s+)?to\s+apply/.test(label) ||
    /^apply\s+(now|here)$/.test(label) ||
    anchor.classList.contains('elementor-button') ||
    anchor.classList.contains('elementor-button-link')
  );
}

function removeAnchorTree(anchor) {
  const widget =
    anchor.closest('.elementor-section') ||
    anchor.closest('.elementor-widget') ||
    anchor.closest('.elementor-element') ||
    anchor.closest('.elementor-button-wrapper');
  (widget || anchor).remove();
}

/** Normalize imported WordPress / Elementor markup for clean reading. */
export function prepareProseHtml(html, { sourceUrl } = {}) {
  if (!html) return '';

  let cleaned = html
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, '')
    .replace(/<p>\s*Application Deadline:?\s*<strong>[^<]*<\/strong>\s*<\/p>/gi, '');

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(cleaned, 'text/html');
    const root = doc.body;

    root.querySelectorAll('.elementor-section').forEach((section) => {
      if (section.querySelector('.elementor-widget-button')) {
        section.remove();
      }
    });

    root.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      const normalizedSource = sourceUrl?.replace(/\/$/, '');
      const normalizedHref = href.replace(/\/$/, '');

      if (
        isNerdzfactoryPostUrl(href) ||
        (normalizedSource && normalizedHref === normalizedSource) ||
        isApplyCtaAnchor(anchor)
      ) {
        removeAnchorTree(anchor);
      }
    });

    root.querySelectorAll('.elementor-widget-button').forEach((el) => el.remove());

    root.querySelectorAll('.elementor-section').forEach((section) => {
      const text = (section.textContent || '').replace(/\s+/g, ' ').trim();
      const hasMedia = section.querySelector('img, iframe, video, table');
      if (!text && !hasMedia) section.remove();
    });

    const structural = [
      '.elementor-widget-container',
      '.elementor-widget-wrap',
      '.elementor-column',
      '.elementor-container',
      '.elementor',
    ];

    for (let pass = 0; pass < 6; pass += 1) {
      structural.forEach((selector) => {
        root.querySelectorAll(selector).forEach((el) => {
          const hasContent = el.querySelector(
            'img, iframe, video, table, ul, ol, p, h1, h2, h3, h4, blockquote'
          );
          const text = (el.textContent || '').replace(/\s+/g, '').trim();
          if (!hasContent && !text) el.remove();
        });
      });
    }

    cleaned = root.innerHTML;
  } else {
    cleaned = cleaned
      .replace(/<a[^>]*elementor-button[^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(/<div[^>]*elementor-widget-button[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
      .replace(/<a[^>]*href="https?:\/\/[^"]*nerdzfactory\.org[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
  }

  return cleaned.trim();
}

const ALL = opportunitiesData.map((o) => ({
  ...o,
  title: decodeHtml(o.title),
  imageAlt: decodeHtml(o.imageAlt),
}));

let detailsCache = null;

async function loadDetails() {
  if (!detailsCache) {
    const mod = await import('../data/opportunity-details.json');
    detailsCache = mod.default;
  }
  return detailsCache;
}

export function getAllOpportunities() {
  return ALL;
}

export function getOpportunityBySlug(slug) {
  return ALL.find((o) => o.slug === slug) || null;
}

export async function getOpportunityWithContent(slug) {
  const item = getOpportunityBySlug(slug);
  if (!item) return null;
  const details = await loadDetails();
  const detail = details[slug];
  if (!detail) return { ...item, applyUrl: resolveApplyUrl(item) };
  const merged = { ...item, ...detail };
  return { ...merged, applyUrl: resolveApplyUrl(merged) };
}

export function getCategories() {
  const counts = {};
  for (const o of ALL) {
    counts[o.category] = (counts[o.category] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export function queryOpportunities({ search = '', category = 'all', page = 1, limit = 12, featuredOnly = false }) {
  let items = [...ALL];

  if (featuredOnly) {
    items = items.filter((o) => o.featured);
  } else if (category === 'all' && !search.trim()) {
    items = items.filter((o) => !o.featured);
  }

  if (category !== 'all') {
    items = items.filter((o) => o.category === category);
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.summary.toLowerCase().includes(q) ||
        o.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const data = items.slice(offset, offset + limit);

  return { data, pagination: { page, limit, total, totalPages } };
}

export function getFeatured(limit = 4) {
  return ALL.filter((o) => o.featured).slice(0, limit);
}

export function getRelated(opportunity, limit = 6) {
  const sameCategory = ALL.filter(
    (o) => o.slug !== opportunity.slug && o.category === opportunity.category
  );
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);

  const others = ALL.filter(
    (o) => o.slug !== opportunity.slug && o.category !== opportunity.category
  );
  return [...sameCategory, ...others].slice(0, limit);
}

export function formatDeadline(deadline) {
  if (!deadline) return { label: 'Open — apply now', expired: false, urgent: false };
  const d = new Date(deadline);
  const expired = d < new Date();
  const daysLeft = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return { label, expired, urgent: !expired && daysLeft <= 14 };
}

export const CATEGORY_ICONS = {
  Grant: 'fa-hand-holding-usd',
  Fellowship: 'fa-user-graduate',
  Internship: 'fa-laptop-house',
  Training: 'fa-chalkboard-teacher',
  Accelerator: 'fa-rocket',
  Competition: 'fa-trophy',
  Scholarship: 'fa-graduation-cap',
  Other: 'fa-star',
};

export const FALLBACK_IMAGE =
  'https://nerdzfactory.org/wp-content/uploads/2023/04/FM_03445-2.jpg';
