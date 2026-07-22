import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Same-domain cPanel deploy (WordPress + /opportunities):
//   Create .env.production with:  VITE_BASE=/nf-app/
//   Then:  npm run build
// On Git Bash, do NOT set VITE_BASE=/nf-app/ inline — MSYS rewrites it to
// "Program Files/Git/...". Prefer .env.production or PowerShell.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let base = env.VITE_BASE || '/'

  // Guard against Git Bash / MSYS path mangling
  if (base.includes('Program Files') || base.includes('Git/nf-app')) {
    console.warn(
      '[vite] VITE_BASE was mangled by the shell; using /nf-app/ instead.',
      'Set VITE_BASE in .env.production to avoid this.'
    )
    base = '/nf-app/'
  }

  if (!base.endsWith('/')) base = `${base}/`

  return {
    plugins: [react()],
    base,
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  }
})
