if (!customElements.get('image-categories')) {
  customElements.define('image-categories', class extends HTMLElement {
    connectedCallback() {
      this.initializationFrame = requestAnimationFrame(() => this.initialize());
    }

    initialize() {
      this.viewport = this.querySelector('[data-category-viewport]');
      if (!this.viewport) return;
      this.controls = this.querySelector('[data-category-controls]');
      this.buttons = [...this.querySelectorAll('[data-category-direction]')];
      this.events = new AbortController();
      const options = { signal: this.events.signal };
      this.buttons.forEach((button) => {
        button.addEventListener('click', () => {
          this.move(Number(button.dataset.categoryDirection));
        }, options);
      });
      this.viewport.addEventListener('scroll', () => this.update(), { ...options, passive: true });
      this.viewport.addEventListener('keydown', (event) => {
        if (event.target !== this.viewport || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          this.move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }, options);
      this.addEventListener('shopify:block:select', (event) => {
        const item = event.target.closest('.image-categories__item');
        if (!item) return;
        const itemRect = item.getBoundingClientRect();
        const viewportRect = this.viewport.getBoundingClientRect();
        this.viewport.scrollBy({
          left: itemRect.left - viewportRect.left - (viewportRect.width - itemRect.width) / 2,
          behavior: 'instant',
        });
      }, options);
      this.resizeObserver = new ResizeObserver(() => this.update());
      this.resizeObserver.observe(this.viewport);
      this.resizeObserver.observe(this.querySelector('.image-categories__list'));
      this.update();
    }

    move(direction) {
      this.viewport.scrollBy({
        left: direction * this.viewport.clientWidth * 0.75,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }

    update() {
      const overflowing = this.viewport.scrollWidth > this.viewport.clientWidth + 2;
      if (this.controls) this.controls.hidden = !overflowing;
      this.viewport.tabIndex = overflowing ? 0 : -1;
      const bounds = this.viewport.getBoundingClientRect();
      const list = this.querySelector('.image-categories__list').getBoundingClientRect();
      this.buttons.forEach((button) => {
        button.disabled = Number(button.dataset.categoryDirection) < 0
          ? list.left >= bounds.left - 2
          : list.right <= bounds.right + 2;
      });
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.initializationFrame);
      this.events?.abort();
      this.resizeObserver?.disconnect();
    }
  });
}
