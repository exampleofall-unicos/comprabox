if (!customElements.get('order-calculator')) {
  customElements.define(
    'order-calculator',
    class OrderCalculator extends HTMLElement {
      constructor() {
        super();
        this.config = {};
        this.rate = null;
        this.basePriceCents = 0;
        this.unsubscribeVariantChange = null;
        this.formatter = null;
      }

      connectedCallback() {
        this.config = this.readConfig();
        this.basePriceCents = Number(this.config.basePriceCents) || 0;
        this.quantityInput = this.querySelector('[data-quantity-input]');
        this.rateDisplay = this.querySelector('[data-rate-display]');
        this.savingsDisplay = this.querySelector('[data-savings]');
        this.selectedUnitDisplay = this.querySelector('[data-selected-unit]');
        this.selectedTotalDisplay = this.querySelector('[data-selected-total]');
        this.bandRows = Array.from(this.querySelectorAll('[data-band]'));

        this.quantityInput?.addEventListener('input', this.handleQuantityChange.bind(this));
        this.quantityInput?.addEventListener('change', this.handleQuantityChange.bind(this));

        this.bindVariantListener();
        this.renderBandPreview();
        this.fetchExchangeRate();
        this.render();
      }

      disconnectedCallback() {
        this.unsubscribeVariantChange?.();
      }

      readConfig() {
        const node = this.querySelector('[data-order-calculator-config]');
        if (!node) return {};

        try {
          return JSON.parse(node.textContent.trim());
        } catch (error) {
          console.error('Unable to parse order calculator config', error);
          return {};
        }
      }

      bindVariantListener() {
        if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;

        this.unsubscribeVariantChange = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
          const nextPrice = Number(event?.data?.variant?.price);
          if (Number.isFinite(nextPrice) && nextPrice > 0) {
            this.basePriceCents = nextPrice;
            this.renderBandPreview();
            this.render();
          }
        });
      }

      async fetchExchangeRate() {
        const fallbackRate = Number(this.config.fallbackRate) || 0;
        this.rate = fallbackRate;
        this.render();

        try {
          const response = await fetch('https://api.bluelytics.com.ar/v2/latest', {
            cache: 'no-store',
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();
          const fetchedRate = Number(data?.blue?.value_sell);
          if (Number.isFinite(fetchedRate) && fetchedRate > 0) {
            this.rate = fetchedRate;
            this.renderBandPreview();
            this.render();
          }
        } catch (error) {
          console.warn('Using fallback exchange rate for order calculator', error);
        }
      }

      handleQuantityChange(event) {
        const nextValue = Math.max(1, Math.floor(Number(event.currentTarget.value) || 1));
        if (String(nextValue) !== event.currentTarget.value) {
          event.currentTarget.value = String(nextValue);
        }

        this.render();
      }

      get quantity() {
        return Math.max(1, Math.floor(Number(this.quantityInput?.value) || 1));
      }

      get rateValue() {
        return Number(this.rate) || Number(this.config.fallbackRate) || 0;
      }

      get quarterMax() {
        const unitsPerBox = Math.max(0, Math.floor(Number(this.config.unitsPerBox) || 0));
        return Math.max(4, Math.floor(unitsPerBox / 4));
      }

      get halfMax() {
        return Math.max(this.quarterMax + 1, Math.floor((Number(this.config.unitsPerBox) || 0) / 2));
      }

      get bands() {
        const quarterPriceCents = this.usdToCents(Number(this.config.priceUsd) + Number(this.config.cargoQuarterUsd));
        const halfPriceCents = this.usdToCents(Number(this.config.priceUsd) + Number(this.config.cargoHalfUsd));
        const fullPriceCents = this.usdToCents(Number(this.config.priceUsd));

        return [
          {
            key: 'retail',
            label: '1 - 3 unidades',
            min: 1,
            max: 3,
            representativeQty: 1,
            unitPriceCents: this.basePriceCents,
            discountLabel: '—',
          },
          {
            key: 'quarter',
            label: `4 - ${this.quarterMax} unidades`,
            min: 4,
            max: this.quarterMax,
            representativeQty: this.quarterMax,
            unitPriceCents: quarterPriceCents,
            discountLabel: this.discountLabel(quarterPriceCents),
          },
          {
            key: 'half',
            label: `${this.quarterMax + 1} - ${this.halfMax} unidades`,
            min: this.quarterMax + 1,
            max: this.halfMax,
            representativeQty: this.halfMax,
            unitPriceCents: halfPriceCents,
            discountLabel: this.discountLabel(halfPriceCents),
          },
          {
            key: 'full',
            label: `${this.halfMax + 1}+ unidades`,
            min: this.halfMax + 1,
            max: Infinity,
            representativeQty: Number(this.config.unitsPerBox) || this.halfMax + 1,
            unitPriceCents: fullPriceCents,
            discountLabel: this.discountLabel(fullPriceCents),
          },
        ];
      }

      getBandForQuantity(quantity) {
        return this.bands.find((band) => quantity >= band.min && quantity <= band.max) || this.bands[this.bands.length - 1];
      }

      discountLabel(unitPriceCents) {
        if (!this.basePriceCents || unitPriceCents >= this.basePriceCents) return '—';
        const discount = Math.max(0, Math.round((1 - unitPriceCents / this.basePriceCents) * 100));
        return `${discount}% OFF`;
      }

      usdToCents(usdValue) {
        const rate = this.rateValue;
        return Math.round(Number(usdValue || 0) * rate * 100);
      }

      formatMoney(cents) {
        if (!this.formatter) {
          this.formatter = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: this.config.currencyCode || 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }

        return this.formatter.format((Number(cents) || 0) / 100);
      }

      renderBandPreview() {
        const bands = this.bands;
        bands.forEach((band) => {
          const row = this.bandRows.find((item) => item.dataset.band === band.key);
          if (!row) return;

          row.querySelector('[data-band-label]').textContent = band.label;
          row.querySelector('[data-band-unit-price]').textContent = this.formatMoney(band.unitPriceCents);
          row.querySelector('[data-band-discount]').textContent = band.discountLabel;
          row.querySelector('[data-band-total]').textContent = this.formatMoney(band.unitPriceCents * band.representativeQty);
        });

        if (this.rateDisplay) {
          this.rateDisplay.textContent = this.formatMoney(this.rateValue * 100);
        }
      }

      render() {
        const quantity = this.quantity;
        const activeBand = this.getBandForQuantity(quantity);
        const selectedUnitCents = activeBand.unitPriceCents;
        const selectedTotalCents = selectedUnitCents * quantity;
        const savingsCents = Math.max(0, (this.basePriceCents - selectedUnitCents) * quantity);
        const savingsPercent = this.basePriceCents > 0 ? Math.max(0, Math.round((savingsCents / (this.basePriceCents * quantity)) * 100)) : 0;

        this.bandRows.forEach((row) => {
          row.classList.toggle('is-active', row.dataset.band === activeBand.key);
        });

        if (this.selectedUnitDisplay) {
          this.selectedUnitDisplay.textContent = this.formatMoney(selectedUnitCents);
        }

        if (this.selectedTotalDisplay) {
          this.selectedTotalDisplay.textContent = this.formatMoney(selectedTotalCents);
        }

        if (this.savingsDisplay) {
          this.savingsDisplay.textContent = savingsCents > 0
            ? `${this.formatMoney(savingsCents)} (${savingsPercent}%)`
            : '—';
        }
      }
    }
  );
}
