(function initSafisaNotificationWidget(global) {
  const NOTIFICATIONS_API_URL = '/api/notificacoes';
  const MARK_READ_API_URL = (id) => `/api/notificacoes/${id}/lida`;
  const MARK_ALL_READ_API_URL = '/api/notificacoes/lidas';
  const POLL_INTERVAL_MS = 15000;
  const PREVIEW_LIMIT = 120;

  const state = {
    currentUser: null,
    notifications: [],
    unreadCount: 0,
    panelOpen: false,
    loading: false,
    initialized: false,
    pollHandle: null,
    knownIds: new Set(),
    browserNotifiedIds: new Set(),
    permissionAsked: false
  };

  let refs = null;

  function init(user) {
    if (!user?.id) {
      return;
    }

    state.currentUser = user;

    if (!refs) {
      refs = buildWidget();
      bindEvents();
    }

    loadNotifications({ silent: true, skipBrowserNotification: true }).catch(() => {});
    startPolling();
  }

  function buildWidget() {
    const container = document.createElement('div');
    container.className = 'notification-widget';
    container.innerHTML = `
      <button type="button" class="notification-widget-trigger" aria-label="Notificacoes" aria-expanded="false">
        <span class="notification-widget-icon" aria-hidden="true">${renderBellIcon()}</span>
        <span class="notification-widget-badge hidden">0</span>
      </button>

      <section class="notification-widget-panel hidden" aria-hidden="true">
        <header class="notification-widget-header">
          <div>
            <strong>Notificacoes</strong>
            <small>Atualizacoes operacionais</small>
          </div>
          <button type="button" class="notification-widget-clear">Marcar lidas</button>
        </header>
        <div class="notification-widget-list">
          <div class="notification-widget-empty">Carregando notificacoes...</div>
        </div>
      </section>
    `;

    const host = resolveHost();
    host.appendChild(container);

    return {
      root: container,
      trigger: container.querySelector('.notification-widget-trigger'),
      badge: container.querySelector('.notification-widget-badge'),
      panel: container.querySelector('.notification-widget-panel'),
      clear: container.querySelector('.notification-widget-clear'),
      list: container.querySelector('.notification-widget-list')
    };
  }

  function resolveHost() {
    const topbar = document.querySelector('.workspace > .topbar');
    if (!topbar) {
      return document.body;
    }

    const existingActions = Array.from(topbar.children).find((child) => child.classList?.contains('topbar-actions'));
    if (existingActions) {
      return existingActions;
    }

    const actions = document.createElement('div');
    actions.className = 'topbar-actions topbar-actions-session';
    topbar.appendChild(actions);
    return actions;
  }

  function bindEvents() {
    refs.trigger.addEventListener('click', () => {
      togglePanel();
      maybeRequestNotificationPermission();
    });
    refs.clear.addEventListener('click', markAllAsRead);
    refs.list.addEventListener('click', handleNotificationClick);

    document.addEventListener('click', (event) => {
      if (state.panelOpen && refs.root && !refs.root.contains(event.target)) {
        closePanel();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        loadNotifications({ silent: true, skipBrowserNotification: true }).catch(() => {});
      }
    });
  }

  function togglePanel() {
    if (state.panelOpen) {
      closePanel();
      return;
    }

    openPanel();
  }

  function openPanel() {
    state.panelOpen = true;
    refs.trigger.setAttribute('aria-expanded', 'true');
    refs.panel.classList.remove('hidden');
    refs.panel.setAttribute('aria-hidden', 'false');
    loadNotifications({ silent: true, skipBrowserNotification: true }).catch(() => {});
  }

  function closePanel() {
    state.panelOpen = false;
    refs.trigger.setAttribute('aria-expanded', 'false');
    refs.panel.classList.add('hidden');
    refs.panel.setAttribute('aria-hidden', 'true');
  }

  async function loadNotifications(options = {}) {
    if (state.loading) {
      return;
    }

    state.loading = true;

    try {
      const result = await requestJson(`${NOTIFICATIONS_API_URL}?limit=20`);
      const notifications = Array.isArray(result.notificacoes) ? result.notificacoes : [];
      const previousKnownIds = new Set(state.knownIds);

      state.notifications = notifications;
      state.unreadCount = Number(result.nao_lidas || 0);
      notifications.forEach((notification) => state.knownIds.add(Number(notification.id)));

      renderBadge();
      renderNotifications();

      if (state.initialized && !options.skipBrowserNotification) {
        notifyNewItems(notifications, previousKnownIds);
      }

      state.initialized = true;
    } catch (error) {
      if (!options.silent) {
        refs.list.innerHTML = `<div class="notification-widget-empty">${escapeHtml(error.message)}</div>`;
      }
    } finally {
      state.loading = false;
    }
  }

  function renderBadge() {
    refs.badge.textContent = String(state.unreadCount);
    refs.badge.classList.toggle('hidden', state.unreadCount === 0);
  }

  function renderNotifications() {
    refs.clear.disabled = state.unreadCount === 0;

    if (!state.notifications.length) {
      refs.list.innerHTML = '<div class="notification-widget-empty">Nenhuma notificacao por enquanto.</div>';
      return;
    }

    refs.list.innerHTML = state.notifications.map((notification) => `
      <button
        type="button"
        class="notification-widget-item ${notification.lida ? 'is-read' : 'is-unread'}"
        data-notification-id="${notification.id}"
      >
        <span class="notification-widget-item-dot" aria-hidden="true"></span>
        <span class="notification-widget-item-copy">
          <strong>${escapeHtml(notification.titulo || 'Notificacao')}</strong>
          <span>${escapeHtml(truncateText(notification.mensagem || '', PREVIEW_LIMIT))}</span>
          <time>${escapeHtml(formatDateTime(notification.created_at))}</time>
        </span>
      </button>
    `).join('');
  }

  function notifyNewItems(notifications, previousKnownIds) {
    notifications
      .filter((notification) => !notification.lida)
      .filter((notification) => !previousKnownIds.has(Number(notification.id)))
      .forEach((notification) => showBrowserNotification(notification));
  }

  function showBrowserNotification(notification) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const notificationId = Number(notification.id);
    if (state.browserNotifiedIds.has(notificationId)) {
      return;
    }

    state.browserNotifiedIds.add(notificationId);

    try {
      const browserNotification = new Notification(notification.titulo || 'Nova notificacao', {
        body: truncateText(notification.mensagem || '', PREVIEW_LIMIT),
        tag: `safisa-notificacao-${notification.id}`,
        renotify: true,
        requireInteraction: true
      });

      browserNotification.onclick = () => {
        window.focus();
        markAsRead(notification.id).catch(() => {});
        if (notification.link) {
          window.location.href = notification.link;
        }
        browserNotification.close();
      };
    } catch (error) {
      // Notificacao do navegador e auxiliar.
    }
  }

  async function handleNotificationClick(event) {
    const item = event.target.closest('button[data-notification-id]');
    if (!item) {
      return;
    }

    const notificationId = Number(item.dataset.notificationId);
    const notification = state.notifications.find((entry) => Number(entry.id) === notificationId);
    await markAsRead(notificationId).catch(() => {});

    if (notification?.link) {
      window.location.href = notification.link;
    }
  }

  async function markAsRead(notificationId) {
    await requestJson(MARK_READ_API_URL(notificationId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const notification = state.notifications.find((entry) => Number(entry.id) === Number(notificationId));
    if (notification && !notification.lida) {
      notification.lida = true;
      notification.lida_em = new Date().toISOString();
      state.unreadCount = Math.max(0, state.unreadCount - 1);
      renderBadge();
      renderNotifications();
    }
  }

  async function markAllAsRead() {
    await requestJson(MARK_ALL_READ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    state.notifications.forEach((notification) => {
      notification.lida = true;
      notification.lida_em = notification.lida_em || new Date().toISOString();
    });
    state.unreadCount = 0;
    renderBadge();
    renderNotifications();
  }

  function startPolling() {
    if (state.pollHandle) {
      return;
    }

    state.pollHandle = window.setInterval(() => {
      loadNotifications({ silent: true, skipBrowserNotification: false }).catch(() => {});
    }, POLL_INTERVAL_MS);
  }

  function maybeRequestNotificationPermission() {
    if (!('Notification' in window) || state.permissionAsked || Notification.permission !== 'default') {
      return;
    }

    state.permissionAsked = true;
    Notification.requestPermission().catch(() => {});
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel processar a notificacao.');
    }

    return result;
  }

  function formatDateTime(value) {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function truncateText(value, limit) {
    const text = String(value || '').trim();
    if (text.length <= limit) {
      return text;
    }

    return `${text.slice(0, Math.max(0, limit - 1)).trim()}...`;
  }

  function renderBellIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  global.SafisaNotificationWidget = {
    init
  };

  if (global.SafisaCurrentUser?.id) {
    init(global.SafisaCurrentUser);
  }
})(window);
