(() => {
  if (window.compraboxQuotePricing) return;

  const minimum = 3;
  const fallbackRate = 1550;
  const rateKey = 'comprabox.quote.blue-sell';
  const formatters = new Map();
  let rateRequest;

  function numeric(value) {
    return typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
  }

  function boxUnits(pricing) {
    const units = numeric(pricing?.boxUnits);
    return Number.isSafeInteger(units) && units > 0 ? units : 0;
  }

  function usesTiers(pricing) {
    if (!boxUnits(pricing)) return false;
    const [base, quarter, half] = [pricing.baseUsd, pricing.quarterUsd, pricing.halfUsd].map(numeric);
    return [base, quarter, half].every(Number.isFinite) && base > 0 && quarter >= 0 && half >= 0;
  }

  function validRate(rate) {
    return Number.isFinite(rate) && rate > 0;
  }

  async function fetchRate() {
    try {
      const saved = Number(sessionStorage.getItem(rateKey));
      if (validRate(saved)) return saved;
    } catch (_) { /* Storage can be unavailable. */ }

    let rate = fallbackRate;
    try {
      const response = await fetch('https://api.bluelytics.com.ar/v2/latest', {
        cache: 'no-store', signal: AbortSignal.timeout(4000),
      });
      if (response.ok) {
        const current = Number((await response.json())?.blue?.value_sell);
        if (validRate(current)) rate = current;
      }
    } catch (_) { /* Keep the reference rate if the feed cannot be reached. */ }
    try { sessionStorage.setItem(rateKey, String(rate)); } catch (_) { /* The line can still retain its rate. */ }
    return rate;
  }

  function calculate(item, quantity, rate) {
    const { pricing } = item;
    let unitPrice = item.price;
    let currency = item.currency;
    if (usesTiers(pricing)) {
      const box = boxUnits(pricing);
      const charge = quantity >= box ? 0 : quantity >= Math.ceil(box / 2) ? pricing.halfUsd : pricing.quarterUsd;
      unitPrice = Math.round((numeric(pricing.baseUsd) + numeric(charge)) * (validRate(rate) ? rate : fallbackRate) * 100);
      currency = 'ARS';
    }
    const total = unitPrice * quantity;
    return Number.isSafeInteger(total) && total >= 0 ? { unitPrice, total, currency } : null;
  }

  function money(cents, currency) {
    if (!formatters.has(currency)) {
      formatters.set(currency, new Intl.NumberFormat('es-AR', { style: 'currency', currency }));
    }
    return formatters.get(currency).format(cents / 100);
  }

  window.compraboxQuotePricing = {
    minimum, fallbackRate, boxUnits, usesTiers, validRate, calculate, money,
    getRate: () => (rateRequest ??= fetchRate()),
  };
})();
