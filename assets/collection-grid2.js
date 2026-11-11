(() => {
  if (customElements.get('collection-grid-quote')) return;
  const pricing = window.compraboxQuotePricing;
  const requestStore = window.compraboxQuoteRequestStore;

  customElements.define('collection-grid-quote', class extends HTMLElement {
    connectedCallback() {
      this.events = new AbortController();
      const { signal } = this.events;
      this.dialog = this.querySelector('dialog');
      this.form = this.querySelector('[data-cg2-request]');
      this.quantity = this.form.elements.quantity;
      this.submitButton = this.querySelector('[data-cg2-submit]');
      this.unit = this.querySelector('[data-cg2-unit]');
      this.status = this.querySelector('[data-cg2-status]');
      this.cartLink = this.querySelector('.cg2-cart-link');
      this.rate = pricing.fallbackRate;
      this.cards = new Map();

      const preview = new URLSearchParams(location.search).get('preview_theme_id');
      if (preview) {
        this.cartLink.href = this.withPreview(this.cartLink.href, preview);
        const filterForm = this.querySelector('[data-cg2-filters]');
        if (filterForm && !filterForm.elements.namedItem('preview_theme_id')) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'preview_theme_id';
          input.value = preview;
          filterForm.append(input);
        }
      }

      this.querySelectorAll('.cg2-card').forEach((card) => {
        const item = JSON.parse(card.querySelector('[data-product-request-data]').dataset.productRequestData);
        if (!item) return;
        this.cards.set(card, item);
        card.querySelectorAll('[data-cg2-open]').forEach((button) => {
          button.disabled = false;
          button.addEventListener('click', () => this.open(item, button), { signal });
        });
      });
      this.updateCards();
      if ([...this.cards.values()].some((item) => pricing.usesTiers(item.pricing))) {
        pricing.getRate().then((rate) => {
          if (signal.aborted) return;
          this.rate = rate;
          this.updateCards();
          if (this.dialog.open) this.refresh();
        });
      }

      this.form.addEventListener('input', () => this.refresh(), { signal });
      this.form.addEventListener('change', () => {
        if (Number.isSafeInteger(this.quantity.valueAsNumber) && this.quantity.valueAsNumber < pricing.minimum) {
          this.quantity.value = pricing.minimum;
        }
        this.quantity.closest('quantity-input').validateQtyRules();
        this.refresh();
      }, { signal });
      this.form.addEventListener('submit', (event) => this.save(event), { signal });
      this.querySelector('[data-cg2-close]').addEventListener('click', () => this.dialog.close(), { signal });
      this.dialog.addEventListener('click', (event) => {
        if (event.target !== this.dialog) return;
        const { left, top, right, bottom } = this.dialog.getBoundingClientRect();
        if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
          this.dialog.close();
        }
      }, { signal });
      this.dialog.addEventListener('close', () => this.opener?.focus({ preventScroll: true }), { signal });
      window.addEventListener('resize', () => this.position(), { signal });
      window.addEventListener('scroll', () => this.position(), { signal, passive: true });
    }

    disconnectedCallback() {
      this.events.abort();
      if (this.dialog.open) this.dialog.close();
    }

    withPreview(path, preview) {
      const target = new URL(path, location.origin);
      target.searchParams.set('preview_theme_id', preview);
      return target.href;
    }

    defaultQuantity(item) {
      return Math.max(pricing.minimum, pricing.boxUnits(item.pricing));
    }

    updateCards() {
      this.cards.forEach((item, card) => {
        const quote = pricing.calculate(item, this.defaultQuantity(item), this.rate);
        card.querySelector('[data-cg2-card-price]').textContent = quote ? pricing.money(quote.unitPrice, quote.currency) : '—';
      });
    }

    open(item, button) {
      this.item = item;
      this.opener = button;
      this.quantity.value = this.defaultQuantity(item);
      this.quantity.closest('quantity-input').validateQtyRules();
      this.querySelector('[data-cg2-product]').textContent = item.title;
      this.status.textContent = '';
      this.refresh();
      this.dialog.showModal();
      this.position();
    }

    position() {
      if (!this.dialog.open) return;
      const anchor = this.opener.parentElement.getBoundingClientRect();
      const width = this.dialog.offsetWidth;
      const height = this.dialog.offsetHeight;
      const gutter = 8;
      const left = anchor.left + (anchor.width - width) / 2;
      const above = anchor.top - height - gutter;
      const top = above >= gutter ? above : anchor.bottom + gutter;
      this.dialog.style.setProperty('--cg2-dialog-left', `${Math.max(gutter, Math.min(left, window.innerWidth - width - gutter))}px`);
      this.dialog.style.setProperty('--cg2-dialog-top', `${Math.max(gutter, Math.min(top, window.innerHeight - height - gutter))}px`);
    }

    refresh() {
      const units = this.quantity.valueAsNumber;
      const valid = Number.isSafeInteger(units) && units >= pricing.minimum;
      const quote = valid ? pricing.calculate(this.item, units, this.rate) : null;
      const error = !valid ? `Ingresá una cantidad entera de al menos ${pricing.minimum} unidades.`
        : quote ? '' : 'La cantidad supera el máximo que podemos cotizar.';
      this.quantity.setCustomValidity(error);
      this.submitButton.disabled = !quote;
      this.unit.textContent = `Desde ${quote ? pricing.money(quote.unitPrice, quote.currency) : '—'}`;
      return quote;
    }

    save(event) {
      event.preventDefault();
      if (!this.refresh() || !this.form.reportValidity()) return;
      try {
        requestStore.save(this.item, this.quantity.valueAsNumber, this.rate);
      } catch (_) {
        this.status.textContent = 'No pudimos guardar la cantidad. Habilitá el almacenamiento del navegador para continuar.';
        this.position();
        return;
      }
      location.assign(this.cartLink.href);
    }
  });
})();
