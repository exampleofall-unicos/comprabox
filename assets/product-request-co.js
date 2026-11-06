/* Extend Dawn's product interactions while keeping quotation quantities outside its inventory API. */
(() => {
  if (customElements.get('product-info-co')) return;
  const Base = customElements.get('product-info');
  const pricing = window.compraboxQuotePricing;
  customElements.define('product-info-co', class extends Base {
    rate = pricing.fallbackRate;

    connectedCallback() {
      super.connectedCallback();
      this.submitRequest = this.submitRequest || this.saveRequest.bind(this);
      this.addEventListener('submit', this.submitRequest);
      this.updateRequestQuantity = this.updateRequestQuantity || ((event) => {
        if (event.target !== this.quantityInput) return;
        if (event.type === 'change' && Number.isSafeInteger(this.requestQuantity) && this.requestQuantity < pricing.minimum) {
          this.quantityInput.value = pricing.minimum;
        }
        this.refreshRequest();
      });
      this.selectPreset = this.selectPreset || ((event) => {
        const button = event.target.closest('[data-quote-preset]');
        if (!button || button.disabled || !this.quantityInput) return;
        this.quantityInput.value = button.value;
        this.quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      this.addEventListener('input', this.updateRequestQuantity);
      this.addEventListener('change', this.updateRequestQuantity);
      this.addEventListener('click', this.selectPreset);
      const savedKey = `comprabox.cart-request.v1:${location.host}:products`;
      try {
        const saved = JSON.parse(localStorage.getItem(savedKey))?.find((item) => item.key === this.requestVariant?.key);
        if (this.quantityInput && !this.quantityInput.hasAttribute('data-preserve-request-quantity') && Number.isSafeInteger(saved?.quantity)) {
          this.quantityInput.value = Math.max(pricing.minimum, saved.quantity);
        }
      } catch (_) { /* Storage errors are reported when saving. */ }
      this.quantityInput?.closest('quantity-input')?.validateQtyRules();
      this.refreshRequest();
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.removeEventListener('submit', this.submitRequest);
      this.removeEventListener('input', this.updateRequestQuantity);
      this.removeEventListener('change', this.updateRequestQuantity);
      this.removeEventListener('click', this.selectPreset);
    }

    // Dawn normally derives bounds from inventory and resets the value on variant changes.
    initQuantityHandlers() {
      this.quantityInput = this.querySelector('.quantity__input');
      this.quantityForm = this.querySelector('.product-form__quantity');
      this.setQuantityBoundries();
    }

    setQuantityBoundries() {
      if (!this.quantityInput) return;
      this.quantityInput.min = pricing.minimum;
      this.quantityInput.dataset.min = pricing.minimum;
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
      this.variantUpdating = true;
      this.querySelectorAll('[data-product-request-button]').forEach((button) => { button.disabled = true; });
    }

    handleUpdateProductInfo(url) {
      const update = super.handleUpdateProductInfo(url);
      return (html) => {
        update(html);
        const source = html.querySelector('[data-product-request-data]');
        const target = this.querySelector('[data-product-request-data]');
        if (target) target.dataset.productRequestData = source?.dataset.productRequestData || 'null';
        this.variantUpdating = false;
        this.refreshRequest();
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

    refreshRequest() {
      const item = this.requestVariant;
      const quantity = this.requestQuantity;
      const validQuantity = Number.isSafeInteger(quantity) && quantity >= pricing.minimum;
      const tiered = pricing.usesTiers(item?.pricing);
      if (tiered && !this.rateRequested) {
        this.rateRequested = true;
        pricing.getRate().then((rate) => {
          this.rate = rate;
          if (this.isConnected) this.refreshRequest();
        });
      }
      const quote = item && validQuantity ? pricing.calculate(item, quantity, this.rate) : null;
      const error = !validQuantity ? `Ingresá una cantidad entera de al menos ${pricing.minimum} unidades.`
        : item && !quote ? 'La cantidad supera el máximo que podemos cotizar.' : '';
      this.quantityInput?.setCustomValidity(error);
      this.querySelectorAll('[data-product-request-button]').forEach((button) => {
        button.disabled = this.variantUpdating || !quote;
      });

      const box = pricing.boxUnits(item?.pricing);
      const half = Math.ceil(box / 2);
      const presets = { minimum: pricing.minimum, half, full: box };
      this.querySelectorAll('[data-quote-preset]').forEach((button) => {
        const units = presets[button.dataset.quotePreset];
        button.hidden = button.dataset.quotePreset !== 'minimum' && (units <= pricing.minimum ||
          (button.dataset.quotePreset === 'half' && half === box));
        button.disabled = !item || !this.quantityInput || button.hidden;
        button.value = units;
        button.textContent = `X ${units}`;
        button.setAttribute('aria-pressed', String(units === quantity));
      });

      const unit = this.querySelector('[data-quote-unit]');
      const total = this.querySelector('[data-quote-total]');
      if (unit) unit.textContent = `Desde ${quote ? pricing.money(quote.unitPrice, quote.currency) : '—'}`;
      if (total) total.textContent = quote ? pricing.money(quote.total, quote.currency) : '—';
      const hint = this.querySelector('[data-quote-quantity-hint]');
      if (hint) {
        const remaining = box - quantity;
        const boxQuote = tiered && remaining > 0 ? pricing.calculate(item, box, this.rate) : null;
        hint.hidden = !(quote && boxQuote && quote.unitPrice > boxQuote.unitPrice);
        hint.textContent = hint.hidden ? '' : remaining === 1 ? '¡Sumando 1 unidad accedés al precio por caja!'
          : `¡Sumando ${remaining} unidades accedés al precio por caja!`;
      }
      return quote;
    }

    get requestQuantity() {
      return Number(this.quantityInput?.value ?? pricing.minimum);
    }

    get requestVariant() {
      return JSON.parse(this.querySelector('[data-product-request-data]')?.dataset.productRequestData || 'null');
    }

    saveRequest(event) {
      if (!event.target.matches('[data-product-request-form]')) return;
      event.preventDefault();
      const item = this.requestVariant;
      const units = this.requestQuantity;
      const quote = this.refreshRequest();
      if (this.variantUpdating || !event.target.reportValidity() || !quote) return;
      const status = this.querySelector('[data-product-request-status]');
      try {
        const key = `comprabox.cart-request.v1:${location.host}:products`;
        let items;
        try { items = JSON.parse(localStorage.getItem(key)) || []; } catch (_) { items = []; }
        if (!Array.isArray(items)) items = [];
        const url = new URL(item.url, location.origin);
        url.searchParams.set('view', 'co');
        url.searchParams.set('variant', item.variantId);
        const selection = { ...item, quantity: units, exchangeRate: this.rate, url: url.pathname + url.search };
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
