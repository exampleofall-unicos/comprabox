/* Requested quantities are quote data, not Shopify inventory reservations. */
(() => {
  if (window.compraboxCartRequest) return;
  window.compraboxCartRequest = true;
  let data, quantities, storageKey, lastPayload, lastTotal;
  let storageError = false;
  let note = '';
  let productItems = [];
  const valid = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const money = (cents) => new Intl.NumberFormat(document.documentElement.lang || 'es-AR', {
    style: 'currency', currency: data.currency,
  }).format(cents / 100);
  const quantity = (item) => quantities[item.key] || item.quantity;
  const describe = (item) => [item.title, item.variant === 'Default Title' ? '' : item.variant,
    item.sku ? `SKU: ${item.sku}` : '', item.properties, item.sellingPlan].filter(Boolean).join(' — ');
  const productUrl = (item) => {
    try {
      const url = new URL(item.url, location.origin);
      if (url.origin !== location.origin || !url.pathname.includes('/products/')) return null;
      const current = new URL(location.href);
      if (current.searchParams.has('preview_theme_id')) url.searchParams.set('preview_theme_id', current.searchParams.get('preview_theme_id'));
      return url;
    } catch (_) { return null; }
  };

  function saveProductItems() {
    localStorage.setItem(`${storageKey}:products`, JSON.stringify(productItems));
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(quantities));
      localStorage.setItem(`${storageKey}:note`, note);
      saveProductItems();
      storageError = false;
    } catch (_) {
      storageError = true;
    }
    const error = document.querySelector('[data-cart-request-error]');
    if (error) error.textContent = storageError
      ? 'No pudimos guardar las cantidades. Habilitá el almacenamiento del navegador para continuar.' : '';
    return !storageError;
  }

  function render() {
    document.querySelectorAll('cart-items, #main-cart-footer').forEach((node) => {
      node.classList.toggle('is-empty', data.items.length === 0);
    });
    let total = 0;
    data.items.forEach((item) => {
      const amount = item.price * quantity(item);
      total += amount;
      document.querySelectorAll('[data-cart-request-line-total]').forEach((node) => {
        if (node.dataset.cartRequestLineTotal === item.key) node.textContent = money(amount);
      });
    });
    document.querySelectorAll('[data-cart-request-total]').forEach((node) => { node.textContent = money(total); });
    document.querySelectorAll('[data-cart-request-empty]').forEach((node) => { node.hidden = data.items.length > 0; });
    document.querySelectorAll('[data-cart-request-continue]').forEach((node) => {
      node.disabled = data.items.length === 0;
    });
    const summary = document.querySelector('[data-cart-request-summary]');
    if (summary) {
      summary.replaceChildren();
      data.items.forEach((item) => {
        const row = document.createElement('li');
        row.textContent = `${describe(item)}: ${quantity(item)} unidades — ${money(item.price * quantity(item))}`;
        if (item.key.startsWith('product:')) {
          const edit = document.createElement('a');
          const url = productUrl(item);
          // Stored links can only lead to this store's product pages.
          if (url) {
            edit.href = url.href;
            edit.textContent = 'Editar cantidad';
            edit.className = 'underlined-link';
            row.append(' — ', edit);
          }
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'button button--tertiary';
          remove.textContent = 'Quitar';
          remove.dataset.removeProductRequest = item.key;
          row.append(' ', remove);
        }
        summary.append(row);
      });
    }
    const details = document.querySelector('[data-cart-request-details]');
    if (details) details.value = data.items.map((item) =>
      `${describe(item)} | Cantidad solicitada: ${quantity(item)} | Precio unitario de referencia: ${money(item.price)}`
    ).concat(`Total de referencia: ${money(total)}`, note ? `Notas del pedido: ${note}` : '',
      'Sujeto a confirmación de disponibilidad y precio.').filter(Boolean).join('\n');
    const form = details?.form;
    if (form) {
      const product = form.elements.namedItem('contact[Producto]');
      const units = form.elements.namedItem('contact[Cantidad]');
      if (product) product.value = data.items.map(describe).join('; ');
      if (units) units.value = data.items.reduce((sum, item) => sum + quantity(item), 0);
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = data.items.length === 0;
    }
  }

  function renderProductRows() {
    const target = document.querySelector('[data-cart-request-product-rows]');
    const template = document.querySelector('[data-cart-request-product-template]');
    if (!target || !template) return;
    const rows = document.createDocumentFragment();
    productItems.forEach((item) => {
      const row = template.content.cloneNode(true);
      const title = row.querySelector('[data-request-title]');
      title.textContent = item.title;
      const url = productUrl(item);
      if (url) title.href = url.href;
      row.querySelector('[data-request-options]').textContent = [
        item.variant === 'Default Title' ? '' : item.variant, item.sku ? `SKU: ${item.sku}` : '',
        item.properties, item.sellingPlan,
      ].filter(Boolean).join(' — ');
      row.querySelector('[data-request-unit-price]').textContent = money(item.price);
      const input = row.querySelector('[data-cart-request-quantity]');
      input.dataset.quantityLineKey = item.key;
      input.setAttribute('value', quantity(item));
      input.setAttribute('aria-label', `Cantidad de ${item.title}`);
      row.querySelector('[data-remove-product-request]').dataset.removeProductRequest = item.key;
      row.querySelectorAll('[data-request-total]').forEach((node) => {
        node.dataset.cartRequestLineTotal = item.key;
      });
      if (item.image) {
        try {
          const imageUrl = new URL(item.image, location.origin);
          if (imageUrl.protocol === 'https:' && (imageUrl.origin === location.origin || imageUrl.hostname === 'cdn.shopify.com')) {
            const image = row.querySelector('[data-request-image]');
            image.src = imageUrl.href;
            image.alt = item.title;
            image.hidden = false;
          }
        } catch (_) { /* Older selections can omit the product image. */ }
      }
      rows.append(row);
    });
    target.replaceChildren(rows);
  }

  function hydrate(force = false) {
    const payload = document.querySelector('[data-cart-request-data]');
    const total = document.querySelector('[data-cart-request-total]');
    if (!payload || (!force && payload === lastPayload && total === lastTotal)) return;
    lastPayload = payload;
    lastTotal = total;
    data = JSON.parse(payload.dataset.cartRequestData);
    storageKey = `comprabox.cart-request.v1:${location.host}`;
    productItems = [];
    try {
      const savedProducts = JSON.parse(localStorage.getItem(`${storageKey}:products`)) || [];
      if (Array.isArray(savedProducts)) productItems = savedProducts.filter((item) =>
        item && /^product:\d+$/.test(item.key) && valid(item.quantity) &&
        typeof item.title === 'string' && typeof item.url === 'string' &&
        Number.isSafeInteger(item.price) && item.price >= 0 && item.currency === data.currency);
    } catch (_) { /* Invalid product selections do not affect the Shopify cart. */ }
    data.items.push(...productItems);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (_) { /* Recover corrupted storage. */ }
    note = data.note || '';
    try { note = localStorage.getItem(`${storageKey}:note`) ?? note; } catch (_) { /* Report on persist. */ }
    if (!data.items.length) note = '';
    quantities = Object.create(null);
    data.items.forEach((item) => {
      quantities[item.key] = item.key.startsWith('product:') ? item.quantity
        : valid(saved[item.key]) ? Number(saved[item.key]) : item.quantity;
    });
    renderProductRows();
    document.querySelectorAll('[data-cart-request-quantity]').forEach((input) => {
      input.value = quantities[input.dataset.quantityLineKey];
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    persist();
    render();
  }

  // Capture changes before Dawn's debounced cart handler can send them to Shopify.
  ['input', 'change'].forEach((type) => document.addEventListener(type, (event) => {
    const input = event.target;
    if (!input.matches('[data-cart-request-quantity]')) return;
    event.stopImmediatePropagation();
    input.setCustomValidity(valid(input.value) ? '' : 'Ingresá una cantidad entera mayor que cero.');
    if (!input.checkValidity()) return;
    quantities[input.dataset.quantityLineKey] = Number(input.value);
    const product = productItems.find((item) => item.key === input.dataset.quantityLineKey);
    if (product) product.quantity = Number(input.value);
    input.closest('quantity-input')?.validateQtyRules?.();
    persist();
    render();
  }, true));

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-product-request]');
    if (!button) return;
    try {
      productItems = productItems.filter((item) => item.key !== button.dataset.removeProductRequest);
      saveProductItems();
      hydrate(true);
    } catch (_) {
      const error = document.querySelector('[data-cart-request-error]');
      if (error) error.textContent = 'No pudimos quitar el artículo. Habilitá el almacenamiento del navegador.';
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'cart' && document.querySelector('[data-cart-request-quantity]')) {
      event.preventDefault();
      note = document.getElementById('Cart-note')?.value ?? note;
      if (event.target.reportValidity() && persist()) {
        const url = new URL(location.href);
        url.searchParams.set('view', 'preview-co');
        location.assign(url.href);
      }
    } else if (event.target.querySelector('[data-cart-request-details]')) {
      render();
      if (!data.items.length || !persist()) event.preventDefault();
    }
  }, true);

  const observer = new MutationObserver(() => hydrate());
  const observe = () => observer.observe(document.documentElement, { childList: true, subtree: true });
  observe();
  window.addEventListener('pagehide', () => observer.disconnect());
  document.addEventListener('shopify:section:load', () => hydrate(true));
  window.addEventListener('pageshow', () => { observe(); hydrate(true); });
  hydrate();
})();
