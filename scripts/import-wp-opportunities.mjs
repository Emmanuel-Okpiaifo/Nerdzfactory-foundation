/**
 * Fetches opportunities from WordPress (category: opportunities, id 69)
 * and saves locally for the React app.
 *
 * Usage: node scripts/import-wp-opportunities.mjs
 * Optional: node scripts/import-wp-opportunities.mjs --limit=100
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_INDEX = path.join(ROOT, 'src', 'data', 'opportunities.json');
const OUT_DETAILS = path.join(ROOT, 'src', 'data', 'opportunity-details.json');

const WP_BASE = 'https://nerdzfactory.org/wp-json/wp/v2';
const OPPORTUNITIES_CATEGORY_ID = 69;
const PER_PAGE = 50;

const CATEGORY_KEYWORDS = [
  ['Grant', /\bgrant\b/i],
  ['Fellowship', /\bfellowship\b/i],
  ['Internship', /\binternship\b/i],
  ['Scholarship', /\bscholarship\b/i],
  ['Accelerator', /\baccelerator\b/i],
  ['Competition', /\bcompetition\b/i],
  ['Training', /\btraining\b|\bprogramme\b|\bprogram\b/i],
];

const LOCATION_KEYWORDS = [
  ['Nigeria', /\bnigeria\b|\bnysc\b|\bnigerian\b/i],
  ['Africa', /\bafrica\b|\bafrican\b|\bpan-african\b/i],
  ['Remote', /\bremote\b|\bvirtual\b|\bonline\b/i],
];

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDeadline(text) {
  const combined = text || '';
  const patterns = [
    /application\s+deadline[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /deadline[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /closes?\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const re of patterns) {
    const m = combined.match(re);
    if (m) {
      const d = new Date(m[1]);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
  }
  return null;
}

function inferCategory(title) {
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(title)) return cat;
  }
  return 'Other';
}

function inferLocation(title, text) {
  const hay = `${title} ${text}`;
  for (const [loc, re] of LOCATION_KEYWORDS) {
    if (re.test(hay)) return loc;
  }
  return 'Global';
}

function extractApplyUrl(html, fallback) {
  const links = [...(html || '').matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const external = links.find(
    (u) =>
      u.startsWith('http') &&
      !u.includes('nerdzfactory.org') &&
      !u.includes('facebook.com/sharer') &&
      !u.includes('twitter.com/intent') &&
      !u.includes('linkedin.com/share')
  );
  return external || fallback;
}

function extractTags(title) {
  const tags = [];
  const checks = [
    ['Women', /women/i],
    ['Youth', /youth/i],
    ['STEM', /stem/i],
    ['AI', /\bai\b|artificial intelligence/i],
    ['Entrepreneurship', /entrepreneur|startup|sme/i],
    ['Agriculture', /agri|farm/i],
  ];
  for (const [tag, re] of checks) {
    if (re.test(title)) tags.push(tag);
  }
  return tags;
}

function decodeHtmlEntities(str) {
  return (str || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–');
}

function mapPost(post) {
  const title = decodeHtmlEntities(stripHtml(post.title?.rendered || ''));
  const excerptHtml = post.excerpt?.rendered || '';
  const contentHtml = post.content?.rendered || '';
  const plain = stripHtml(excerptHtml) || stripHtml(contentHtml).slice(0, 280);
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const image = media?.source_url || null;
  const imageAlt = media?.alt_text || title;
  const deadline = parseDeadline(`${excerptHtml} ${contentHtml.slice(0, 2000)}`);
  const applyUrl = extractApplyUrl(contentHtml, post.link);
  const slug = post.slug;

  return {
    id: `wp-${post.id}`,
    wpId: post.id,
    slug,
    title,
    summary: plain.length > 300 ? `${plain.slice(0, 297)}...` : plain,
    image,
    imageAlt,
    deadline,
    applyUrl,
    sourceUrl: post.link,
    category: inferCategory(title),
    location: inferLocation(title, plain),
    tags: extractTags(title),
    publishedAt: post.date,
    featured: false,
  };
}

async function fetchPage(page) {
  const url = `${WP_BASE}/posts?categories=${OPPORTUNITIES_CATEGORY_ID}&per_page=${PER_PAGE}&page=${page}&_embed`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NerdzFactory-Import/1.0' },
  });
  if (!res.ok) throw new Error(`WP API page ${page}: ${res.status}`);
  const total = parseInt(res.headers.get('x-wp-total') || '0', 10);
  const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
  const posts = await res.json();
  return { posts, total, totalPages };
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const maxItems = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  const dataDir = path.dirname(OUT_INDEX);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  console.log('Fetching WordPress opportunities (category 69)...');

  const allPosts = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && allPosts.length < maxItems) {
    const { posts, total, totalPages: tp } = await fetchPage(page);
    totalPages = tp;
    allPosts.push(...posts);
    console.log(`  Page ${page}/${totalPages} — ${allPosts.length}/${total} posts`);
    page += 1;
    if (posts.length === 0) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  const sliced = allPosts.slice(0, maxItems);
  const index = [];
  const details = {};

  for (const post of sliced) {
    const item = mapPost(post);
    index.push(item);
    details[item.slug] = {
      content: post.content?.rendered || '',
      excerpt: post.excerpt?.rendered || '',
      applyUrl: item.applyUrl,
      sourceUrl: item.sourceUrl,
    };
  }

  // Feature the 4 most recent
  index.slice(0, 4).forEach((o) => { o.featured = true; });

  index.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  fs.writeFileSync(OUT_INDEX, JSON.stringify(index, null, 2));
  fs.writeFileSync(OUT_DETAILS, JSON.stringify(details));

  console.log(`\nSaved ${index.length} opportunities:`);
  console.log(`  ${OUT_INDEX}`);
  console.log(`  ${OUT_DETAILS}`);
  console.log(`  With images: ${index.filter((o) => o.image).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
