
const crypto = require('crypto');

function computeETag(body) {
  return crypto.createHash('md5').update(body).digest('hex');
}

function cacheControlMiddleware(req, res, next) {
  const path = req.path || '';

  if (req.method === 'GET' && path.includes('/events')) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=120');

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const stringified = JSON.stringify(body);
      const etag = `"${computeETag(stringified)}"`;
      res.setHeader('ETag', etag);

      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      return originalJson(body);
    };
    return next();
  }

  if (req.method === 'GET' && (path.includes('/queries') || path.includes('/telemetry'))) {
    res.setHeader('Cache-Control', 'public, max-age=5, must-revalidate');
    return next();
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

module.exports = {
  cacheControlMiddleware,
  computeETag
};
