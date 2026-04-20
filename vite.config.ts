import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 5173,
    headers: {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Sobe o limite de aviso; os chunks abaixo ficam todos bem acima do default
    // de 500kb só pelas libs indivisíveis (React, Supabase, Radix). Isso evita
    // falso alarme sem esconder chunks realmente inchados.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Agrupa libs grandes em chunks estáveis — melhora cache entre builds
        // (mudança em código de app não invalida chunk de vendor).
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'query': ['@tanstack/react-query'],
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-toast',
          ],
          'dnd': ['@hello-pangea/dnd'],
          'motion': ['framer-motion', 'motion'],
          'charts': ['recharts'],
          'date': ['date-fns'],
        },
      },
    },
  },
}));
