/* Requested quantities are quote data, not Shopify inventory reservations. */
(() => {
  if (window.compraboxCartRequest) return;
  window.compraboxCartRequest = true;
  const pricing = window.compraboxQuotePricing;
  let data, quantities, storageKey, lastPayload, lastTotal;
  let storageError = false;
  let note = '';
  let productItems = [];
  let rate = pricing.fallbackRate;
  let rateRequested = false;
  const valid = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const quantity = (item) => quantities[item.key] || item.quantity;
  const minimum = (item) => item.key.startsWith('product:') || pricing.usesTiers(item.pricing) ? pricing.minimum : 1;
  const lineQuote = (item, units = quantity(item)) => pricing.calculate(item, units,
    pricing.validRate(item.exchangeRate) ? item.exchangeRate : rate);
  const formatQuote = (quote, field) => quote ? pricing.money(quote[field], quote.currency) : '—';
  const describeOptions = (item) => [item.variant === 'Default Title' ? '' : item.variant,
    item.sku ? `SKU: ${item.sku}` : '', item.properties, item.sellingPlan].filter(Boolean).join(' — ');
  const describe = (item) => [item.title, describeOptions(item)].filter(Boolean).join(' — ');
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
    document.dispatchEvent(new CustomEvent('comprabox:cart-change', { detail: { hasItems: data.items.length > 0 } }));
    document.querySelectorAll('cart-items, #main-cart-footer').forEach((node) => {
      node.classList.toggle('is-empty', data.items.length === 0);
    });
    const quotes = new Map(data.items.map((item) => [item.key, lineQuote(item)]));
    const totals = new Map();
    let ready = data.items.length > 0;
    quotes.forEach((quote) => {
      if (!quote) {
        ready = false;
        return;
      }
      const total = (totals.get(quote.currency) || 0) + quote.total;
      totals.set(quote.currency, total);
      if (!Number.isSafeInteger(total)) ready = false;
    });
    const totalLabel = !data.items.length ? pricing.money(0, data.currency) : !ready ? '—'
      : Array.from(totals, ([currency, total]) => {
        const label = pricing.money(total, currency);
        return totals.size > 1 ? `${label} ${currency}` : label;
      }).join(' + ');
    document.querySelectorAll('[data-cart-request-line-total]').forEach((node) => {
      node.textContent = formatQuote(quotes.get(node.dataset.cartRequestLineTotal), 'total');
    });
    document.querySelectorAll('[data-cart-request-unit-price]').forEach((node) => {
      node.textContent = formatQuote(quotes.get(node.dataset.cartRequestUnitPrice), 'unitPrice');
    });
    document.querySelectorAll('[data-cart-request-total]').forEach((node) => { node.textContent = totalLabel; });
    document.querySelectorAll('[data-cart-request-empty]').forEach((node) => { node.hidden = data.items.length > 0; });
    document.querySelectorAll('[data-cart-request-continue]').forEach((node) => {
      node.disabled = !ready;
    });
    const summary = document.querySelector('[data-cart-request-summary]');
    if (summary) {
      summary.replaceChildren();
      const action = (icon, label, href) => {
        const control = document.createElement(href ? 'a' : 'button');
        if (href) control.href = href;
        else control.type = 'button';
        control.className = 'preview-action';
        control.dataset.buttonIcon = 'none';
        control.setAttribute('aria-label', label);
        control.title = label;
        const template = document.querySelector(`[data-cart-preview-${icon}-icon]`);
        if (template) control.append(template.content.cloneNode(true));
        return control;
      };
      const storeUrl = (value) => {
        if (!value) return null;
        try {
          const url = new URL(value, location.origin);
          if (url.origin !== location.origin) return null;
          const current = new URL(location.href);
          if (current.searchParams.has('preview_theme_id')) url.searchParams.set('preview_theme_id', current.searchParams.get('preview_theme_id'));
          return url.href;
        } catch (_) { return null; }
      };
      data.items.forEach((item) => {
        const row = document.createElement('tr');
        row.dataset.previewProductKey = item.key;
        const cell = (label) => {
          const td = document.createElement('td');
          td.dataset.label = label;
          row.append(td);
          return td;
        };
        const product = cell('Producto');
        const productName = document.createElement('strong');
        productName.textContent = item.title;
        product.append(productName);
        const options = [item.variant === 'Default Title' ? '' : item.variant, item.properties, item.sellingPlan].filter(Boolean).join(' — ');
        if (options) {
          const details = document.createElement('span');
          details.className = 'cart-preview-options';
          details.textContent = options;
          product.append(details);
        }
        cell('SKU').textContent = item.sku || '—';
        const units = document.createElement('div');
        units.className = 'cart-preview-cell-actions';
        const count = document.createElement('span');
        count.textContent = `${quantity(item)} unidades`;
        units.append(count);
        const local = item.key.startsWith('product:');
        const editUrl = local ? productUrl(item)?.href : storeUrl(item.editUrl || '/cart');
        if (editUrl) {
          const edit = action('edit', `Editar cantidad de ${item.title}`, editUrl);
          edit.dataset.previewEdit = '';
          units.append(edit);
        }
        cell('Cantidad').append(units);
        const total = document.createElement('div');
        total.className = 'cart-preview-cell-actions';
        const amount = document.createElement('span');
        amount.textContent = formatQuote(quotes.get(item.key), 'total');
        total.append(amount);
        const removeUrl = storeUrl(item.removeUrl);
        if (local || removeUrl) {
          const remove = action('remove', `Quitar ${item.title}`, local ? null : removeUrl);
          if (local) remove.dataset.removeProductRequest = item.key;
          total.append(remove);
        }
        cell('Total').append(total);
        summary.append(row);
      });
    }
    const details = document.querySelector('[data-cart-request-details]');
    if (details) details.value = data.items.map((item) => {
      const quote = quotes.get(item.key);
      return `${describe(item)} | Cantidad solicitada: ${quantity(item)} | Precio unitario de referencia: ${formatQuote(quote, 'unitPrice')} | Subtotal: ${formatQuote(quote, 'total')}`;
    }).concat(`Total de referencia: ${totalLabel}`, note ? `Notas del pedido: ${note}` : '',
      'Sujeto a confirmación de disponibilidad y precio.').filter(Boolean).join('\n');
    const form = details?.form;
    if (form) {
      const product = form.elements.namedItem('contact[Producto]');
      const units = form.elements.namedItem('contact[Cantidad]');
      if (product) product.value = data.items.map(describe).join('; ');
      if (units) units.value = data.items.reduce((sum, item) => sum + quantity(item), 0);
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = !ready;
    }
    return ready;
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
      row.querySelector('[data-request-unit-price]').dataset.cartRequestUnitPrice = item.key;
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
    data.items.forEach((item) => { item.currency ||= data.currency; });
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
    if (!rateRequested && data.items.some((item) => pricing.usesTiers(item.pricing) && !pricing.validRate(item.exchangeRate))) {
      rateRequested = true;
      pricing.getRate().then((currentRate) => {
        rate = currentRate;
        render();
      });
    }
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (_) { /* Recover corrupted storage. */ }
    note = data.note || '';
    try { note = localStorage.getItem(`${storageKey}:note`) ?? note; } catch (_) { /* Report on persist. */ }
    if (!data.items.length) note = '';
    quantities = Object.create(null);
    data.items.forEach((item) => {
      const units = item.key.startsWith('product:') ? item.quantity
        : valid(saved[item.key]) ? Number(saved[item.key]) : item.quantity;
      quantities[item.key] = Math.max(minimum(item), units);
      if (item.key.startsWith('product:')) item.quantity = quantities[item.key];
    });
    renderProductRows();
    document.querySelectorAll('[data-cart-request-quantity]').forEach((input) => {
      const item = data.items.find((line) => line.key === input.dataset.quantityLineKey);
      if (!item) return;
      input.min = minimum(item);
      input.dataset.min = input.min;
      input.value = quantity(item);
      input.setCustomValidity('');
      input.closest('quantity-input')?.validateQtyRules?.();
    });
    persist();
    render();
  }

  // Capture changes before Dawn's debounced cart handler can send them to Shopify.
  ['input', 'change'].forEach((type) => document.addEventListener(type, (event) => {
    const input = event.target;
    if (!data || !input.matches('[data-cart-request-quantity]')) return;
    event.stopImmediatePropagation();
    const item = data.items.find((line) => line.key === input.dataset.quantityLineKey);
    if (!item) return;
    const min = minimum(item);
    if (type === 'change' && min > 1 && Number.isSafeInteger(Number(input.value)) && Number(input.value) < min) {
      input.value = min;
    }
    const units = Number(input.value);
    const error = !Number.isSafeInteger(units) || units < min ? `Ingresá una cantidad entera de al menos ${min} unidades.`
      : !lineQuote(item, units) ? 'La cantidad supera el máximo que podemos cotizar.' : '';
    input.setCustomValidity(error);
    if (!input.checkValidity()) return;
    quantities[item.key] = units;
    if (item.key.startsWith('product:')) item.quantity = units;
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
      if (event.target.reportValidity() && render() && persist()) {
        const url = new URL(location.href);
        url.searchParams.set('view', 'preview-co');
        location.assign(url.href);
      }
    } else if (event.target.querySelector('[data-cart-request-details]')) {
      if (!render() || !persist()) event.preventDefault();
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
