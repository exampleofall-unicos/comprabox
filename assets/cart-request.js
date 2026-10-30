/* Requested quantities are quote data, not Shopify inventory reservations. */
(() => {
  if (window.compraboxCartRequest) return;
  window.compraboxCartRequest = true;
  let data, quantities, storageKey, lastPayload, lastTotal;
  let storageError = false;
  let note = '';
  const valid = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const money = (cents) => new Intl.NumberFormat(document.documentElement.lang || 'es-AR', {
    style: 'currency', currency: data.currency,
  }).format(cents / 100);
  const quantity = (item) => quantities[item.key] || item.quantity;
  const describe = (item) => [item.title, item.variant === 'Default Title' ? '' : item.variant,
    item.sku ? `SKU: ${item.sku}` : '', item.properties, item.sellingPlan].filter(Boolean).join(' — ');

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(quantities));
      localStorage.setItem(`${storageKey}:note`, note);
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
    let total = 0;
    data.items.forEach((item) => {
      const amount = item.price * quantity(item);
      total += amount;
      document.querySelectorAll('[data-cart-request-line-total]').forEach((node) => {
        if (node.dataset.cartRequestLineTotal === item.key) node.textContent = money(amount);
      });
    });
    document.querySelectorAll('[data-cart-request-total]').forEach((node) => { node.textContent = money(total); });
    document.querySelectorAll('[data-cart-request-continue]').forEach((node) => {
      node.disabled = data.items.length === 0;
    });
    const summary = document.querySelector('[data-cart-request-summary]');
    if (summary) {
      summary.replaceChildren();
      data.items.forEach((item) => {
        const row = document.createElement('li');
        row.textContent = `${describe(item)}: ${quantity(item)} unidades — ${money(item.price * quantity(item))}`;
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

  function hydrate(force = false) {
    const payload = document.querySelector('[data-cart-request-data]');
    const total = document.querySelector('[data-cart-request-total]');
    if (!payload || (!force && payload === lastPayload && total === lastTotal)) return;
    lastPayload = payload;
    lastTotal = total;
    data = JSON.parse(payload.dataset.cartRequestData);
    storageKey = `comprabox.cart-request.v1:${location.host}`;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (_) { /* Recover corrupted storage. */ }
    note = data.note || '';
    try { note = localStorage.getItem(`${storageKey}:note`) ?? note; } catch (_) { /* Report on persist. */ }
    if (!data.items.length) note = '';
    quantities = Object.create(null);
    data.items.forEach((item) => {
      quantities[item.key] = valid(saved[item.key]) ? Number(saved[item.key]) : item.quantity;
    });
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
    input.closest('quantity-input')?.validateQtyRules?.();
    persist();
    render();
  }, true));

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
