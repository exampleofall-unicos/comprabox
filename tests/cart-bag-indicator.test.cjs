const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const dependencies = createRequire(resolve(__dirname, '../apps/quote-service/package.json'));
const { JSDOM } = dependencies('jsdom');
const script = readFileSync(resolve(__dirname, '../assets/cart-bag-indicator.js'), 'utf8');
const storageKey = 'comprabox.cart-request.v1:example.com:products';
const icon = (count) => `<a id="cart-icon-bubble" class="header__icon"><span class="cart-bag-dot" data-cart-bag-dot data-native-cart-count="${count}" hidden></span><span data-cart-bag-status></span></a>`;
function browser(count = 0, products = []) {
  const dom = new JSDOM(icon(count), { url: 'https://example.com/', runScripts: 'outside-only' });
  dom.window.localStorage.setItem(storageKey, JSON.stringify(products));
  dom.window.PUB_SUB_EVENTS = { cartUpdate: 'cart-update' };
  let nativeUpdate;
  dom.window.subscribe = (_, callback) => { nativeUpdate = callback; };
  dom.window.eval(script);
  const dot = () => dom.window.document.querySelector('[data-cart-bag-dot]');
  const close = () => {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  };
  return { dom, dot, close, nativeUpdate: (data) => nativeUpdate(data) };
}
test('bag notification recognizes both Shopify products and locally saved stock-independent products', () => {
  for (const [count, products, visible] of [[0, [], false], [2, [], true], [0, [{ key: 'product:123', quantity: 5000 }], true]]) {
    const { dom, dot, close } = browser(count, products);
    try {
      assert.equal(dot().hidden, !visible);
      assert.equal(dom.window.document.querySelector('[data-cart-bag-status]').textContent, visible ? 'Hay productos en tu carrito' : '');
    } finally { close(); }
  }
});
test('bag follows main cart changes and native AJAX cart updates', () => {
  const { dom, dot, close, nativeUpdate } = browser();
  try {
    dom.window.document.dispatchEvent(new dom.window.CustomEvent('comprabox:cart-change', { detail: { hasItems: true } }));
    assert.equal(dot().hidden, false);
    dom.window.document.dispatchEvent(new dom.window.CustomEvent('comprabox:cart-change', { detail: { hasItems: false } }));
    assert.equal(dot().hidden, true);
    nativeUpdate({ cartData: { item_count: 2 } });
    assert.equal(dot().hidden, false);
    nativeUpdate({ cartData: { item_count: 0 } });
    assert.equal(dot().hidden, true);
  } finally { close(); }
});
test('notification survives header replacement and clears after removing products in another tab', async () => {
  const { dom, dot, close } = browser(0, [{ key: 'product:123', quantity: 5000 }]);
  try {
    dom.window.document.querySelector('#cart-icon-bubble').outerHTML = icon(0);
    await new Promise((done) => setImmediate(done));
    assert.equal(dot().hidden, false);
    dom.window.localStorage.removeItem(storageKey);
    dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: storageKey }));
    assert.equal(dot().hidden, true);
  } finally { close(); }
});
test('bag dot retains equal fixed dimensions despite the header span height rule', () => {
  const themeCss = readFileSync(resolve(__dirname, '../assets/base.css'), 'utf8');
  const spanRules = [...themeCss.matchAll(/\.header__icon span\s*\{[^}]*\}/g)].map((match) => match[0]).join('\n');
  const indicatorCss = readFileSync(resolve(__dirname, '../assets/cart-bag-indicator.css'), 'utf8');
  for (const css of [spanRules + indicatorCss, indicatorCss + spanRules]) {
    const { dom, dot, close } = browser(1);
    try {
      const style = dom.window.document.createElement('style');
      style.textContent = css;
      dom.window.document.head.append(style);
      const computed = dom.window.getComputedStyle(dot());
      assert.equal(computed.height, computed.width);
      assert.notEqual(computed.height, '100%');
      assert.equal(computed.borderRadius, '50%');
    } finally { close(); }
  }
});
