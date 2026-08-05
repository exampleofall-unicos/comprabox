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
        this.arsFormatter = null;
        this.usdFormatter = null;
      }

      connectedCallback() {
        this.config = this.readConfig();
        this.basePriceCents = Number(this.config.basePriceCents) || 0;
        this.quantityInput = this.querySelector('[data-quantity-input]');
        this.rateDisplay = this.querySelector('[data-rate-display]');
        this.savingsDisplay = this.querySelector('[data-savings]');
        this.selectedUnitDisplay = this.querySelector('[data-selected-unit]');
        this.selectedTotalUsdDisplay = this.querySelector('[data-selected-total-usd]');
        this.selectedTotalDisplay = this.querySelector('[data-selected-total]');
        this.whatsappLink = this.querySelector('[data-whatsapp-link]');
        this.bandRows = Array.from(this.querySelectorAll('[data-band]'));

        this.quantityInput?.addEventListener('input', this.handleQuantityChange.bind(this));
        this.quantityInput?.addEventListener('change', this.handleQuantityChange.bind(this));
        this.quantityInput?.addEventListener('focus', this.handleQuantityFocus.bind(this));

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
        this.renderBandPreview();
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
        const rawValue = String(event.currentTarget.value || '').trim();
        const normalizedValue = rawValue.replace(/[^\d]/g, '');

        if (!normalizedValue) {
          if (rawValue !== '') {
            event.currentTarget.value = '';
          }
          this.render();
          return;
        }

        const parsedValue = Math.floor(Number(normalizedValue));
        if (!Number.isFinite(parsedValue)) {
          event.currentTarget.value = '';
          this.render();
          return;
        }

        const nextValue = Math.min(5000, Math.max(0, parsedValue));
        if (String(nextValue) !== normalizedValue) {
          event.currentTarget.value = String(nextValue);
        }

        this.render();
      }

      handleQuantityFocus(event) {
        if (String(event.currentTarget.value) === '1') {
          event.currentTarget.select();
        }
      }

      get quantity() {
        const value = String(this.quantityInput?.value || '').trim();
        const normalizedValue = value.replace(/[^\d]/g, '');
        if (!normalizedValue) return 0;

        const parsedValue = Math.floor(Number(normalizedValue));
        if (!Number.isFinite(parsedValue)) return 0;

        return Math.min(5000, Math.max(0, parsedValue));
      }

      get rateValue() {
        return Number(this.rate) || Number(this.config.fallbackRate) || 0;
      }

      get quarterMax() {
        const unitsPerBox = Math.max(0, Math.floor(Number(this.config.unitsPerBox) || 0));
        return Math.max(5, Math.floor(unitsPerBox / 4));
      }

      get halfMax() {
        const unitsPerBox = Math.max(0, Math.floor(Number(this.config.unitsPerBox) || 0));
        return Math.max(this.quarterMax + 1, unitsPerBox - 1);
      }

      get bands() {
        const unitsPerBox = Math.max(1, Math.floor(Number(this.config.unitsPerBox) || 0));
        const retailPriceUsdCents = this.centsToUsdCents(this.basePriceCents);
        const quarterUnitUsdCents = this.usdAmountToCents(Number(this.config.priceUsd) + Number(this.config.cargoQuarterUsd));
        const halfUnitUsdCents = this.usdAmountToCents(Number(this.config.priceUsd) + Number(this.config.cargoHalfUsd));
        const fullUnitUsdCents = this.usdAmountToCents(Number(this.config.priceUsd));
        const quarterUnitPriceCents = this.usdToCents(Number(this.config.priceUsd) + Number(this.config.cargoQuarterUsd));
        const halfUnitPriceCents = this.usdToCents(Number(this.config.priceUsd) + Number(this.config.cargoHalfUsd));
        const fullUnitPriceCents = this.usdToCents(Number(this.config.priceUsd));

        return [
          {
            key: 'retail',
            label: '1 - 5 unidades',
            min: 1,
            max: 5,
            unitPriceCents: this.basePriceCents,
            unitPriceUsdCents: retailPriceUsdCents,
            discountLabel: '-',
          },
          {
            key: 'quarter',
            label: `5 - ${this.quarterMax} unidades`,
            min: 5,
            max: this.quarterMax,
            unitPriceCents: quarterUnitPriceCents,
            unitPriceUsdCents: quarterUnitUsdCents,
            discountLabel: this.discountLabel(quarterUnitPriceCents),
          },
          {
            key: 'half',
            label: `${this.quarterMax + 1} - ${this.halfMax} unidades`,
            min: this.quarterMax + 1,
            max: this.halfMax,
            unitPriceCents: halfUnitPriceCents,
            unitPriceUsdCents: halfUnitUsdCents,
            discountLabel: this.discountLabel(halfUnitPriceCents),
          },
          {
            key: 'full',
            label: `${unitsPerBox}+ unidades`,
            min: unitsPerBox,
            max: Infinity,
            unitPriceCents: fullUnitPriceCents,
            unitPriceUsdCents: fullUnitUsdCents,
            discountLabel: this.discountLabel(fullUnitPriceCents),
          },
        ];
      }

      getBandForQuantity(quantity) {
        if (quantity <= 0) return this.bands[0];
        return this.bands.find((band) => quantity >= band.min && quantity <= band.max) || this.bands[this.bands.length - 1];
      }

      discountLabel(unitPriceCents) {
        if (!this.basePriceCents || unitPriceCents >= this.basePriceCents) return '-';
        const discount = Math.max(0, Math.round((1 - unitPriceCents / this.basePriceCents) * 100));
        return `${discount}% OFF`;
      }

      usdAmountToCents(usdValue) {
        return Math.round(Number(usdValue || 0) * 100);
      }

      usdToCents(usdValue) {
        const rate = this.rateValue;
        return Math.round(Number(usdValue || 0) * rate * 100);
      }

      centsToUsdCents(arsCents) {
        const rate = this.rateValue;
        if (!rate) return 0;
        return Math.round(Number(arsCents || 0) / rate);
      }

      formatMoney(cents) {
        if (!this.arsFormatter) {
          this.arsFormatter = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: this.config.currencyCode || 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }

        return this.arsFormatter.format((Number(cents) || 0) / 100);
      }

      formatUsdMoney(cents) {
        if (!this.usdFormatter) {
          this.usdFormatter = new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }

        return `USD $ ${this.usdFormatter.format((Number(cents) || 0) / 100)}`;
      }

      getWhatsappPhoneNumber() {
        return String(this.config.whatsappNumber || '5491157998355').replace(/\D/g, '');
      }

      getWhatsappUrl(message) {
        const phoneNumber = this.getWhatsappPhoneNumber();
        const text = encodeURIComponent(message);
        const useWeb = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 750px)')?.matches;

        if (useWeb) {
          return `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${text}`;
        }

        return `https://wa.me/${phoneNumber}?text=${text}`;
      }

      renderBandPreview() {
        this.bands.forEach((band) => {
          const row = this.bandRows.find((item) => item.dataset.band === band.key);
          if (!row) return;

          row.querySelector('[data-band-label]').textContent = band.label;
          row.querySelector('[data-band-unit-price]').textContent = this.formatMoney(band.unitPriceCents);
          row.querySelector('[data-band-unit-price-usd]').textContent = this.formatUsdMoney(band.unitPriceUsdCents);
          row.querySelector('[data-band-discount]').textContent = band.discountLabel;
        });

        if (this.rateDisplay) {
          this.rateDisplay.textContent = this.formatUsdMoney(this.rateValue * 100);
        }
      }

      render() {
        const quantity = this.quantity;
        const activeBand = this.getBandForQuantity(quantity);
        const selectedUnitCents = activeBand.unitPriceCents;
        const selectedUnitUsdCents = activeBand.unitPriceUsdCents;
        const selectedTotalCents = selectedUnitCents * quantity;
        const selectedTotalUsdCents = selectedUnitUsdCents * quantity;
        const savingsCents = Math.max(0, (this.basePriceCents - selectedUnitCents) * quantity);
        const savingsPercent = this.basePriceCents > 0 ? Math.max(0, Math.round((savingsCents / (this.basePriceCents * quantity)) * 100)) : 0;

        this.bandRows.forEach((row) => {
          row.classList.toggle('is-active', row.dataset.band === activeBand.key);
        });

        if (this.selectedUnitDisplay) {
          this.selectedUnitDisplay.textContent = this.formatMoney(selectedUnitCents);
        }

        if (this.selectedTotalUsdDisplay) {
          this.selectedTotalUsdDisplay.textContent = `( ${this.formatUsdMoney(selectedTotalUsdCents)} )`;
        }

        if (this.selectedTotalDisplay) {
          this.selectedTotalDisplay.textContent = this.formatMoney(selectedTotalCents);
        }

        if (this.savingsDisplay) {
          this.savingsDisplay.textContent = savingsCents > 0 ? `${this.formatMoney(savingsCents)} (${savingsPercent}%)` : '-';
        }

        if (this.whatsappLink) {
          const productTitle = this.config.productTitle || 'este producto';
          const message = `Hola quisiera avanzar con el pedido de ${quantity} unidades del producto ${productTitle}, mi presupuesto en comprabox.com.ar fue de ${this.formatUsdMoney(selectedTotalUsdCents)}. Muchas gracias!`;
          this.whatsappLink.href = this.getWhatsappUrl(message);
        }
      }
    }
  );
}
// The link always uses wa.me to avoid the api.whatsapp redirect issue.
