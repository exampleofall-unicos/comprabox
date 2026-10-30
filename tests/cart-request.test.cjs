const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const dependencies = createRequire(resolve(__dirname, '../apps/quote-service/package.json'));
const { JSDOM } = dependencies('jsdom');
const { Liquid } = dependencies('liquidjs');
const source = readFileSync(resolve(__dirname, '../assets/cart-request.js'), 'utf8');
const key = 'comprabox.cart-request.v1:example.com';
const item = { key: 'variant:properties', title: 'Termo <img src=x onerror=alert(1)>',
  variant: 'Negro', sku: 'TER-NEG', price: 150000, quantity: 1, properties: 'Grabado: Logo', sellingPlan: '' };
const payload = (items) => `<div hidden data-cart-request-data="${JSON.stringify({
  currency: 'ARS', items, note: 'Entregar el lunes',
}).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')}"></div>`;
function browser({ preview = false, items = [item], stored, blocked = false } = {}) {
  const html = `${payload(items)}${preview
    ? '<ul data-cart-request-summary></ul><form id="contact"><textarea data-cart-request-details name="contact[Detalle del pedido]" hidden></textarea><input name="contact[Producto]"><input name="contact[Cantidad]"><input name="contact[email]" type="email" required><button type="submit" disabled>Enviar</button></form>'
    : `<cart-items><form id="cart"><quantity-input><button class="quantity__button" name="minus" type="button">-</button><input id="Quantity-1" type="number" min="1" step="1" value="1" data-cart-request-quantity data-quantity-line-key="${item.key}"><button class="quantity__button" name="plus" type="button">+</button></quantity-input></form></cart-items><span data-cart-request-line-total="${item.key}"></span><button data-cart-request-continue disabled>Revisar</button>`}
    <span data-cart-request-total></span><p data-cart-request-error></p>`;
  const dom = new JSDOM(html, { url: `https://example.com/cart${preview ? '?view=preview-co' : ''}`, runScripts: 'outside-only' });
  if (stored) dom.window.localStorage.setItem(key, JSON.stringify(stored));
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
  assert.equal(JSON.parse(read('templates/cart.preview-co.json')).sections.preview.type, 'cart-preview-co');
  const items = read('sections/main-cart-items.liquid');
  assert.match(items, /data-cart-request-quantity/);
  assert.doesNotMatch(items, /name="updates\[\]"|\bmax="|quantity_rule/);
  assert.doesNotMatch(read('sections/main-cart-footer.liquid'), /name="checkout"|content_for_additional_checkout_buttons/);
});
