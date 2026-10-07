/**
 * Day 26: API Rate Limiter Middleware
 * Person 2 (Backend): Raushan Kumar <rashukumar1504@gmail.com>
 *
 * Implements a memory-efficient sliding-window rate limiter protecting API
 * endpoints from burst floods with standard RFC 6585 headers.
 */

function createRateLimiter({
  windowMs = 60 * 1000, // 1 minute
  maxRequests = 120,    // 120 requests per window
  message = 'Too many requests, please try again later.'
} = {}) {
  const requestLogs = new Map();

  return function rateLimiter(req, res, next) {
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = requestLogs.get(ip) || [];
    timestamps = timestamps.filter((time) => time > windowStart);

    const remaining = Math.max(0, maxRequests - timestamps.length - 1);
    const resetTimeSeconds = Math.ceil(windowMs / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

    if (timestamps.length >= maxRequests) {
      res.setHeader('Retry-After', resetTimeSeconds);
      return res.status(429).json({
        success: false,
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message
      });
    }

    timestamps.push(now);
    requestLogs.set(ip, timestamps);
    next();
  };
}

module.exports = {
  createRateLimiter
};
