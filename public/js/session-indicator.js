document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return;
    }

    const result = await response.json();
    if (!result?.authenticated || !result.user) {
      return;
    }

    const indicator = buildSessionIndicator(result.user);
    const host = resolveIndicatorHost();
    if (!host || host.querySelector('.session-indicator')) {
      return;
    }

    host.appendChild(indicator);
  } catch (error) {
    // Indicador auxiliar: nao deve quebrar a pagina.
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', handleRowMenuDirection);
  document.addEventListener('toggle', handleRowMenuToggle, true);
  window.addEventListener('resize', repositionOpenRowMenu);
  window.addEventListener('scroll', repositionOpenRowMenu, true);
});

// Desativa sugestoes do navegador (autocomplete/historico) nos campos do sistema.
// Mantem atributos existentes (ex.: username/new-password) e nao toca em password.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form:not([autocomplete])').forEach((form) => {
    form.setAttribute('autocomplete', 'off');
  });

  document.querySelectorAll('input').forEach((input) => {
    const type = String(input.getAttribute('type') || 'text').toLowerCase();

    if (type === 'password') {
      return;
    }

    if (!input.hasAttribute('autocomplete')) {
      input.setAttribute('autocomplete', 'off');
    }

    if (!input.hasAttribute('autocapitalize')) {
      input.setAttribute('autocapitalize', 'off');
    }

    if (type === 'text' && !input.hasAttribute('spellcheck')) {
      input.setAttribute('spellcheck', 'false');
    }
  });
});

function resolveIndicatorHost() {
  const topbarActions = document.querySelector('.topbar-actions');
  if (topbarActions) {
    return topbarActions;
  }

  const topbar = document.querySelector('.topbar');
  if (topbar) {
    return topbar;
  }

  const portalShell = document.querySelector('.portal-shell');
  if (portalShell) {
    return portalShell;
  }

  return null;
}

function buildSessionIndicator(user) {
  const wrapper = document.createElement('div');
  wrapper.className = 'session-indicator';
  wrapper.title = `Logado como ${user.nome || user.login} (${formatRole(user.role)})`;

  const dot = document.createElement('span');
  dot.className = 'session-indicator-dot';
  dot.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('div');
  copy.className = 'session-indicator-copy';

  const label = document.createElement('span');
  label.className = 'session-indicator-label';
  label.textContent = 'Online';

  const name = document.createElement('strong');
  name.className = 'session-indicator-name';
  name.textContent = user.nome || user.login || 'Usuario';

  const role = document.createElement('span');
  role.className = 'session-indicator-role';
  role.textContent = `${user.login || '-'} · ${formatRole(user.role)}`;

  copy.append(label, name, role);
  wrapper.append(dot, copy);

  return wrapper;
}

function formatRole(role) {
  const labels = {
    OPERACAO: 'Operacao',
    ADM: 'ADM',
    GESTOR: 'Gestor',
    SUPERADMIN: 'Superadmin'
  };

  return labels[role] || role || '-';
}

function handleRowMenuDirection(event) {
  const trigger = event.target.closest('.row-menu-trigger');

  if (!trigger) {
    window.requestAnimationFrame(clearClosedDropUpMenus);
    return;
  }

  const menu = trigger.closest('.row-menu');
  window.requestAnimationFrame(() => {
    clearClosedDropUpMenus();

    if (menu && menu.hasAttribute('open')) {
      adjustRowMenuDirection(menu);
    }
  });
}

function adjustRowMenuDirection(menu) {
  resetRowMenuPosition(menu);

  const trigger = menu.querySelector('.row-menu-trigger');
  const panel = menu.querySelector('.row-menu-panel');
  if (!trigger || !panel) {
    return;
  }

  const triggerRect = trigger.getBoundingClientRect();
  const viewportPadding = 10;
  const gap = 8;
  const panelWidth = Math.max(panel.offsetWidth || 176, 176);
  const fullPanelHeight = Math.max(panel.scrollHeight || panel.offsetHeight || 180, 48);
  const spaceBelow = window.innerHeight - triggerRect.bottom - gap - viewportPadding;
  const spaceAbove = triggerRect.top - gap - viewportPadding;
  const shouldOpenUp = spaceBelow < Math.min(fullPanelHeight, 160) && spaceAbove > spaceBelow;
  const availableSpace = shouldOpenUp ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(96, Math.min(fullPanelHeight, availableSpace));
  const top = shouldOpenUp
    ? Math.max(viewportPadding, triggerRect.top - gap - maxHeight)
    : Math.min(window.innerHeight - viewportPadding - maxHeight, triggerRect.bottom + gap);
  const left = Math.min(
    window.innerWidth - viewportPadding - panelWidth,
    Math.max(viewportPadding, triggerRect.right - panelWidth)
  );

  menu.classList.add('is-fixed');
  if (shouldOpenUp) {
    menu.classList.add('drop-up');
  }
  menu.style.setProperty('--row-menu-top', `${Math.max(viewportPadding, top)}px`);
  menu.style.setProperty('--row-menu-left', `${Math.max(viewportPadding, left)}px`);
  menu.style.setProperty('--row-menu-max-height', `${maxHeight}px`);
}

function clearClosedDropUpMenus() {
  document.querySelectorAll('.row-menu.drop-up:not([open]), .row-menu.is-fixed:not([open])').forEach((menu) => {
    resetRowMenuPosition(menu);
  });
}

function handleRowMenuToggle(event) {
  const menu = event.target.closest?.('.row-menu');
  if (!menu) {
    return;
  }

  if (!menu.hasAttribute('open')) {
    resetRowMenuPosition(menu);
    return;
  }

  window.requestAnimationFrame(() => adjustRowMenuDirection(menu));
}

function repositionOpenRowMenu() {
  const menu = document.querySelector('.row-menu[open]');
  if (!menu) {
    return;
  }

  window.requestAnimationFrame(() => {
    if (menu.hasAttribute('open')) {
      adjustRowMenuDirection(menu);
    }
  });
}

function resetRowMenuPosition(menu) {
  menu.classList.remove('drop-up', 'is-fixed');
  menu.style.removeProperty('--row-menu-top');
  menu.style.removeProperty('--row-menu-left');
  menu.style.removeProperty('--row-menu-max-height');
}
