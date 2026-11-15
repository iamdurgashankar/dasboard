import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'devinquire-embedded-api',
        configureServer(server) {
          let apiAppPromise: Promise<any> | null = null;
          server.middlewares.use(async (req, res, next) => {
            if (!req.url || (!req.url.startsWith('/api') && !req.url.startsWith('/health'))) {
              return next();
            }
            try {
              if (!apiAppPromise) {
                apiAppPromise = import('./server/server.js');
              }
              const mod = await apiAppPromise;
              await mod.ready;
              return mod.app(req, res, next);
            } catch {
              return next();
            }
          });
        }
      }
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              // Engine: React, Router, and core sub-dependencies
              if (
                id.includes('react-dom') ||
                id.includes('react/') ||
                id.includes('react-router') ||
                id.includes('scheduler') ||
                id.includes('object-assign') ||
                id.includes('tiny-invariant') ||
                id.includes('@remix-run')
              ) {
                return 'vendor-engine';
              }
              // Data Viz
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              // Content & Syntax Highlighting
              if (
                id.includes('react-syntax-highlighter') ||
                id.includes('prismjs') ||
                id.includes('lowlight') ||
                id.includes('react-markdown') ||
                id.includes('remark') ||
                id.includes('micromark')
              ) {
                return 'vendor-content';
              }
              // AI Orchestration
              if (id.includes('@google/genai')) {
                return 'vendor-ai';
              }
            }
          }
        }
      }
    }
  };
});
