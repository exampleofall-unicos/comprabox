(() => {
  if (window.compraboxCartBagIndicator) return;
  window.compraboxCartBagIndicator = true;
  const storageKey = `comprabox.cart-request.v1:${location.host}:products`;
  let activeCartHasItems = null;
  let nativeCount = null;
  let lastDot;

  function hasLocalProducts() {
    try {
      const items = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(items) && items.some((item) => item && /^product:\d+$/.test(item.key) &&
        Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) > 0);
    } catch (_) { return false; }
  }

  function update() {
    const dot = document.querySelector('[data-cart-bag-dot]');
    if (!dot) return;
    if (dot !== lastDot) nativeCount = null;
    lastDot = dot;
    const hasItems = activeCartHasItems ?? ((nativeCount ?? Number(dot.dataset.nativeCartCount)) > 0 || hasLocalProducts());
    dot.hidden = !hasItems;
    const status = document.querySelector('[data-cart-bag-status]');
    const message = hasItems ? 'Hay productos en tu carrito' : '';
    if (status && status.textContent !== message) status.textContent = message;
  }

  document.addEventListener('comprabox:cart-change', (event) => {
    activeCartHasItems = Boolean(event.detail.hasItems);
    update();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    activeCartHasItems = null;
    update();
  });
  if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
    subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      activeCartHasItems = null;
      if (typeof event.cartData?.item_count === 'number') nativeCount = event.cartData.item_count;
      update();
    });
  }
  const observer = new MutationObserver(() => {
    if (document.querySelector('[data-cart-bag-dot]') !== lastDot) update();
  });
  const observe = () => observer.observe(document.documentElement, { childList: true, subtree: true });
  observe();
  window.addEventListener('pagehide', () => observer.disconnect());
  window.addEventListener('pageshow', () => { activeCartHasItems = null; observe(); update(); });
  document.addEventListener('shopify:section:load', update);
  update();
})();
