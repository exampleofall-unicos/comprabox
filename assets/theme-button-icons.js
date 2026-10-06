(() => {
  const mode = document.currentScript?.dataset.buttonIconMode || 'none';
  const selector = '.button, button[type="submit"], [data-button-icon]';
  const templates = {
    default: document.getElementById('ThemeButtonDefaultIcon'),
    whatsapp: document.getElementById('ThemeButtonWhatsappIcon'),
  };
  const isWhatsapp = (button) => {
    try {
      const url = new URL(button.getAttribute('href'), location.href);
      return url.protocol === 'whatsapp:' || ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com', 'www.whatsapp.com', 'whatsapp.com'].includes(url.hostname);
    } catch { return false; }
  };
  const update = (button) => {
    const existing = button.querySelector(':scope > .theme-button-icon');
    const choice = button.dataset.buttonIcon || 'inherit';
    // Leave icon-only controls, express payments and third-party payment widgets alone.
    const hasText = [...button.childNodes].some((node) =>
      !(node.nodeType === 1 && node.matches('.theme-button-icon, svg, .loading__spinner, .visually-hidden, [hidden], [aria-hidden="true"]')) && node.textContent.trim()
    );
    let type = null;
    if (hasText && !button.closest('.shopify-payment-button, shopify-accelerated-checkout, shopify-accelerated-checkout-cart')) {
      if (choice === 'whatsapp') type = 'whatsapp';
      else if (choice === 'custom') type = 'default';
      else if (choice !== 'none' && (mode === 'all' || (mode === 'whatsapp' && isWhatsapp(button)))) type = 'default';
    }
    if (existing?.dataset.iconType === type) return;
    existing?.remove();
    if (type && templates[type]) {
      const icon = templates[type].content.firstElementChild.cloneNode(true);
      icon.dataset.iconType = type;
      button.prepend(icon);
    }
  };
  const pending = new Set();
  let frame;
  const enqueue = (element) => {
    if (!(element instanceof Element)) return;
    const parentButton = element.closest(selector);
    if (parentButton) pending.add(parentButton);
    element.querySelectorAll(selector).forEach((button) => pending.add(button));
    if (!frame) frame = requestAnimationFrame(() => {
      frame = null;
      pending.forEach((button) => { if (button.isConnected) update(button); });
      pending.clear();
    });
  };
  enqueue(document.body);
  new MutationObserver((records) => {
    records.forEach((record) => {
      enqueue(record.target.nodeType === 1 ? record.target : record.target.parentElement);
    });
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'data-button-icon'] });
})();
