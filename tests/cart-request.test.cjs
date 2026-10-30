const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const dependencies = createRequire(resolve(__dirname, '../apps/quote-service/package.json'));
const { JSDOM } = dependencies('jsdom');
const { Liquid } = dependencies('liquidjs');
const rowTemplate = new Liquid().parseAndRenderSync(readFileSync(resolve(__dirname, '../snippets/cart-request-product-row.liquid'), 'utf8'));
const source = readFileSync(resolve(__dirname, '../assets/cart-request.js'), 'utf8');
const key = 'comprabox.cart-request.v1:example.com';
const item = { key: 'variant:properties', title: 'Termo <img src=x onerror=alert(1)>',
  variant: 'Negro', sku: 'TER-NEG', price: 150000, quantity: 1, properties: 'Grabado: Logo', sellingPlan: '' };
const payload = (items) => `<div hidden data-cart-request-data="${JSON.stringify({
  currency: 'ARS', items, note: 'Entregar el lunes',
}).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')}"></div>`;
function browser({ preview = false, items = [item], stored, products, blocked = false } = {}) {
  const html = `${payload(items)}${preview
    ? '<ul data-cart-request-summary></ul><form id="contact"><textarea data-cart-request-details name="contact[Detalle del pedido]" hidden></textarea><input name="contact[Producto]"><input name="contact[Cantidad]"><input name="contact[email]" type="email" required><button type="submit" disabled>Enviar</button></form>'
    : `<cart-items class="${items.length ? '' : 'is-empty'}"><form id="cart"><table class="cart-items"><tbody>${items.length ? `<tr><td><quantity-input><button class="quantity__button" name="minus" type="button">-</button><input id="Quantity-1" type="number" min="1" step="1" value="1" data-cart-request-quantity data-quantity-line-key="${item.key}"><button class="quantity__button" name="plus" type="button">+</button></quantity-input></td></tr>` : ''}</tbody><tbody data-cart-request-product-rows></tbody></table>${rowTemplate}</form></cart-items><span data-cart-request-line-total="${item.key}"></span><div id="main-cart-footer" class="${items.length ? '' : 'is-empty'}"><button data-cart-request-continue form="cart" disabled>Revisar</button></div>`}
    <span data-cart-request-total></span><p data-cart-request-error></p>`;
  const dom = new JSDOM(html, { url: `https://example.com/cart${preview ? '?view=preview-co' : ''}`, runScripts: 'outside-only' });
  if (stored) dom.window.localStorage.setItem(key, JSON.stringify(stored));
  if (products) dom.window.localStorage.setItem(`${key}:products`, JSON.stringify(products));
  if (blocked) dom.window.Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  dom.window.fetch = () => assert.fail('Quantities must not reach Shopify inventory endpoints');
  // Use Dawn's actual quantity control and a cart listener to catch accidental propagation.
  dom.window.subscribe = () => () => {};
  dom.window.PUB_SUB_EVENTS = { quantityUpdate: 'quantity-update' };
  dom.window.eval(readFileSync(resolve(__dirname, '../assets/global.js'), 'utf8').split('class QuantityInput')[1]
    .split('function debounce')[0].replace(/^/, 'class QuantityInput'));
  if (!preview) dom.window.document.querySelector('cart-items').addEventListener('change', () => assert.fail('Dawn cart handler received a quote quantity'));
  dom.window.eval(source);
  const close = dom.window.close.bind(dom.window);
  dom.window.close = () => { dom.window.dispatchEvent(new dom.window.Event('pagehide')); close(); };
  return dom;
}
test('typing above inventory and Dawn plus/minus persist synchronously without cart API calls', () => {
  const dom = browser();
  try {
    const doc = dom.window.document, input = doc.querySelector('input');
    input.value = '50000';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(JSON.parse(dom.window.localStorage.getItem(key))[item.key], 50000);
    doc.querySelector('[name="plus"]').click();
    assert.equal(input.value, '50001');
    doc.querySelector('[name="minus"]').click();
    assert.equal(input.value, '50000');
    assert.match(doc.querySelector('[data-cart-request-total]').textContent, /75/);
    assert.equal(doc.querySelector('[data-cart-request-continue]').disabled, false);
    for (const value of ['', '0', '-1', '1.5', '9007199254740992']) {
      input.value = value;
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      assert.equal(input.checkValidity(), false, value);
      assert.equal(JSON.parse(dom.window.localStorage.getItem(key))[item.key], 50000);
    }
  } finally { dom.window.close(); }
});
test('reload and preview restore quantities, retain variant details, and safely populate the contact payload', () => {
  for (const preview of [false, true]) {
    const dom = browser({ preview, stored: { [item.key]: 1250, removed: 99 } });
    try {
      const doc = dom.window.document;
      assert.equal(JSON.parse(dom.window.localStorage.getItem(key)).removed, undefined);
      if (!preview) assert.equal(doc.querySelector('input').value, '1250');
      else {
        assert.match(doc.querySelector('[data-cart-request-summary]').textContent, /1250 unidades/);
        assert.equal(doc.querySelectorAll('img').length, 0);
        const form = doc.querySelector('form'), fields = new dom.window.FormData(form);
        assert.equal(fields.get('contact[Cantidad]'), '1250');
        assert.match(fields.get('contact[Detalle del pedido]'), /SKU: TER-NEG.*Grabado: Logo.*Cantidad solicitada: 1250/);
        assert.match(fields.get('contact[Detalle del pedido]'), /Entregar el lunes/);
        assert.equal(form.querySelector('button').disabled, false);
        assert.equal(form.checkValidity(), false); // Existing contact validation remains active.
      }
    } finally { dom.window.close(); }
  }
});
test('Shopify section replacement prunes removed lines and restores remaining quantities', async () => {
  const dom = browser({ stored: { [item.key]: 400 } });
  try {
    dom.window.document.querySelector('[data-cart-request-data]').outerHTML = payload([]);
    await new Promise((done) => setImmediate(done));
    assert.deepEqual(JSON.parse(dom.window.localStorage.getItem(key)), {});
    assert.equal(dom.window.document.querySelector('[data-cart-request-continue]').disabled, true);
  } finally { dom.window.close(); }
});
test('empty preview and unavailable browser storage block sending incomplete requests', () => {
  for (const options of [{ preview: true, items: [] }, { preview: true, blocked: true }]) {
    const dom = browser(options);
    try {
      const doc = dom.window.document, form = doc.querySelector('form');
      const submit = new dom.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submit);
      assert.equal(submit.defaultPrevented, true);
      if (options.blocked) assert.match(doc.querySelector('[data-cart-request-error]').textContent, /almacenamiento/);
      else assert.equal(form.querySelector('button').disabled, true);
    } finally { dom.window.close(); }
  }
});
test('Liquid request data remains valid JSON even with script-like product names and custom properties', async () => {
  const engine = new Liquid();
  engine.registerFilter('json', (value) => JSON.stringify(value ?? null));
  const html = await engine.parseAndRender(readFileSync(resolve(__dirname, '../snippets/cart-request-data.liquid'), 'utf8'), {
    shop: { currency: 'ARS' }, cart: { currency: { iso_code: 'ARS' }, items: [{
      key: '123:abc', product: { title: '</script><img src=x>' }, variant: { title: 'Negro' },
      sku: 'SKU', quantity: 1, original_price: 100, properties: { Grabado: '</script>', _hidden: 'secret' },
    }] },
  });
  const dom = new JSDOM(html);
  const data = JSON.parse(dom.window.document.querySelector('[data-cart-request-data]').dataset.cartRequestData);
  assert.equal(data.items[0].title, '</script><img src=x>');
  assert.equal(data.items[0].properties, 'Grabado: </script>;');
  assert.equal(dom.window.document.querySelectorAll('img').length, 0);
  dom.window.close();
});
test('theme wiring uses the cart preview and shares contact settings without duplicate form markup', () => {
  const read = (path) => readFileSync(resolve(__dirname, '..', path), 'utf8');
  const schema = (path) => JSON.parse(read(path).split('{% schema %}')[1].split('{% endschema %}')[0]);
  assert.deepEqual(schema('sections/cart-preview-co.liquid').settings, schema('sections/contact-form.liquid').settings);
  assert.match(read('sections/contact-form.liquid'), /render 'contact-quote-content'/);
  assert.match(read('sections/cart-preview-co.liquid'), /cart_preview: true/);
  assert.equal(JSON.parse(read('templates/cart.preview-co.json').replace(/^\/\*[\s\S]*?\*\//, '')).sections.preview.type, 'cart-preview-co');
  const items = read('sections/main-cart-items.liquid');
  assert.match(items, /data-cart-request-quantity/);
  assert.doesNotMatch(items, /name="updates\[\]"|\bmax="|quantity_rule/);
  assert.doesNotMatch(read('sections/main-cart-footer.liquid'), /name="checkout"|content_for_additional_checkout_buttons/);
});
test('preview combines a stock-independent product selection with the native cart and supports removal', () => {
  const product = { ...item, key: 'product:123', variantId: '123', quantity: 9000, currency: 'ARS', url: '/products/termo?view=co&variant=123' };
  for (const items of [[], [item]]) {
    const dom = browser({ preview: true, items, products: [product] });
    try {
      const doc = dom.window.document;
      assert.match(doc.querySelector('[data-cart-request-summary]').textContent, /9000 unidades/);
      assert.equal(doc.querySelector('form button').disabled, false);
      assert.equal(doc.querySelector('a').getAttribute('href'), 'https://example.com/products/termo?view=co&variant=123');
      const details = doc.querySelector('[data-cart-request-details]').value;
      assert.match(details, /Cantidad solicitada: 9000/);
      doc.querySelector('[data-remove-product-request]').click();
      assert.equal(JSON.parse(dom.window.localStorage.getItem(`${key}:products`)).length, 0);
      assert.equal(doc.querySelectorAll('[data-cart-request-summary] li').length, items.length);
      assert.equal(doc.querySelector('form button').disabled, items.length === 0);
    } finally { dom.window.close(); }
  }
});
test('CO products appear in main cart when Shopify is empty, support quantity edits, and persist into preview', () => {
  const product = { ...item, key: 'product:123', variantId: '123', quantity: 9000, currency: 'ARS', url: '/products/termo?view=co&variant=123' };
  for (const items of [[], [item]]) {
    const dom = browser({ items, products: [product] });
    try {
      const doc = dom.window.document;
      const row = doc.querySelector('[data-cart-request-product-rows] tr');
      assert.match(row.textContent, /TER-NEG/);
      assert.equal(row.querySelector('[data-request-title]').textContent, product.title);
      assert.equal(doc.querySelectorAll('img:not([hidden])').length, 0); // Older selections work without images.
      assert.equal(doc.querySelector('cart-items').classList.contains('is-empty'), false);
      assert.equal(doc.querySelector('#main-cart-footer').classList.contains('is-empty'), false);
      const input = row.querySelector('input');
      assert.equal(input.value, '9000');
      row.querySelector('[name="plus"]').click();
      assert.equal(input.value, '9001');
      input.focus();
      input.value = '12000';
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      assert.equal(doc.activeElement, input);
      assert.equal(doc.querySelector('[data-cart-request-product-rows] input'), input); // No replacement while typing.
      const storedProducts = JSON.parse(dom.window.localStorage.getItem(`${key}:products`));
      assert.equal(storedProducts[0].quantity, 12000);
      const preview = browser({ preview: true, items, products: storedProducts });
      try {
        assert.match(preview.window.document.querySelector('[data-cart-request-details]').value, /Cantidad solicitada: 12000/);
      } finally { preview.window.close(); }
      row.querySelector('[data-remove-product-request]').click();
      assert.equal(doc.querySelectorAll('[data-cart-request-product-rows] tr').length, 0);
      assert.equal(doc.querySelector('cart-items').classList.contains('is-empty'), items.length === 0);
      assert.equal(doc.querySelector('[data-cart-request-continue]').disabled, items.length === 0);
    } finally { dom.window.close(); }
  }
});
