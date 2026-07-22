const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { makeSlug } = require('./lib/slug');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'store.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const defaultStore = { users: [], opportunities: [] };

function readStore() {
  if (!fs.existsSync(dbPath)) {
    writeStore(defaultStore);
    return structuredClone(defaultStore);
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    writeStore(defaultStore);
    return structuredClone(defaultStore);
  }
}

function writeStore(store) {
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf8');
}

function seedAdminIfNeeded(store) {
  if (store.users.length > 0) return store;

  const email = process.env.ADMIN_EMAIL || 'admin@nerdzfactory.org';
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const name = process.env.ADMIN_NAME || 'Admin';

  store.users.push({
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    password_hash: bcrypt.hashSync(password, 10),
    role: 'admin',
    created_at: new Date().toISOString(),
  });

  console.log(`Default admin created: ${email}`);
  return store;
}

function seedSampleOpportunitiesIfEmpty(store) {
  if (store.opportunities.length > 0) return store;

  const adminId = store.users[0]?.id || null;
  const samples = [
    ['YouthHubAfrica Young Social Media Advocates Program 2026', 'A leadership program for young advocates driving social change through digital media.', 'https://example.com/apply', 'Fellowship', 'Africa', '2026-12-31', ['Youth', 'Media'], true, 'published'],
    ['Women-Led Business Grant 2026', 'Up to $750,000 in non-dilutive funding for women-led ventures.', 'https://example.com/apply', 'Grant', 'Global', '2026-08-15', ['Women', 'Entrepreneurship'], true, 'published'],
    ['UN Food Systems Youth Leadership Programme 2026', 'Youth leadership programme focused on sustainable food systems.', 'https://example.com/apply', 'Fellowship', 'Global', '2026-06-30', ['Youth', 'Agriculture'], false, 'published'],
    ['Claude Corps Fellowship 2026', 'Paid AI fellowship for emerging talent in artificial intelligence.', 'https://example.com/apply', 'Fellowship', 'Remote', '2026-05-01', ['AI', 'Tech'], false, 'published'],
    ['FG Skill-Up Artisans (SUPA) Training Programme 2026', 'Skills training programme for Nigerian artisans.', 'https://example.com/apply', 'Training', 'Nigeria', '2026-04-30', ['Skills', 'Nigeria'], false, 'published'],
    ['Y Combinator Fall 2026 Batch', 'Startup accelerator and funding program for early-stage founders.', 'https://example.com/apply', 'Accelerator', 'Global', '2026-09-01', ['Startup', 'Funding'], false, 'published'],
  ];

  const now = new Date().toISOString();
  for (const s of samples) {
    const title = s[0];
    store.opportunities.push({
      id: uuidv4(),
      slug: makeSlug(title, store.opportunities),
      title,
      summary: s[1],
      content: `<p>${s[1]}</p>`,
      apply_url: s[2],
      category: s[3],
      location: s[4],
      deadline: s[5],
      tags: s[6],
      featured: s[7],
      status: s[8],
      image: null,
      image_alt: title,
      created_by: adminId,
      created_at: now,
      updated_at: now,
      published_at: s[8] === 'published' ? now : null,
    });
  }

  return store;
}

function migrateOpportunityRecords(store) {
  let changed = false;
  for (const opp of store.opportunities) {
    if (!opp.slug) {
      opp.slug = makeSlug(opp.title, store.opportunities, opp.id);
      changed = true;
    }
    if (opp.content === undefined) {
      opp.content = opp.summary ? `<p>${opp.summary}</p>` : '';
      changed = true;
    }
    if (opp.image === undefined) {
      opp.image = null;
      changed = true;
    }
    if (opp.image_alt === undefined) {
      opp.image_alt = opp.title || '';
      changed = true;
    }
    if (opp.published_at === undefined && opp.status === 'published') {
      opp.published_at = opp.created_at || new Date().toISOString();
      changed = true;
    }
  }
  return changed;
}

let store = readStore();
store = seedAdminIfNeeded(store);
store = seedSampleOpportunitiesIfEmpty(store);
if (migrateOpportunityRecords(store)) writeStore(store);

const db = {
  getUsers() {
    return readStore().users;
  },

  findUserByEmail(email) {
    return readStore().users.find((u) => u.email === email.toLowerCase());
  },

  findUserById(id) {
    return readStore().users.find((u) => u.id === id);
  },

  createUser({ id, name, email, password_hash, role }) {
    const s = readStore();
    const user = {
      id,
      name,
      email: email.toLowerCase(),
      password_hash,
      role,
      created_at: new Date().toISOString(),
    };
    s.users.push(user);
    writeStore(s);
    return user;
  },

  getOpportunities() {
    return readStore().opportunities;
  },

  findOpportunityById(id) {
    return readStore().opportunities.find((o) => o.id === id);
  },

  findOpportunityBySlug(slug) {
    return readStore().opportunities.find((o) => o.slug === slug);
  },

  createOpportunity(data) {
    const s = readStore();
    const now = new Date().toISOString();
    const opp = { ...data, created_at: now, updated_at: now };
    s.opportunities.push(opp);
    writeStore(s);
    return opp;
  },

  updateOpportunity(id, updates) {
    const s = readStore();
    const idx = s.opportunities.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    s.opportunities[idx] = {
      ...s.opportunities[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    writeStore(s);
    return s.opportunities[idx];
  },

  deleteOpportunity(id) {
    const s = readStore();
    const before = s.opportunities.length;
    s.opportunities = s.opportunities.filter((o) => o.id !== id);
    writeStore(s);
    return before !== s.opportunities.length;
  },
};

module.exports = db;
