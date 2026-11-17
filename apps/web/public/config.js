/* global window */
// Development default only. In the container this file is overwritten at start-up by
// nginx/30-runtime-config.sh from PUBLIC_API_URL / PUBLIC_URL (F-FE-12).
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {
  apiUrl: "http://localhost:3000",
  publicUrl: "http://localhost:5173",
};
