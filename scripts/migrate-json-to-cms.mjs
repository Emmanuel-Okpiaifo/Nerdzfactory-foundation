/**
 * One-time migration: import WordPress JSON into CMS store.json
 * Run: npm run migrate:cms
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const listingsPath = path.join(root, 'src/data/opportunities.json');
const detailsPath = path.join(root, 'src/data/opportunity-details.json');
const storePath = path.join(root, 'cms/data/store.json');

function slugify(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(base, used) {
  let slug = base || 'opportunity';
  let n = 1;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureStore() {
  const dataDir = path.dirname(storePath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(storePath)) {
    return { users: [], opportunities: [] };
  }
  return readJson(storePath);
}

const listings = readJson(listingsPath);
const details = readJson(detailsPath);
const store = ensureStore();
const usedSlugs = new Set(store.opportunities.map((o) => o.slug).filter(Boolean));

let imported = 0;
let skipped = 0;

for (const item of listings) {
  const slug = item.slug || uniqueSlug(slugify(item.title), usedSlugs);
  if (store.opportunities.some((o) => o.slug === slug)) {
    skipped += 1;
    continue;
  }

  const detail = details[item.slug] || {};
  const content = detail.content || (item.summary ? `<p>${item.summary}</p>` : '');

  store.opportunities.push({
    id: randomUUID(),
    slug,
    title: item.title,
    summary: item.summary || '',
    content,
    apply_url: item.applyUrl || detail.applyUrl || 'https://example.com',
    category: item.category || 'Other',
    location: item.location || 'Global',
    deadline: item.deadline || null,
    tags: item.tags || [],
    featured: Boolean(item.featured),
    status: 'published',
    image: item.image || null,
    image_alt: item.imageAlt || item.title,
    created_by: store.users[0]?.id || null,
    created_at: item.publishedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published_at: item.publishedAt || new Date().toISOString(),
  });
  imported += 1;
}

fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
console.log(`Migration complete: ${imported} imported, ${skipped} skipped (already in store).`);
console.log(`Store: ${storePath}`);
