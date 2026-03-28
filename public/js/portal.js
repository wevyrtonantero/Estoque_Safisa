document.addEventListener('DOMContentLoaded', () => {
  const enterButton = document.getElementById('portal-enter-btn');

  if (!enterButton) {
    return;
  }

  enterButton.addEventListener('click', () => {
    const target = enterButton.dataset.enterLink || '/pagina-acesso';
    document.body.classList.add('portal-entering');
    enterButton.disabled = true;
    window.setTimeout(() => {
      window.location.href = target;
    }, 320);
  });
});
