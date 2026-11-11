const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const dependencies = createRequire(resolve(__dirname, '../apps/quote-service/package.json'));
const { JSDOM, VirtualConsole } = dependencies('jsdom');
const { Liquid } = dependencies('liquidjs');
const read = (path) => readFileSync(resolve(__dirname, '..', path), 'utf8');

async function verifyQuoteCards({ featured = false } = {}) {
  const routes = { cart_url: '/es/cart' };
  const liquid = new Liquid({
    root: resolve(__dirname, '../snippets'), extname: '.liquid',
    globals: { cart: { currency: { iso_code: 'USD' } }, routes },
  });
  liquid.registerFilter('money_with_currency', (cents) => `USD ${cents / 100}`);
  liquid.registerFilter('metafield_text', (field) => field.value);
  liquid.registerFilter('image_url', (image) => image.url);
  liquid.registerFilter('image_tag', (url, ...args) => {
    const className = args.find(([key]) => key === 'class')?.[1] ?? '';
    return `<img src="${url}" class="${className}">`;
  });
  liquid.registerFilter('inline_asset_content', () => '<svg></svg>');
  liquid.registerFilter('asset_url', (name) => `/assets/${name}`);

  const variant = { id: '123', title: 'Negro', sku: 'TER-NGR', price: 630 };
  const images = [{ url: '/first.png' }, { url: '/second.png' }];
  const product = {
    title: 'Termo', url: '/products/termo', available: false, images,
    featured_image: images[0], selected_or_first_available_variant: variant,
    metafields: { custom: {
      capacidad: { value: '1000 ML' }, unidades_por_caja: { value: 35 },
      precio_usd: { value: 10 }, cargo_1_4_bulto: { value: 1.2 }, cargo_1_2_bulto: { value: 0.5 },
    } },
  };
  let markup;
  if (featured) {
    const template = read('sections/featured-collection.liquid').split('{% schema %}')[0]
      .replace(/{%-?\s*style\s*-?%}/g, '<style>')
      .replace(/{%-?\s*endstyle\s*-?%}/g, '</style>')
      .replace(/{%-?\s*(?:paginate [^%]+|endpaginate)\s*-?%}/g, '');
    markup = await liquid.parseAndRender(template, {
      routes,
      section: { id: 'featured', settings: {
        collection: { url: '/es/collections/all', title: 'Catálogo', all_products_count: 3, products: [product, product] },
        products_to_show: 2, columns_desktop: 2, columns_mobile: '1', swipe_on_mobile: true,
        quick_add: 'bulk', show_view_all: true,
      } },
    });
  } else {
    const card = await liquid.renderFile('collection-grid2-card', {
      product,
      section: { id: 'grid', settings: { box_metafield: 'custom.unidades_por_caja', capacity_metafield: 'custom.capacidad' } },
    });
    const dialog = await liquid.renderFile('collection-grid2-quantity', { section_id: 'grid', routes });
    markup = `<collection-grid-quote>
      <form data-cg2-filters method="get" action="/es/collections/all"></form>
      ${card}${dialog}
    </collection-grid-quote>`;
  }
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => { throw error; });
  const url = featured ? 'https://example.com/?preview_theme_id=99' : 'https://example.com/es/collections/all?preview_theme_id=99';
  const dom = new JSDOM(markup, { url, runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  try {
    const { document } = window;
    const find = (selector) => document.querySelector(selector);
    const label = (selector) => find(selector).textContent.replace(/\s+/g, ' ').trim();
    const filters = find('[data-cg2-filters]');
    const modal = find('dialog');
    const input = find('[name="quantity"]');
    const cartLink = find('.cg2-cart-link');
    // jsdom lacks modal behavior. Use the open attribute for the catalog's update and close paths.
    modal.showModal = () => { modal.open = true; };
    modal.close = () => { modal.open = false; };
    window.subscribe = () => () => {};
    window.PUB_SUB_EVENTS = { quantityUpdate: 'quantity-update' };
    window.fetch = async (url) => {
      assert.equal(url, 'https://api.bluelytics.com.ar/v2/latest');
      return { ok: true, json: async () => ({ blue: { value_sell: 1550 } }) };
    };
    const quantitySource = read('assets/global.js').split('class QuantityInput')[1].split('function debounce')[0];
    window.eval(`class QuantityInput${quantitySource}`);
    ['quote-pricing', 'quote-request-store', 'collection-grid2'].forEach((asset) => window.eval(read(`assets/${asset}.js`)));
    await window.compraboxQuotePricing.getRate();

    assert.equal(label('.cg2-sku'), 'SKU: TER-NGR');
    assert.equal(label('.cg2-capacity'), '1000 ML');
    assert.equal(label('[data-cg2-card-price]'), '$ 9.765,00');
    assert.equal(find('.cg2-secondary-image').getAttribute('src'), '/second.png');
    assert.equal(cartLink.href, 'https://example.com/es/cart?preview_theme_id=99');
    if (featured) {
      assert.equal(filters, null);
      assert.equal(document.querySelectorAll('slider-component .cg2-card').length, 2);
      assert.ok(find('slider-component .slider--tablet'));
      assert.ok(find('slider-component .featured-collection__track[data-slider-fit]'));
      assert.equal(find('slider-component .grid--peek'), null);
      assert.equal(find('.collection__view-all a').getAttribute('href'), '/es/collections/all');
      assert.ok(find('script[src="/assets/collection-grid2.js"]'));
      assert.equal(find('script[src="/assets/quick-add-bulk.js"]'), null);
    } else {
      assert.equal(filters.action, 'https://example.com/es/collections/all');
      assert.equal(filters.elements.preview_theme_id.value, '99');
    }

    const [add, box] = document.querySelectorAll('[data-cg2-open]');
    for (const button of [add, box]) {
      button.click();
      assert.equal(modal.open, true);
      assert.equal(button.getAttribute('aria-controls'), modal.id);
      assert.equal(input.value, '35');
      assert.equal(label('[data-cg2-unit]'), 'Desde $ 9.765,00');
      find('[data-cg2-close]').click();
    }
    box.click();
    find('[name="minus"]').click();
    assert.equal(input.value, '34');
    assert.equal(label('[data-cg2-unit]'), 'Desde $ 10.540,00');
    for (const [units, price] of [[3, '11.625,00'], [17, '11.625,00'], [18, '10.540,00'], [35, '9.765,00']]) {
      input.value = units;
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      assert.equal(label('[data-cg2-unit]'), `Desde $ ${price}`);
    }
    input.value = '2';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(input.value, '3');
    input.value = '3.5';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(find('[data-cg2-submit]').disabled, true);
    input.value = '18';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    cartLink.href = '#cart';
    find('[data-cg2-submit]').click();
    assert.equal(window.location.hash, '#cart');
    const key = 'comprabox.cart-request.v1:example.com:products';
    const [saved] = JSON.parse(window.localStorage.getItem(key));
    assert.equal(saved.key, 'product:123');
    assert.equal(saved.quantity, 18);
    assert.equal(saved.exchangeRate, 1550);
    assert.equal(saved.url, '/products/termo?view=co&variant=123');
    assert.equal(window.compraboxQuotePricing.calculate(saved, saved.quantity, saved.exchangeRate).unitPrice, 1054000);
  } finally {
    window.close();
  }
}

test('catalog cards quote the full box, share quantity tiers, and save to the request cart', () => verifyQuoteCards());
test('featured collection uses catalog cards, keeps its carousel, and saves to the request cart', () =>
  verifyQuoteCards({ featured: true }));

test('fitted carousel counts complete columns and reaches the last product', () => {
  const slides = Array.from({ length: 8 }, (_, index) => `<li id="Slide-featured-${index}"></li>`).join('');
  const { window } = new JSDOM(`<slider-component>
    <ul id="Slider-featured" data-slider-fit>${slides}</ul>
    <button name="previous"></button>
    <span class="slider-counter--current"></span>
    <span class="slider-counter--total"></span>
    <button name="next"></button>
  </slider-component>`, { runScripts: 'outside-only' });
  try {
    const { document } = window;
    const component = document.querySelector('slider-component');
    const track = document.querySelector('ul');
    const previous = component.querySelector('[name="previous"]');
    const next = component.querySelector('[name="next"]');
    let slideWidth = 167;
    let viewportWidth = 704;
    const gap = 12;
    Object.defineProperty(track, 'clientWidth', { get: () => viewportWidth });
    track.querySelectorAll('li').forEach((slide, index) => {
      Object.defineProperty(slide, 'clientWidth', { get: () => slideWidth });
      Object.defineProperty(slide, 'offsetLeft', { get: () => index * (slideWidth + gap) });
    });
    track.scrollTo = ({ left }) => {
      track.scrollLeft = left;
      track.dispatchEvent(new window.Event('scroll'));
    };
    window.ResizeObserver = class { observe() {} };
    const source = read('assets/global.js').split('class SliderComponent')[1].split('class SlideshowComponent')[0];
    window.eval(`class SliderComponent${source}`);

    assert.equal(component.slidesPerPage, 4);
    assert.equal(component.totalPages, 5);
    assert.equal(previous.disabled, true);
    for (let index = 0; index < 4; index += 1) next.click();
    assert.equal(component.currentPage, 5);
    assert.equal(next.disabled, true);
    previous.click();
    assert.equal(component.currentPage, 4);
    assert.equal(next.disabled, false);

    viewportWidth = 354;
    slideWidth = 171;
    track.scrollLeft = 0;
    component.initPages();
    assert.equal(component.slidesPerPage, 2);
    assert.equal(component.totalPages, 7);
  } finally {
    window.close();
  }
});

test('catalog renders only the four Search & Discovery filters in order on the current collection', async () => {
  const liquid = new Liquid({ root: resolve(__dirname, '../snippets'), extname: '.liquid' });
  liquid.registerFilter('inline_asset_content', () => '<svg></svg>');
  liquid.registerFilter('t', (key) => key);
  const template = read('sections/main-collection-product-grid2.liquid').split('{% schema %}')[0]
    .replace(/{%-?\s*(?:style|endstyle|paginate [^%]+|endpaginate)\s*-?%}/g, '');
  const facet = (param_name, label, value, active = false, type = 'list') => {
    const option = { param_name, label, value, count: 1, active, url_to_remove: '/collections/termos' };
    return { type, param_name, label, values: [option], active_values: active ? [option] : [] };
  };
  const availability = facet('filter.v.availability', 'En existencia', '1', false, 'boolean');
  const nativeCategory = facet('filter.p.t.category', 'Termos', 'aa-1', true);
  const customCategory = facet('filter.p.m.custom.categoria', 'Térmicos', 'termicos');
  const capacity = facet('filter.p.m.custom.capacidad', '1000 ML', '1000 ML');
  const material = facet('filter.p.m.custom.material', 'Acero', 'acero');
  const price = {
    type: 'price_range', label: 'Precio', range_max: 10000,
    min_value: { param_name: 'filter.v.price.gte', value: 0 },
    max_value: { param_name: 'filter.v.price.lte', value: null },
    url_to_remove: '/collections/termos',
  };
  for (const category of [nativeCategory, customCategory]) {
    const filters = [material, price, capacity, customCategory, availability];
    if (category === nativeCategory) filters.push(nativeCategory);
    const markup = await liquid.parseAndRender(template, {
      section: { id: 'grid', settings: { category_metafield: 'custom.categoria', capacity_metafield: 'custom.capacidad' } },
      collection: { url: '/collections/termos', default_sort_by: 'best-selling', products: [], filters },
      routes: { cart_url: '/cart' },
    });
    const { window } = new JSDOM(markup);
    try {
      const { document } = window;
      const form = document.querySelector('[data-cg2-filters]');
      const groups = Array.from(form.querySelectorAll('details'));
      assert.deepEqual(groups.map((group) => group.querySelector('summary').textContent.trim()), [
        'Disponibilidad', 'Categoría', 'Capacidad', 'Precio',
      ]);
      assert.deepEqual(Array.from(form.querySelectorAll('input'), (input) => input.name), [
        availability.param_name, category.param_name, capacity.param_name, 'filter.v.price.gte', 'filter.v.price.lte',
      ]);
      assert.deepEqual(groups.map((group) => group.open), [true, category === nativeCategory, false, true]);
      assert.equal(form.getAttribute('action'), '/collections/termos');
      assert.equal(document.querySelector('.cg2-filter-top a').getAttribute('href'), '/collections/termos?sort_by=best-selling');
    } finally {
      window.close();
    }
  }
});
