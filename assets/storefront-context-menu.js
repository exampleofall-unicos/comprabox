// Suppress the storefront context menu, including dynamically inserted content.
// This is a UI restriction, not protection against copying or downloading assets.
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
}, { capture: true });
