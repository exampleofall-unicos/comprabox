/* Extend Dawn's product interactions while keeping quotation quantities outside its inventory API. */
(() => {
  if (customElements.get('product-info-co')) return;
  const Base = customElements.get('product-info');
  customElements.define('product-info-co', class extends Base {
    connectedCallback() {
      super.connectedCallback();
      this.submitRequest = this.submitRequest || this.saveRequest.bind(this);
      this.addEventListener('submit', this.submitRequest);
      this.validateRequestQuantity = this.validateRequestQuantity || (() => {
        const units = Number(this.quantityInput?.value);
        this.quantityInput?.setCustomValidity(Number.isSafeInteger(units) && units > 0 ? '' : 'Ingresá una cantidad entera mayor que cero.');
      });
      this.addEventListener('input', this.validateRequestQuantity);
      this.addEventListener('change', this.validateRequestQuantity);
      const savedKey = `comprabox.cart-request.v1:${location.host}:products`;
      try {
        const saved = JSON.parse(localStorage.getItem(savedKey))?.find((item) => item.key === this.requestVariant?.key);
        if (this.quantityInput && !this.quantityInput.hasAttribute('data-preserve-request-quantity') && Number.isSafeInteger(saved?.quantity) && saved.quantity > 0) this.quantityInput.value = saved.quantity;
      } catch (_) { /* Storage errors are reported when saving. */ }
      this.refreshRequestButtons();
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('submit', this.submitRequest);
      this.removeEventListener('input', this.validateRequestQuantity);
      this.removeEventListener('change', this.validateRequestQuantity);
    }

    // Dawn normally derives bounds from inventory and resets the value on variant changes.
    initQuantityHandlers() {
      this.quantityInput = this.querySelector('.quantity__input');
      this.quantityForm = this.querySelector('.product-form__quantity');
      this.setQuantityBoundries();
    }

    setQuantityBoundries() {
      if (!this.quantityInput) return;
      this.quantityInput.min = '1';
      this.quantityInput.step = '1';
      this.quantityInput.removeAttribute('max');
      this.quantityInput.removeAttribute('data-max');
    }

    updateQuantityRules() { this.setQuantityBoundries(); }

    buildRequestUrlWithParams(url, options, fullPage = false) {
      const request = new URL(super.buildRequestUrlWithParams(url, options, fullPage), location.origin);
      const current = new URL(location.href);
      request.searchParams.set('view', 'co');
      if (current.searchParams.has('preview_theme_id')) request.searchParams.set('preview_theme_id', current.searchParams.get('preview_theme_id'));
      return request.href;
    }

    updateURL(url, variantId) {
      if (this.dataset.updateUrl === 'false') return;
      const target = new URL(url, location.origin);
      target.searchParams.set('view', 'co');
      if (variantId) target.searchParams.set('variant', variantId);
      const current = new URL(location.href);
      if (current.searchParams.has('preview_theme_id')) target.searchParams.set('preview_theme_id', current.searchParams.get('preview_theme_id'));
      history.replaceState({}, '', target.href);
      this.querySelector('share-button')?.updateUrl(target.href);
    }

    resetProductFormState() {
      this.querySelectorAll('[data-product-request-button]').forEach((button) => { button.disabled = true; });
    }

    handleUpdateProductInfo(url) {
      const update = super.handleUpdateProductInfo(url);
      return (html) => {
        update(html);
        const source = html.querySelector('[data-product-request-data]');
        const target = this.querySelector('[data-product-request-data]');
        if (target) target.dataset.productRequestData = source?.dataset.productRequestData || 'null';
        this.refreshRequestButtons();
      };
    }

    handleSwapProduct(url, fullPage) {
      return (html) => {
        const source = html.querySelector('product-info-co');
        if (!source) return;
        const input = source.querySelector('.quantity__input');
        if (input && this.quantityInput) {
          input.setAttribute('value', this.quantityInput.value);
          input.setAttribute('data-preserve-request-quantity', '');
        }
        this.variantSelectors?.resolvePendingSelectPromise(this.getSelectedVariant(source), this.getVariantSelects(source));
        this.productModal?.remove();
        this.updateURL(url, this.getSelectedVariant(source)?.id);
        if (fullPage && html.querySelector('title')) document.title = html.querySelector('title').textContent;
        HTMLUpdateUtility.viewTransition(fullPage ? document.querySelector('main') : this,
          fullPage ? html.querySelector('main') : source, this.preProcessHtmlCallbacks, this.postProcessHtmlCallbacks);
      };
    }

    refreshRequestButtons() {
      const valid = Boolean(this.requestVariant);
      this.querySelectorAll('[data-product-request-button]').forEach((button) => { button.disabled = !valid; });
    }

    get requestVariant() {
      return JSON.parse(this.querySelector('[data-product-request-data]')?.dataset.productRequestData || 'null');
    }

    saveRequest(event) {
      if (!event.target.matches('[data-product-request-form]')) return;
      event.preventDefault();
      const item = this.requestVariant;
      const input = this.quantityInput;
      const units = Number(input?.value ?? 1);
      input?.setCustomValidity(Number.isSafeInteger(units) && units > 0 ? '' : 'Ingresá una cantidad entera mayor que cero.');
      if (!item || !event.target.reportValidity() || !Number.isSafeInteger(units) || units < 1) return;
      const status = this.querySelector('[data-product-request-status]');
      try {
        const key = `comprabox.cart-request.v1:${location.host}:products`;
        let items;
        try { items = JSON.parse(localStorage.getItem(key)) || []; } catch (_) { items = []; }
        if (!Array.isArray(items)) items = [];
        const url = new URL(item.url, location.origin);
        url.searchParams.set('view', 'co');
        url.searchParams.set('variant', item.variantId);
        const selection = { ...item, quantity: units, url: url.pathname + url.search };
        localStorage.setItem(key, JSON.stringify([...items.filter((entry) => entry.key !== item.key), selection]));
        status.textContent = `Se agregaron ${units} unidades al carrito.`;
        {
          const target = new URL(event.target.dataset.cartUrl, location.origin);
          if (event.submitter?.value === 'review') target.searchParams.set('view', 'preview-co');
          const current = new URL(location.href);
          if (current.searchParams.has('preview_theme_id')) target.searchParams.set('preview_theme_id', current.searchParams.get('preview_theme_id'));
          this.navigateToPreview(target.href);
        }
      } catch (_) {
        status.textContent = 'No pudimos guardar las cantidades. Habilitá el almacenamiento del navegador para continuar.';
      }
    }

    navigateToPreview(url) { location.assign(url); }
  });
})();
