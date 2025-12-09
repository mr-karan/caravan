import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import { viteStaticCopy } from "vite-plugin-static-copy";

// Use environment variable for backend port, defaulting to 4466
const backendPort = process.env.CARAVAN_PORT || '4466';
const backendTarget = `http://localhost:${backendPort}`;

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  envPrefix: 'REACT_APP_',
  base: process.env.PUBLIC_URL,
  // Explicitly set appType to SPA to ensure fallback to index.html for client-side routing
  appType: 'spa',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for exec
      },
      '/plugins': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/config': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/auth': {
        target: backendTarget,
        changeOrigin: true,
      },
      // Note: /oidc/callback is handled by frontend React Router, not backend
      // Only proxy actual OIDC API calls if we add them later
      '/wsMultiplexer': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      '/externalproxy': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/drain-node': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/drain-node-status': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/parseKubeConfig': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/metrics': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
    cors: true,
  },
  plugins: [
    svgr({
      svgrOptions: {
        prettier: false,
        svgo: false,
        svgoConfig: {
          plugins: [{ removeViewBox: false }],
        },
        titleProp: true,
        ref: true,
      },
    }),
    react(),
    nodePolyfills({
      include: ['process', 'buffer', 'stream'],
    }),
    // Make sure we copy the minified monaco-editor source into the static folder
    // since it's loaded dynamically and not bundled via ESM. We do it this way
    // to support setting the localization language
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/monaco-editor/min/vs",
          dest: "assets", // copies to assets/vs
        },
      ],
    }),
  ],
  build: {
    outDir: 'build',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      // Exclude @axe-core from production bundle
      external: ['@axe-core/react'],
      output: {
        manualChunks(id: string) {
          // Build smaller chunks for heavy dependencies - lazy loaded
          if (id.includes('node_modules')) {
            // Monaco editor - very large, lazy load
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
              return 'vendor-monaco';
            }

            // Lodash - tree-shaken but still chunked separately
            if (id.includes('lodash')) {
              return 'vendor-lodash';
            }

            // MUI - core UI framework
            if (id.includes('@mui/material')) {
              return 'vendor-mui';
            }

            // XTerm - lazy loaded for log viewer
            if (id.includes('xterm')) {
              return 'vendor-xterm';
            }

            // Recharts - lazy loaded for charts
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }

            // React Query - commonly used
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-react-query';
            }
          }
        },
      },
    },
    // Enable better minification
    minify: 'esbuild',
    target: 'esnext',
  },
});
