# NerdzFactory Website — Deployment Walkthrough

This guide walks you through deploying the full NerdzFactory stack:

| Component | Folder | Purpose |
|-----------|--------|---------|
| **React website** | repo root (`src/`, `public/`) | Public-facing site (all pages) |
| **Opportunities CMS** | `cms/` | API + admin panel for posting opportunities |

The React app replaces the old static HTML files. WordPress can remain on the same domain for blog content (the React blog page reads from the WordPress REST API) or you can migrate fully later.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Local development setup](#3-local-development-setup)
4. [Production build](#4-production-build)
5. [Deploy the CMS (API + admin)](#5-deploy-the-cms-api--admin)
6. [Deploy the React frontend](#6-deploy-the-react-frontend)
7. [Run alongside WordPress on nerdzfactory.org](#7-run-alongside-wordpress-on-nerdzfactoryorg)
8. [DNS, SSL, and domain routing](#8-dns-ssl-and-domain-routing)
9. [Post-deploy checklist](#9-post-deploy-checklist)
10. [Day-to-day: posting opportunities](#10-day-to-day-posting-opportunities)
11. [Updating the site after changes](#11-updating-the-site-after-changes)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Architecture overview

```
                    ┌─────────────────────────────────────┐
                    │         nerdzfactory.org            │
                    └─────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
     ┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐
     │  React app     │    │  CMS API        │    │  WordPress       │
     │  (dist/)       │    │  (cms/server)   │    │  (optional)      │
     │                │    │                 │    │                  │
     │  /             │    │  /api/*         │    │  /blog (legacy)  │
     │  /opportunities│───▶│  /admin         │    │  wp-json API     │
     │  /about ...    │    │                 │    │                  │
     └────────────────┘    └─────────────────┘    └──────────────────┘
```

**How requests flow in production:**

- `nerdzfactory.org/` → React app (all public pages)
- `nerdzfactory.org/api/opportunities` → CMS API
- `nerdzfactory.org/admin` → CMS admin dashboard
- `nerdzfactory.org/opportunities` → React opportunities page (fetches from `/api`)

---

## 2. Prerequisites

Install on your development machine:

- **Node.js 18+** — [https://nodejs.org](https://nodejs.org)
- **Git**
- A **server or hosting account** (VPS, Railway, Render, Vercel, Netlify, or cPanel)
- **Domain access** (DNS records for nerdzfactory.org)
- **SSH access** (if using a VPS)

Recommended production tools:

- **PM2** — keeps the CMS Node process running (`npm install -g pm2`)
- **Nginx** or **Apache** — reverse proxy and static file serving
- **Certbot** — free SSL certificates (Let's Encrypt)

---

## 3. Local development setup

### Step 3.1 — Clone and install

```bash
git clone <your-repo-url> nerdzfactory.org
cd nerdzfactory.org

# Install React app dependencies (repo root)
cp .env.example .env
npm install

# Install CMS dependencies
cd cms
cp .env.example .env
npm install
cd ..
```

### Step 3.2 — Configure CMS environment

Edit `cms/.env`:

```env
PORT=3001
JWT_SECRET=use-a-long-random-string-at-least-32-chars
ADMIN_EMAIL=admin@nerdzfactory.org
ADMIN_PASSWORD=YourStrongPassword123
ADMIN_NAME=Admin
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

> **Important:** Change `JWT_SECRET` and `ADMIN_PASSWORD` before going live.

### Step 3.3 — Start both servers

**Terminal 1 — CMS:**

```bash
cd cms
npm run dev
```

CMS runs at:
- API: `http://localhost:3001/api/opportunities`
- Admin: `http://localhost:3001/admin`

**Terminal 2 — React app (from repo root):**

```bash
npm run dev
```

React app runs at: `http://localhost:5173`

The Vite dev server proxies `/api` requests to the CMS automatically.

### Step 3.4 — Verify locally

1. Open `http://localhost:5173` — home page loads
2. Open `http://localhost:5173/opportunities` — opportunities from CMS API
3. Open `http://localhost:3001/admin` — log in with your admin credentials
4. Create a test opportunity with image + content and confirm it appears on `/opportunities`

> The Vite dev server proxies `/api` and `/uploads` to the CMS on port 3001.

### Step 3.5 — Build the admin panel (optional for local dev)

During development the CMS serves files from `cms/public/admin/` directly. For production, build a static copy:

```bash
npm run build:admin
```

Output goes to `dist-admin/`. When `dist-admin/index.html` exists, the CMS server prefers it over the source folder.

---

## 4. Production build

### Step 4.1 — Build the React website

```bash
npm run build
```

Output is written to `dist/`:
- `index.html`
- `assets/` (CSS and JS bundles)
- `img/` (logo and images)

### Step 4.2 — Build the admin panel

```bash
npm run build:admin
```

Output is written to `dist-admin/`:
- `index.html`, `admin.css`, `admin.js`
- `img/` (logos for the admin UI)
- `build-manifest.json`

The CMS server automatically serves `dist-admin/` when present (falls back to `cms/public/admin/` during development).

### Step 4.3 — Test the production build locally

```bash
npx serve dist
```

Open the URL shown (usually `http://localhost:3000`). The CMS must be running for `/api` and `/uploads` to work — use the full stack on your server for end-to-end testing.

### Step 4.4 — Start the CMS in production

The CMS runs directly with Node (no separate compile step for the API):

```bash
cd cms
npm install --production
NODE_ENV=production node server.js
```

Or with PM2 (recommended):

```bash
pm2 start server.js --name nerdzfactory-cms
```

---

## 5. Deploy the CMS (API + admin)

Choose one hosting option below.

### Option A — VPS (DigitalOcean, Linode, AWS EC2) — Recommended

#### Step A.1 — Upload code to server

```bash
# On your local machine
rsync -avz --exclude node_modules --exclude cms/data ./cms/ user@your-server:/var/www/nerdzfactory-cms/
```

Or clone the repo on the server:

```bash
ssh user@your-server
git clone <your-repo-url> /var/www/nerdzfactory
cd /var/www/nerdzfactory/cms
npm install --production
```

#### Step A.2 — Create production `.env`

```bash
nano /var/www/nerdzfactory/cms/.env
```

```env
PORT=3001
JWT_SECRET=<generate-a-64-char-random-string>
ADMIN_EMAIL=admin@nerdzfactory.org
ADMIN_PASSWORD=<strong-password>
ADMIN_NAME=Admin
CORS_ORIGINS=https://nerdzfactory.org,https://www.nerdzfactory.org
```

#### Step A.4 — Build admin and ensure upload directory

On your **local machine** or CI, before deploying:

```bash
npm run build:admin
```

On the server, create a persistent uploads folder (must survive redeploys):

```bash
mkdir -p /var/www/nerdzfactory/cms/public/uploads/opportunities
chmod 755 /var/www/nerdzfactory/cms/public/uploads/opportunities
```

Upload `dist-admin/` to the server (same level as `cms/` in the repo):

```bash
rsync -avz dist-admin/ user@your-server:/var/www/nerdzfactory/dist-admin/
```

#### Step A.5 — Start with PM2

```bash
cd /var/www/nerdzfactory/cms
pm2 start server.js --name nerdzfactory-cms
pm2 save
pm2 startup   # follow the printed instructions
```

#### Step A.6 — Verify CMS is running

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","service":"nerdzfactory-opportunities-cms"}
```

---

### Option B — Railway or Render (managed Node hosting)

1. Create a new **Web Service** on [Railway](https://railway.app) or [Render](https://render.com)
2. Connect your GitHub repo
3. Set **Root Directory** to `cms`
4. Set **Start Command** to `node server.js`
5. Add environment variables from `cms/.env.example`
6. Deploy — note the assigned URL (e.g. `https://nerdzfactory-cms.up.railway.app`)

If the CMS is on a separate subdomain (`cms.nerdzfactory.org`), update `.env` at the repo root:

```env
VITE_API_URL=https://cms.nerdzfactory.org/api
```

Then rebuild the React app.

---

## 6. Deploy the React frontend

### Option A — VPS with Nginx (same server as CMS)

#### Step A.1 — Upload build output

```bash
# Local machine (from repo root)
npm run build
rsync -avz dist/ user@your-server:/var/www/nerdzfactory-web/
```

#### Step A.2 — Nginx configuration

Create `/etc/nginx/sites-available/nerdzfactory.org`:

```nginx
server {
    listen 80;
    server_name nerdzfactory.org www.nerdzfactory.org;

    # React static files
    root /var/www/nerdzfactory-web;
    index index.html;

    # CMS API proxy
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 12M;
    }

    # Uploaded opportunity images (CMS)
    location /uploads {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public";
    }

    # CMS admin panel
    location /admin {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 12M;
    }

    # Admin static assets & logos served by CMS
    location /img {
        proxy_pass http://127.0.0.1:3001;
    }

    # React SPA — all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/nerdzfactory.org /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step A.3 — Add SSL

```bash
sudo certbot --nginx -d nerdzfactory.org -d www.nerdzfactory.org
```

---

### Option B — Vercel or Netlify (static hosting + serverless proxy)

#### Vercel

1. Import the repo on [vercel.com](https://vercel.com)
2. Leave **Root Directory** as the repo root (default)
3. Build command: `npm run build`
4. Output directory: `dist`
5. `vercel.json` is already at the repo root:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://your-cms-host/api/$1" },
    { "source": "/admin", "destination": "https://your-cms-host/admin" },
    { "source": "/admin/(.*)", "destination": "https://your-cms-host/admin/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Replace `your-cms-host` with your CMS deployment URL.

#### Netlify

1. Connect repo (root directory — no subdirectory)
2. Build: `npm run build`, publish: `dist`
3. Add `public/_redirects`:

```
/api/*  https://your-cms-host/api/:splat  200
/admin/*  https://your-cms-host/admin/:splat  200
/*  /index.html  200
```

---

### Option C — cPanel shared hosting (React static + Node CMS)

This is the typical nerdzfactory.org setup: React site in `public_html`, CMS as a Node.js app on the same account.

#### C.1 — Deploy the React website

1. Build locally:
   ```bash
   npm run build
   ```
2. Upload everything inside `dist/` to `public_html/` (or your domain root).
3. Ensure SPA fallback in `public_html/.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### C.2 — Deploy the CMS (Node.js app in cPanel)

1. In cPanel, open **Setup Node.js App** (or **Application Manager**).
2. Create an application:
   - **Node.js version:** 18 or higher
   - **Application root:** e.g. `cms` (upload the `cms/` folder from this repo)
   - **Application URL:** e.g. `cms.nerdzfactory.org` or a subdomain/path your host supports
   - **Startup file:** `server.js`
3. Upload the full `cms/` directory including `node_modules` (run `npm install --production` in `cms/` on the server or locally first).
4. Set environment variables in cPanel (from `cms/.env.example`):

```env
PORT=<assigned-by-cpanel>
JWT_SECRET=<64-char-random-string>
ADMIN_EMAIL=admin@nerdzfactory.org
ADMIN_PASSWORD=<strong-password>
CORS_ORIGINS=https://nerdzfactory.org,https://www.nerdzfactory.org
```

5. Build and upload the admin panel:
   ```bash
   npm run build:admin
   ```
   Upload the `dist-admin/` folder to the **repo root on the server** (sibling to `cms/`). The CMS detects it automatically.

#### C.3 — Image uploads (persistent storage on cPanel)

Uploaded images are saved to:

```
cms/public/uploads/opportunities/
```

**This folder must be writable by Node** and must **not** be deleted on redeploy:

```bash
chmod 755 cms/public/uploads/opportunities
```

In cPanel File Manager, verify the folder exists and stays outside any auto-wipe deploy script. Back it up with your regular site backups.

Images are served at `https://your-cms-host/uploads/opportunities/<filename>.webp`.

#### C.4 — Connect the public site to the CMS

**Same domain (recommended)** — proxy `/api`, `/admin`, and `/uploads` to the Node app via `.htaccess` (requires `mod_proxy`; ask your host):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteRule ^api/(.*)$ http://127.0.0.1:PORT/api/$1 [P,L]
  RewriteRule ^uploads/(.*)$ http://127.0.0.1:PORT/uploads/$1 [P,L]
  RewriteRule ^admin$ http://127.0.0.1:PORT/admin [P,L]
  RewriteRule ^admin/(.*)$ http://127.0.0.1:PORT/admin/$1 [P,L]

  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

Replace `PORT` with the port cPanel assigned to your Node app.

**Separate subdomain** — if the CMS runs at `cms.nerdzfactory.org`:

1. Set `VITE_API_URL=https://cms.nerdzfactory.org` in `.env` before building the React app.
2. Rebuild: `npm run build`
3. Add CORS origin for `https://nerdzfactory.org` in `cms/.env`.

#### C.5 — Backup CMS data

Opportunities and users live in `cms/data/store.json`. Image files live in `cms/public/uploads/`. Back up **both** regularly:

```bash
cp cms/data/store.json cms/data/store.backup.$(date +%Y%m%d).json
tar -czf uploads-backup.tar.gz cms/public/uploads/
```

> If `mod_proxy` is not available, host the CMS on Railway/Render and set `VITE_API_URL` to the external CMS URL before building the React app.

---

## 7. Run alongside WordPress on nerdzfactory.org

You currently have WordPress at `nerdzfactory.org`. Choose the strategy that matches how much of the site you want to replace.

### Strategy 0 — Softaculous WordPress stays primary; Opportunities at `/opportunities` (recommended)

**Goal:** Keep Softaculous WordPress on `nerdzfactory.org`. Serve the new app at **`https://nerdzfactory.org/opportunities`** (same domain). CMS at `/admin` + `/api` + `/uploads` on the same domain via Node proxy.

```
nerdzfactory.org                 → Softaculous WordPress (everything else)
nerdzfactory.org/opportunities   → React Opportunities app
nerdzfactory.org/admin           → CMS admin panel
nerdzfactory.org/api/*           → CMS API
nerdzfactory.org/uploads/*       → Opportunity images
```

> Prefer this over a subdomain if you want the URL to stay exactly `/opportunities`.

#### Step 0.1 — Deploy the CMS (Node.js) on cPanel

1. Upload the `cms/` folder to the server (e.g. `home/USER/cms` — **outside** Softaculous WordPress if possible).
2. On your computer: `npm run build:admin`  
   Upload `dist-admin/` as a **sibling** of `cms/` (same parent folder).
3. Ensure `cms/public/uploads/opportunities/` exists and is writable.
4. cPanel → **Setup Node.js App**:
   - Application root → `cms`
   - Application URL → can be a subdomain like `cms.nerdzfactory.org` **or** an internal app URL (you will proxy `/api`, `/admin`, `/uploads` from the main domain)
   - Startup file → `server.js`
   - Node 18+
5. Environment variables:

```env
JWT_SECRET=<long-random-string>
ADMIN_EMAIL=admin@nerdzfactory.org
ADMIN_PASSWORD=<strong-password>
ADMIN_NAME=Admin
CORS_ORIGINS=https://nerdzfactory.org,https://www.nerdzfactory.org
```

6. NPM Install → Start/Restart the app. Note the **port** cPanel assigns (shown in the Node app UI).

Smoke-test via the Node app URL first (subdomain or port), then wire the main domain in Step 0.3.

#### Step 0.2 — Build the Opportunities React app for same-domain

On your computer, build with a **subfolder base** so WordPress files are not overwritten. Assets live under `/nf-app/`; routes stay `/opportunities`.

**PowerShell:**

```powershell
$env:VITE_BASE="/nf-app/"
# Leave VITE_API_URL unset so the app calls /api on the same domain
npm run build
npm run build:admin
```

**bash:**

```bash
VITE_BASE=/nf-app/ npm run build
npm run build:admin
```

#### Step 0.3 — Upload React files (do not wipe WordPress)

1. In cPanel File Manager, create folder: `public_html/nf-app/`
2. Upload **everything inside** `dist/` into `public_html/nf-app/`  
   (`index.html`, `assets/`, `img/`, …)
3. **Do not** replace Softaculous WordPress `index.php` or the WordPress root.

#### Step 0.4 — Wire `/opportunities`, `/admin`, `/api` (PHP proxy — works without mod_proxy)

Your host is returning **404** for `/api/health`, which usually means Apache `[P]` proxy is blocked. Use the PHP proxy instead.

1. From this repo’s **`cpanel/`** folder, upload into **`public_html/`** (site root, not `nf-app/`):
   - `nf-proxy.php`
   - `nf-proxy-config.example.php` → copy/rename to **`nf-proxy-config.php`**
2. Edit `public_html/nf-proxy-config.php` and set `CMS_ORIGIN` to your Node app URL from **Setup Node.js App**:
   - Prefer `http://127.0.0.1:PORT` (replace PORT)
   - Or `https://your-node-app-url` if cPanel shows a subdomain URL
3. Replace the NerdzFactory block at the top of `public_html/.htaccess` with:

```apache
# ---- NerdzFactory Opportunities (React + CMS) ----
<IfModule mod_rewrite.c>
RewriteEngine On

# CMS via PHP proxy (no mod_proxy needed)
RewriteRule ^api/(.*)$ /nf-proxy.php?nf_path=api/$1 [L,QSA]
RewriteRule ^uploads/(.*)$ /nf-proxy.php?nf_path=uploads/$1 [L,QSA]
RewriteRule ^admin/?$ /nf-proxy.php?nf_path=admin [L,QSA]
RewriteRule ^admin/(.*)$ /nf-proxy.php?nf_path=admin/$1 [L,QSA]

# Public opportunities → React SPA in /nf-app/
RewriteRule ^opportunities/?$ /nf-app/index.html [L]
RewriteRule ^opportunities/(.*)$ /nf-app/index.html [L]
</IfModule>
# ---- End NerdzFactory Opportunities ----
```

4. Confirm the Node app is **Running**, then open:
   - `https://nerdzfactory.org/api/health` → must show `{"status":"ok",...}`
   - Then reload `/opportunities`

#### Step 0.5 — Point WordPress navbar to `/opportunities`

1. WordPress → **Appearance → Menus**
2. Set Opportunities URL to:

```
https://nerdzfactory.org/opportunities
```

3. Save. Update footer / Elementor buttons the same way if needed.

#### Step 0.6 — Draft the old WordPress Opportunities page

1. **Pages → Opportunities** → **Draft** → Update  
   (Do this **after** `.htaccess` is live so the React app owns the URL.)

Optional: draft old opportunity **posts** later; public listing comes from the CMS.

#### Step 0.7 — Verify

- [ ] `https://nerdzfactory.org/opportunities` — new listing
- [ ] `https://nerdzfactory.org/opportunities/some-slug` — detail page
- [ ] `https://nerdzfactory.org/admin` — CMS login
- [ ] `https://nerdzfactory.org/api/health` — `{"status":"ok"}`
- [ ] Publish a test opportunity in admin → appears on the public page
- [ ] Rest of WordPress site still works (home, blog, etc.)

#### Softaculous notes

- Never upload React `dist/` over the WordPress root; only into `public_html/nf-app/`.
- Softaculous updates must not wipe your custom `.htaccess` block — re-check after WP updates.
- Back up `cms/data/store.json` and `cms/public/uploads/`.

---

### Strategy 0b — Subdomain instead (optional)

If same-domain proxy is not available on your host, use `opportunities.nerdzfactory.org` + `cms.nerdzfactory.org` as documented earlier in older deploy notes, then 301 `/opportunities/` to the subdomain. Prefer Strategy 0 above when possible.

---

### Strategy 1 — React as primary, WordPress on subdirectory

| URL | Serves |
|-----|--------|
| `nerdzfactory.org/*` | React app |
| `nerdzfactory.org/wp/` or `wp.nerdzfactory.org` | WordPress admin + legacy |
| `nerdzfactory.org/wp-json/` | WordPress REST API (blog page uses this) |

**Steps:**

1. Move WordPress files to `/var/www/wordpress/` or a subdomain
2. Update WordPress `siteurl` and `home` in `wp-config.php` or database
3. Point Nginx root to React `dist/` (see Section 6)
4. Unpublish or redirect the old WordPress `/opportunities/` page:

```apache
# In WordPress .htaccess or Redirection plugin
Redirect 301 /opportunities/ https://nerdzfactory.org/opportunities
```

### Strategy 2 — Gradual migration (subpaths)

Serve React only for specific paths via Nginx:

```nginx
location /opportunities {
    root /var/www/nerdzfactory-web;
    try_files $uri $uri/ /index.html;
}

location / {
    # Existing WordPress config
    try_files $uri $uri/ /index.php?$args;
}
```

Expand paths as you migrate more pages.

### Strategy 3 — Cloudflare Workers routing

If DNS is on Cloudflare and you cannot edit the origin server:

1. Host React on Vercel/Netlify
2. Create a Cloudflare Worker that routes:
   - `/opportunities`, `/about`, `/programs`, etc. → Vercel
   - Everything else → WordPress origin

---

## 8. DNS, SSL, and domain routing

### DNS records (typical VPS setup)

| Type | Name | Value |
|------|------|-------|
| A | `@` | Your server IP |
| A | `www` | Your server IP |
| CNAME | `cms` | (optional) CMS subdomain |

### SSL

- **VPS + Nginx:** Use Certbot (`certbot --nginx`)
- **Vercel/Netlify:** SSL is automatic
- **Cloudflare:** Enable "Full (strict)" SSL mode

### www redirect

Add to Nginx:

```nginx
server {
    listen 443 ssl;
    server_name www.nerdzfactory.org;
    return 301 https://nerdzfactory.org$request_uri;
}
```

---

## 9. Post-deploy checklist

- [ ] `https://nerdzfactory.org` loads the React home page
- [ ] All nav links work (`/about`, `/programs`, `/contact`, etc.)
- [ ] `https://nerdzfactory.org/opportunities` shows opportunities from CMS
- [ ] `https://nerdzfactory.org/admin` loads the CMS login
- [ ] Admin login works with production credentials
- [ ] Default password `changeme123` has been changed
- [ ] `JWT_SECRET` is a strong random value (not the dev default)
- [ ] `https://nerdzfactory.org/api/health` returns `{"status":"ok"}`
- [ ] `/uploads` proxy works (upload a test image in admin, confirm it displays on site)
- [ ] `npm run build:admin` output deployed (`dist-admin/` on server)
- [ ] Blog page loads articles from WordPress API
- [ ] Mobile menu works on phone
- [ ] SSL certificate is valid (padlock in browser)
- [ ] Old WordPress `/opportunities/` redirects to new page
- [ ] Google Search Console updated with new sitemap (optional)

---

## 10. Day-to-day: posting opportunities

### For team members (editors)

1. Go to `https://nerdzfactory.org/admin`
2. Sign in with your email and password
3. Click **New Post**
4. Fill in:
   - **Title** — opportunity name (auto-generates URL slug)
   - **URL slug** — optional override for `/opportunities/your-slug`
   - **Featured image** — upload, crop freely (or use full image), add alt text
   - **Short description** — appears on listing cards
   - **Full content** — rich text shown on the detail page (this is the main body)
   - **Apply URL** — external application link (`https://` or `mailto:`)
   - **Category** — Grant, Fellowship, etc.
   - **Location** — Remote, Nigeria, Africa, Global
   - **Deadline** — optional
   - **Tags** — comma-separated keywords
5. Toggle **Feature this opportunity** for spotlight placement on the listing page
6. Click **Publish** (or **Save as Draft** to hide from public)

Changes appear on `/opportunities` immediately — **no website rebuild required**.

### Image cropping

After selecting an image, the crop tool opens:
- **Drag** to select any area (free-form, no fixed aspect ratio)
- **Apply crop** — uploads the cropped region
- **Use full image** — uploads without cropping

Images are stored on the server at `/uploads/opportunities/` and displayed on listing cards and detail pages.

### For admins (adding team members)

1. Log in to `/admin`
2. Go to **Team** in the sidebar
3. Enter name, email, and password for the new editor
4. Click **Add Team Member**

---

## 11. Updating the site after changes

### Update opportunities (CMS — no rebuild)

Edit or create opportunities in `/admin`. The public site reads from the CMS API at runtime.

### One-time import from WordPress

To seed the CMS from the old WordPress export:

```bash
npm run migrate:cms
```

This merges `src/data/opportunities.json` into `cms/data/store.json`. Restart the CMS after migrating.

To refresh JSON from live WordPress first:

```bash
npm run import:opportunities
npm run migrate:cms
```

### Update admin panel styling

Edit files in `cms/public/admin/`, then rebuild:

```bash
npm run build:admin
```

Redeploy `dist-admin/` to the server (or restart CMS if serving from repo root).

### Update page content (React — requires rebuild)

Page content lives in the React app:

- **Legacy-style pages** (about, programs, etc.): edit files in `src/content/`, then rebuild.
- **Opportunities listing UI**: edit `src/pages/OpportunitiesPage.jsx` and `src/styles/opportunities.css`.
- **Home, blog, layout**: edit components in `src/pages/` and `src/components/`.

```bash
npm run build
# Re-deploy dist/
```

### Update CMS API code

```bash
# On server
cd /var/www/nerdzfactory/cms
git pull
npm install --production
pm2 restart nerdzfactory-cms
```

### Backup CMS data

Back up both the database file and uploaded images:

```bash
cp cms/data/store.json cms/data/store.backup.$(date +%Y%m%d).json
tar -czf uploads-backup.tar.gz cms/public/uploads/
```

---

## 12. Troubleshooting

### Opportunities page shows "Couldn't load opportunities"

| Cause | Fix |
|-------|-----|
| CMS not running | `pm2 status` → restart with `pm2 restart nerdzfactory-cms` |
| API proxy misconfigured | Test `curl https://nerdzfactory.org/api/health` |
| CORS error | Add your domain to `CORS_ORIGINS` in `cms/.env` |
| Wrong API URL | Set `VITE_API_URL` in `.env` and rebuild |

### React routes return 404 on refresh

Nginx/Apache must serve `index.html` for all non-file routes. See SPA fallback config in Section 6.

### Admin panel images broken

Ensure `/img/` is proxied to the CMS (logos load from the CMS server). Run `npm run build:admin` so `dist-admin/img/` contains logo assets.

### Uploaded opportunity images 404

| Cause | Fix |
|-------|-----|
| `/uploads` not proxied | Add nginx/Apache proxy rule for `/uploads` |
| Folder not writable | `chmod 755 cms/public/uploads/opportunities` |
| Folder wiped on deploy | Exclude `cms/public/uploads/` from deploy scripts |
| CMS not running | Restart PM2 / cPanel Node app |

### Admin shows old styling

Run `npm run build:admin` and redeploy `dist-admin/`, or delete `dist-admin/` on the server to fall back to `cms/public/admin/`.

### Blog page empty

The blog fetches from `https://nerdzfactory.org/wp-json/wp/v2`. WordPress must remain accessible and the "Articles" category must exist.

### PM2 CMS crashes on restart

```bash
pm2 logs nerdzfactory-cms
```

Common issues: missing `.env`, port 3001 already in use, permission denied on `cms/data/`.

---

## Quick reference — commands

```bash
# Local dev (from repo root)
npm run dev          # Start React on :5173
npm run dev:cms      # Start CMS on :3001

# Production builds
npm run build        # React site → dist/
npm run build:admin  # Admin panel → dist-admin/

# CMS production start
cd cms && pm2 start server.js --name nerdzfactory-cms

# Data migration
npm run migrate:cms  # Import JSON → CMS store
```

---

## Project structure

```
nerdzfactory.org/           # React app (Vite) — public website
├── src/
│   ├── components/         # Header, Footer, Layout
│   ├── pages/              # Home, Opportunities, Blog, Legacy pages
│   ├── lib/
│   │   ├── opportunities.js    # Shared helpers (deadlines, icons)
│   │   └── opportunitiesApi.js   # CMS API client
│   └── styles/
├── dist/                   # Production React build
├── dist-admin/             # Production admin build (npm run build:admin)
├── cms/                    # Opportunities CMS (Node.js)
│   ├── server.js           # API + serves dist-admin or public/admin
│   ├── routes/             # auth, opportunities, uploads
│   ├── public/
│   │   ├── admin/          # Admin source (dev)
│   │   └── uploads/        # Uploaded images (backup this!)
│   └── data/store.json     # Database (backup this!)
├── scripts/
│   ├── build-admin.mjs
│   └── migrate-json-to-cms.mjs
└── DEPLOY.md
```

---

*Last updated: July 2026*
