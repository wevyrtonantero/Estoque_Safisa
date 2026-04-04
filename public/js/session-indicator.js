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
