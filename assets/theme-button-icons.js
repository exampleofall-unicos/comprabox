(() => {
  const mode = document.currentScript?.dataset.buttonIconMode || 'none';
  const defaults = document.currentScript?.dataset || {};
  const allowLocalStyles = defaults.buttonLocalStyles === 'true';
  document.documentElement.dataset.themeButtonMotion = defaults.buttonMotion || 'subtle';
  const selector = '.button, button, [data-button-icon], [data-button-icon-image], [role="button"], .header__icon';
  const excluded = '.shopify-app-block, .shopify-payment-button, .additional-checkout-buttons, shopify-accelerated-checkout, shopify-accelerated-checkout-cart';
  const controls = '.quantity__button, .slider-button, .slider-counter__link, .slideshow__autoplay, .order-calculator__stepper-button';
  const templates = {
    default: document.getElementById('ThemeButtonDefaultIcon'),
    whatsapp: document.getElementById('ThemeButtonWhatsappIcon'),
  };
  const isWhatsapp = (button) => {
    const href = button.getAttribute('href');
    if (!href) return false;
    try {
      const url = new URL(href, location.href);
      return url.protocol === 'whatsapp:' || ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com', 'www.whatsapp.com', 'whatsapp.com'].includes(url.hostname);
    } catch { return false; }
  };
  const hasText = (button) => {
    const label = button.cloneNode(true);
    label.querySelectorAll('.theme-button-icon, svg, .svg-wrapper, .loading__spinner, .visually-hidden, [hidden], [aria-hidden="true"]').forEach((node) => node.remove());
    return Boolean(label.textContent.trim());
  };
  const update = (button) => {
    if (!button.matches('a, button, summary, [role="button"]')) return;
    if (button.closest(excluded)) return;
    button.classList.add('theme-button-managed');
    const existing = button.querySelector(':scope > .theme-button-icon');
    const choice = button.dataset.buttonIcon || 'inherit';
    const section = button.closest('.shopify-section');
    const scope = section?.querySelector('template[data-theme-button-scope]');
    const ownPosition = allowLocalStyles ? button.dataset.buttonIconPosition : null;
    const sectionPosition = allowLocalStyles ? scope?.dataset.iconPosition : null;
    const position = (ownPosition && ownPosition !== 'inherit' ? ownPosition : null)
      || (sectionPosition && sectionPosition !== 'inherit' ? sectionPosition : null)
      || defaults.buttonIconPosition || 'left';
    const color = (allowLocalStyles && (button.dataset.buttonTextColor || scope?.dataset.textColor)) || defaults.buttonTextColor || '';
    button.classList.toggle('theme-button-custom-color', Boolean(color));
    if (color) button.style.setProperty('--theme-button-text-color', color);
    else button.style.removeProperty('--theme-button-text-color');
    const placeIcon = (icon) => {
      icon.dataset.side = position;
      if (position === 'right') {
        if (button.lastChild !== icon) button.append(icon);
      } else if (button.firstChild !== icon) button.prepend(icon);
    };
    const image = button.dataset.buttonIconImage || scope?.dataset.iconImage || '';
    const textButton = !button.matches('.header__icon') && hasText(button);
    const globalImage = templates.default?.content.querySelector('img');
    // Dawn newsletter/search submit buttons use an accessible label and an SVG.
    const imageSubmit = button.matches('button, [role="button"], .header__icon') && (image || (mode === 'all' && globalImage));
    let type = null;
    if (choice !== 'none' && (!button.matches(controls) || image || (mode === 'all' && globalImage)) && (textButton || imageSubmit)) {
      if (image) type = 'image';
      else if (choice === 'whatsapp') type = 'whatsapp';
      else if (choice === 'custom' || mode === 'all' || (mode === 'whatsapp' && isWhatsapp(button))) type = 'default';
    }
    button.classList.toggle('theme-button-icon-only', Boolean(type && !textButton));
    const key = type === 'image' ? image : type;
    const size = allowLocalStyles && image && scope ? `${scope.dataset.iconSize || 18}px` : '';
    if (existing && existing.dataset.iconKey === key) {
      existing.style.setProperty('--theme-button-icon-size', size);
      placeIcon(existing);
      return;
    }
    existing?.remove();
    if (!type) return;
    // Use <i>, not <span>: Dawn finds the first span to update add-to-cart labels.
    const icon = document.createElement('i');
    icon.className = 'theme-button-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.dataset.iconKey = key;
    if (size) icon.style.setProperty('--theme-button-icon-size', size);
    if (type === 'image') {
      const img = document.createElement('img');
      img.src = image;
      img.alt = '';
      img.width = 40;
      img.height = 40;
      img.decoding = 'async';
      icon.append(img);
    } else {
      const source = templates[type]?.content.firstElementChild;
      if (!source) return;
      [...source.childNodes].forEach((node) => icon.append(node.cloneNode(true)));
    }
    placeIcon(icon);
  };
  const pending = new Set();
  let frame;
  const enqueue = (element) => {
    if (!(element instanceof Element)) return;
    if (element.matches('template[data-theme-button-scope]')) element = element.closest('.shopify-section') || element;
    const parentButton = element.closest(selector);
    if (parentButton) pending.add(parentButton);
    element.querySelectorAll(selector).forEach((button) => pending.add(button));
    if (!frame) frame = requestAnimationFrame(() => {
      frame = null;
      pending.forEach((button) => { if (button.isConnected) update(button); });
      pending.clear();
    });
  };
  // Apply the first pass immediately; later DOM/editor changes are batched.
  document.querySelectorAll(selector).forEach(update);
  document.addEventListener('shopify:section:load', (event) => enqueue(event.target));
  new MutationObserver((records) => {
    records.forEach((record) => enqueue(record.target.nodeType === 1 ? record.target : record.target.parentElement));
  }).observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['type', 'href', 'data-button-icon', 'data-button-icon-image', 'data-icon-image', 'data-icon-size', 'data-button-icon-position', 'data-button-text-color', 'data-icon-position', 'data-text-color'],
  });
})();
