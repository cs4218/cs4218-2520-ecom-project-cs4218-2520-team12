const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API || 'http://localhost:6060',
      changeOrigin: true,
      pathRewrite: (path) => `/api${path}`,
    })
  );
};
