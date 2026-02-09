#!/bin/sh
set -e
# Gera config.js a partir das variáveis de ambiente (Easypanel > Ambiente)
CONFIG_JS="/usr/share/nginx/html/config.js"
if [ -n "$VITE_SUPABASE_URL" ] && [ -n "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "window.__ENV__ = { \"VITE_SUPABASE_URL\": \"$VITE_SUPABASE_URL\", \"VITE_SUPABASE_PUBLISHABLE_KEY\": \"$VITE_SUPABASE_PUBLISHABLE_KEY\", \"VITE_SUPABASE_PROJECT_ID\": \"${VITE_SUPABASE_PROJECT_ID:-}\" };" > "$CONFIG_JS"
  # Injeta <script src="/config.js"></script> antes de </head> no index.html
  sed -i 's|</head>|<script src="/config.js"></script></head>|' /usr/share/nginx/html/index.html
fi
exec nginx -g "daemon off;"
