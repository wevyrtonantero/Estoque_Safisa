(() => {
  if (window.__safisaNumberInputWheelGuard) {
    return;
  }

  window.__safisaNumberInputWheelGuard = true;

  document.addEventListener('wheel', (event) => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement
      && String(activeElement.type || '').toLowerCase() === 'number'
      && event.target === activeElement
    ) {
      activeElement.blur();
    }
  }, { capture: true, passive: true });
})();
