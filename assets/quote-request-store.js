(() => {
  if (window.compraboxQuoteRequestStore) return;
  const key = `comprabox.cart-request.v1:${location.host}:products`;

  function read() {
    try {
      const items = JSON.parse(localStorage.getItem(key));
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  }

  function save(item, quantity, exchangeRate) {
    const url = new URL(item.url, location.origin);
    url.searchParams.set('view', 'co');
    url.searchParams.set('variant', item.variantId);
    const selection = { ...item, quantity, exchangeRate, url: url.pathname + url.search };
    localStorage.setItem(key, JSON.stringify([...read().filter((entry) => entry?.key !== item.key), selection]));
  }

  window.compraboxQuoteRequestStore = { read, save };
})();
