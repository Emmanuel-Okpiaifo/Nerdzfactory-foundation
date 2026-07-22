/**
 * Build the CMS admin panel into dist-admin/ at the repo root.
 * Run: npm run build:admin
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcAdmin = path.join(root, 'cms', 'public', 'admin');
const srcImg = path.join(root, 'cms', 'public', 'img');
const outDir = path.join(root, 'dist-admin');

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

console.log('Building admin panel → dist-admin/');
rmDir(outDir);
copyDir(srcAdmin, outDir);
copyDir(srcImg, path.join(outDir, 'img'));

const manifest = {
  builtAt: new Date().toISOString(),
  source: 'cms/public/admin',
  output: 'dist-admin',
};

fs.writeFileSync(
  path.join(outDir, 'build-manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

const files = fs.readdirSync(outDir);
console.log(`Done. ${files.length} top-level items in dist-admin/`);
console.log('Serve via CMS: npm run start:cms (uses dist-admin when present)');
