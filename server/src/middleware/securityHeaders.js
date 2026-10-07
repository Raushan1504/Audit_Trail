/**
 * Day 26: Security Headers & CORS Hardening Middleware
 * Person 2 (Backend): Raushan Kumar <rashukumar1504@gmail.com>
 *
 * Enforces production HTTP headers (CSP, HSTS, frameguard, sniff protection)
 * and restricts allowed methods and headers for hardened enterprise runtime.
 */

function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Handle CORS preflight explicitly with hardened headers
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-None-Match');
    return res.status(204).end();
  }

  next();
}

module.exports = {
  securityHeadersMiddleware
};
