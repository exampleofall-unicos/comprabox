const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const dependencies = createRequire(resolve(__dirname, '../apps/quote-service/package.json'));
const { JSDOM, VirtualConsole } = dependencies('jsdom');
const read = (path) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const product = { key: 'product:123', variantId: '123', title: 'Termo', variant: 'Negro', price: 150000,
  currency: 'ARS', quantity: 1, sku: 'NEG', url: '/products/termo', available: false };
const escaped = (value) => JSON.stringify(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const fixture = (item = product) => `<product-info-co id="MainProduct-co" data-section="co" data-url="/products/termo" data-update-url="true">
  <div hidden data-product-request-data="${escaped(item)}"></div>
  <variant-selects><script data-selected-variant type="application/json">${JSON.stringify(item ? { id: item.variantId, available: false } : null)}</script></variant-selects>
  <div class="product-form__quantity"><quantity-input>
    <button type="button" class="quantity__button" name="minus">-</button>
    <input class="quantity__input" name="quantity" type="number" min="1" step="1" value="1" required form="product-form-co">
    <button type="button" class="quantity__button" name="plus">+</button>
  </quantity-input></div>
  <form id="product-form-co" data-product-request-form data-cart-url="/es/cart">
    <input name="id" type="hidden" value="${item?.variantId || ''}">
    <button data-product-request-button name="add" type="submit" value="save" disabled>Agregar</button>
    <button data-product-request-button name="review" type="submit" value="review" disabled>Revisar</button>
    <p data-product-request-status></p>
  </form>
</product-info-co>`;
function browser({ stored, blocked = false } = {}) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => { throw error; });
  const dom = new JSDOM(fixture(), { url: 'https://example.com/products/termo?view=co&preview_theme_id=99', runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  window.subscribe = () => () => {};
  window.publish = () => {};
  window.PUB_SUB_EVENTS = { optionValueSelectionChange: 'option', variantChange: 'variant' };
  window.variantStrings = { soldOut: 'Agotado', unavailable: 'No disponible' };
  window.HTMLUpdateUtility = { viewTransition: (old, next) => old.replaceWith(window.document.importNode(next, true)) };
  window.customElements.define('variant-selects', class extends window.HTMLElement {
    resolvePendingSelectPromise() {}
  });
  window.fetch = () => assert.fail('Stock endpoints must never receive requested quantities');
  if (stored) window.localStorage.setItem('comprabox.cart-request.v1:example.com:products', JSON.stringify(stored));
  if (blocked) window.Storage.prototype.setItem = () => { throw new Error('Blocked'); };
  window.eval(read('assets/global.js').split('class QuantityInput')[1].split('function debounce')[0].replace(/^/, 'class QuantityInput'));
  window.eval(read('assets/product-info.js'));
  window.eval(read('assets/product-request-co.js'));
  const section = window.document.querySelector('product-info-co');
  section.navigateToPreview = (url) => { window.previewTarget = url; };
  return { dom, section, window, doc: window.document };
}
test('zero-stock product accepts large quantities, plus/minus, and sends the selection to preview', () => {
  const { dom, section, window, doc } = browser();
  try {
    const input = section.quantityInput;
    input.value = '30000';
    doc.querySelector('[name="plus"]').click();
    assert.equal(input.value, '30001');
    doc.querySelector('[name="minus"]').click();
    doc.querySelector('[name="review"]').click();
    const saved = JSON.parse(window.localStorage.getItem('comprabox.cart-request.v1:example.com:products'));
    assert.equal(saved[0].quantity, 30000);
    assert.equal(saved[0].variantId, '123');
    assert.equal(window.previewTarget, 'https://example.com/es/cart?view=preview-co&preview_theme_id=99');
    assert.equal(input.hasAttribute('max'), false);
  } finally { dom.window.close(); }
});
test('Dawn variant updates retain the typed quantity and quote the new stock-zero variant', () => {
  const { dom, section, window, doc } = browser();
  try {
    section.quantityInput.value = '850';
    const next = { ...product, key: 'product:456', variantId: '456', variant: 'Azul', sku: 'AZU' };
    const html = new window.DOMParser().parseFromString(fixture(next), 'text/html');
    section.resetProductFormState();
    assert.equal(doc.querySelector('[name="review"]').disabled, true);
    section.handleUpdateProductInfo('/products/termo')(html);
    assert.equal(section.quantityInput.value, '850');
    doc.querySelector('[name="add"]').click();
    const saved = JSON.parse(window.localStorage.getItem('comprabox.cart-request.v1:example.com:products'))[0];
    assert.equal(saved.variantId, '456');
    assert.equal(saved.quantity, 850);
    assert.equal(saved.sku, 'AZU');
    assert.equal(window.previewTarget, 'https://example.com/es/cart?preview_theme_id=99');
    const requestUrl = new URL(section.buildRequestUrlWithParams('/products/termo', ['12']));
    assert.equal(requestUrl.searchParams.get('view'), 'co');
    assert.equal(requestUrl.searchParams.get('preview_theme_id'), '99');
    assert.equal(requestUrl.searchParams.get('option_values'), '12');
    section.handleUpdateProductInfo('/products/termo')(new window.DOMParser().parseFromString(fixture(null), 'text/html'));
    assert.equal(doc.querySelector('[name="review"]').disabled, true);
  } finally { dom.window.close(); }
});
test('editing a saved quantity replaces it, invalid input recovers, and storage failures prevent navigation', () => {
  for (const blocked of [false, true]) {
    const { dom, section, window, doc } = browser({ stored: [{ ...product, quantity: 900 }], blocked });
    try {
      assert.equal(section.quantityInput.value, '900');
      section.quantityInput.value = '1.5';
      section.quantityInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      assert.equal(section.quantityInput.checkValidity(), false);
      section.quantityInput.value = '2000';
      section.quantityInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      doc.querySelector('[name="review"]').click();
      if (blocked) {
        assert.equal(window.previewTarget, undefined);
        assert.match(doc.querySelector('[data-product-request-status]').textContent, /almacenamiento/);
      } else {
        const saved = JSON.parse(window.localStorage.getItem('comprabox.cart-request.v1:example.com:products'));
        assert.equal(saved.length, 1);
        assert.equal(saved[0].quantity, 2000);
      }
    } finally { dom.window.close(); }
  }
});
test('CO section and template preserve merchant settings and blocks from the original product', () => {
  const schema = (name) => JSON.parse(read(`sections/${name}.liquid`).split('{% schema %}')[1].split('{% endschema %}')[0]);
  const original = schema('main-product'), copy = schema('main-product-co');
  assert.deepEqual(copy.settings, original.settings);
  assert.deepEqual(copy.blocks, original.blocks);
  const originalTemplate = JSON.parse(read('templates/product.json').replace(/^\/\*[\s\S]*?\*\//, ''));
  const copiedTemplate = JSON.parse(read('templates/product.co.json'));
  originalTemplate.sections.main.type = 'main-product-co';
  assert.deepEqual(copiedTemplate, originalTemplate);
  assert.doesNotMatch(read('snippets/product-request-quantity.liquid'), /\bmax=|quantity_rule/);
  assert.doesNotMatch(read('snippets/product-request-buttons.liquid'), /payment_button|\.available|inventory_quantity/);
});
