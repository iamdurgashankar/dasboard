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
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false
        }
      }
    },
    plugins: [react()],
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
