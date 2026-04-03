document.addEventListener('DOMContentLoaded', () => {
  const menus = Array.from(document.querySelectorAll('.sector-menu-card'));

  if (!menus.length) {
    return;
  }

  menus.forEach((menu) => {
    const actionableItems = menu.querySelectorAll('.sector-menu-list button, .sector-menu-list a');

    actionableItems.forEach((item) => {
      item.addEventListener('click', () => {
        menu.removeAttribute('open');
      });
    });
  });

  document.addEventListener('click', (event) => {
    const clickedMenu = event.target.closest('.sector-menu-card');

    menus.forEach((menu) => {
      if (clickedMenu && menu === clickedMenu) {
        return;
      }

      menu.removeAttribute('open');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    menus.forEach((menu) => menu.removeAttribute('open'));
  });
});
