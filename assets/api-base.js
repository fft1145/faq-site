/**
 * API 地址适配
 *
 * GitHub Pages 只能托管静态页面，接口由独立的 API 服务提供。
 * 页面中所有 fetch('/api/...') 会自动改写为 FFT_API_BASE + '/api/...'。
 *
 * 后端部署完成后，把 DEFAULT_API_BASE 改成自己的 Worker 地址即可。
 */
(function () {
  // 过渡期回退到旧 Netlify 接口，保证迁移期间评论/登录仍可用
  var DEFAULT_API_BASE = 'https://fgame-faq26.netlify.app';
  var BASE = String(window.FFT_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');

  if (!BASE) return;

  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.indexOf('/api/') === 0) {
      input = BASE + input;
    }
    return originalFetch.call(this, input, init);
  };

  window.FFT_API_BASE = BASE;
})();
