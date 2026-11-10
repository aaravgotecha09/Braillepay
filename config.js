/*
 * Runtime configuration for the static frontend (Vercel).
 * Public values only — NEVER put secrets, keys or passwords in this file: it is served to every visitor.
 *
 * Production builds talk to the Render backend. Local development (localhost) talks to a backend
 * running on port 8000 (see docs/DEPLOYMENT.md).
 */
(function () {
  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1';
  window.BRAILLEPAY_ENV = isLocal ? 'development' : 'production';
  window.BRAILLEPAY_API_BASE_URL = isLocal ? 'http://localhost:8000' : 'https://braillepay.onrender.com';
})();
