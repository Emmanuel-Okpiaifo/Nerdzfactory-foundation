function slugify(title) {
  return (title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(base, opportunities, excludeId = null) {
  const root = base || 'opportunity';
  let slug = root;
  let n = 1;

  while (
    opportunities.some((o) => o.slug === slug && (!excludeId || o.id !== excludeId))
  ) {
    slug = `${root}-${n}`;
    n += 1;
  }

  return slug;
}

function makeSlug(title, opportunities, excludeId = null) {
  return uniqueSlug(slugify(title), opportunities, excludeId);
}

module.exports = { slugify, uniqueSlug, makeSlug };
