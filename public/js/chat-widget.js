(function initSafisaChatWidget(global) {
  const USERS_API_URL = '/api/chat/usuarios';
  const CONVERSATION_API_URL = (userId) => `/api/chat/conversas/${userId}`;
  const SEND_MESSAGE_API_URL = (userId) => `/api/chat/conversas/${userId}/mensagens`;
  const MARK_READ_API_URL = (userId) => `/api/chat/conversas/${userId}/visualizar`;
  const PRESENCE_API_URL = '/api/chat/presenca';
  const POLL_INTERVAL_MS = 4000;
  const PRESENCE_INTERVAL_MS = 30000;
  const PREVIEW_LIMIT = 72;

  const state = {
    currentUser: null,
    users: [],
    activeUserId: null,
    activeConversationId: null,
    messages: [],
    panelOpen: false,
    screen: 'list',
    usersLoaded: false,
    usersLoading: false,
    conversationLoading: false,
    conversationRequestId: 0,
    markReadInFlight: false,
    sending: false,
    pollHandle: null,
    presenceHandle: null,
    notificationPermissionAsked: false,
    notifiedMessageIds: new Set()
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

    updateHeader();
    updateComposerState();
    startPolling();
    startPresenceHeartbeat();
    loadUsers({ silent: false, skipNotification: true }).catch(() => {});
  }

  function buildWidget() {
    const container = document.createElement('div');
    container.className = 'chat-widget-shell';
    container.innerHTML = `
      <button type="button" class="chat-widget-trigger" aria-label="Abrir chat" aria-expanded="false">
        <span class="chat-widget-trigger-icon" aria-hidden="true">${renderBubbleIcon()}</span>
        <span class="chat-widget-trigger-badge hidden">0</span>
      </button>

      <section class="chat-widget-panel hidden" aria-hidden="true">
        <header class="chat-widget-header">
          <button type="button" class="chat-widget-back hidden" aria-label="Voltar para lista">${renderBackIcon()}</button>

          <div class="chat-widget-header-copy">
            <strong class="chat-widget-header-title">CHAT SAFISA</strong>
            <small class="chat-widget-header-subtitle">SELECIONE O DESTINATARIO</small>
          </div>

          <button type="button" class="chat-widget-close" aria-label="Fechar chat">X</button>
        </header>

        <div class="chat-widget-status hidden"></div>

        <div class="chat-widget-viewport">
          <section class="chat-widget-screen chat-widget-screen-list">
            <div class="chat-widget-screen-head">
              <span class="chat-widget-section-label">USUARIOS:</span>
              <span class="chat-widget-screen-meta">0 disponivel(is)</span>
            </div>

            <div class="chat-widget-user-list">
              <div class="chat-widget-empty">Carregando usuarios...</div>
            </div>
          </section>

          <section class="chat-widget-screen chat-widget-screen-thread hidden">
            <div class="chat-widget-message-list">
              <div class="chat-widget-empty">
                <div class="chat-widget-empty-icon">${renderEmptyMessageIcon()}</div>
                <strong>INICIE A CONVERSA</strong>
              </div>
            </div>

            <form class="chat-widget-composer">
              <textarea
                class="chat-widget-input"
                rows="2"
                maxlength="1000"
                placeholder="Digite sua mensagem..."
                disabled
              ></textarea>
              <button type="submit" class="chat-widget-send" disabled aria-label="Enviar mensagem">
                <span aria-hidden="true">${renderSendIcon()}</span>
              </button>
            </form>
          </section>
        </div>
      </section>
    `;

    document.body.appendChild(container);

    return {
      shell: container,
      trigger: container.querySelector('.chat-widget-trigger'),
      triggerBadge: container.querySelector('.chat-widget-trigger-badge'),
      panel: container.querySelector('.chat-widget-panel'),
      back: container.querySelector('.chat-widget-back'),
      close: container.querySelector('.chat-widget-close'),
      status: container.querySelector('.chat-widget-status'),
      headerTitle: container.querySelector('.chat-widget-header-title'),
      headerSubtitle: container.querySelector('.chat-widget-header-subtitle'),
      screenMeta: container.querySelector('.chat-widget-screen-meta'),
      listScreen: container.querySelector('.chat-widget-screen-list'),
      threadScreen: container.querySelector('.chat-widget-screen-thread'),
      userList: container.querySelector('.chat-widget-user-list'),
      messageList: container.querySelector('.chat-widget-message-list'),
      composer: container.querySelector('.chat-widget-composer'),
      input: container.querySelector('.chat-widget-input'),
      send: container.querySelector('.chat-widget-send')
    };
  }

  function bindEvents() {
    refs.trigger.addEventListener('click', togglePanel);
    refs.back.addEventListener('click', showListScreen);
    refs.close.addEventListener('click', closePanel);
    refs.userList.addEventListener('click', handleUserListClick);
    refs.composer.addEventListener('submit', handleSendMessage);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        touchPresence().catch(() => {});
        loadUsers({ silent: true, skipNotification: true }).catch(() => {});
        if (state.panelOpen && state.screen === 'thread' && state.activeUserId) {
          loadConversation(state.activeUserId, { silent: true }).catch(() => {});
        }
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
    refs.shell.classList.add('is-open');
    refs.trigger.setAttribute('aria-expanded', 'true');
    refs.panel.classList.remove('hidden');
    refs.panel.setAttribute('aria-hidden', 'false');
    maybeRequestNotificationPermission();

    if (!state.usersLoaded) {
      loadUsers({ silent: false, skipNotification: true }).catch(() => {});
    } else if (state.screen === 'thread' && state.activeUserId) {
      loadConversation(state.activeUserId, { silent: true }).catch(() => {});
    }

    if (state.screen === 'thread' && state.activeUserId) {
      refs.input.focus();
    }
  }

  function closePanel() {
    state.panelOpen = false;
    refs.shell.classList.remove('is-open');
    refs.trigger.setAttribute('aria-expanded', 'false');
    refs.panel.classList.add('hidden');
    refs.panel.setAttribute('aria-hidden', 'true');
  }

  function showListScreen() {
    state.screen = 'list';
    updateHeader();
    updateComposerState();
    renderScreens();
  }

  function showThreadScreen() {
    state.screen = 'thread';
    updateHeader();
    updateComposerState();
    renderScreens();
    if (state.panelOpen) {
      refs.input.focus();
    }
  }

  function renderScreens() {
    const threadVisible = state.screen === 'thread' && Number.isInteger(Number(state.activeUserId));
    refs.listScreen.classList.toggle('hidden', threadVisible);
    refs.threadScreen.classList.toggle('hidden', !threadVisible);
    refs.back.classList.toggle('hidden', !threadVisible);
  }

  async function loadUsers(options = {}) {
    if (state.usersLoading) {
      return;
    }

    state.usersLoading = true;

    try {
      const users = await requestJson(USERS_API_URL);
      const previousUsers = state.users;
      state.users = Array.isArray(users) ? users : [];
      state.usersLoaded = true;

      syncActiveUser();
      renderUserList();
      renderUnreadBadge();
      updateHeader();

      if (!options.skipNotification) {
        maybeNotifyAboutNewMessages(previousUsers, state.users);
      }
    } catch (error) {
      if (!options.silent) {
        showStatus(error.message, 'error');
      }
    } finally {
      state.usersLoading = false;
    }
  }

  function syncActiveUser() {
    if (!state.activeUserId) {
      return;
    }

    const activeUser = state.users.find((user) => Number(user.id) === Number(state.activeUserId));
    if (!activeUser) {
      state.activeUserId = null;
      state.activeConversationId = null;
      state.messages = [];
      state.screen = 'list';
      updateHeader();
      updateComposerState();
      renderScreens();
      renderMessages();
      return;
    }

    state.activeConversationId = activeUser.conversa_id || state.activeConversationId;
  }

  function renderUserList() {
    refs.screenMeta.textContent = `${state.users.length} disponivel(is)`;

    if (!state.users.length) {
      refs.userList.innerHTML = '<div class="chat-widget-empty">Nenhum outro usuario ativo para conversar.</div>';
      return;
    }

    refs.userList.innerHTML = state.users.map((user) => {
      const isActive = Number(user.id) === Number(state.activeUserId);
      const unread = Number(user.nao_lidas || 0);
      const timestamp = user.ultima_mensagem_em ? escapeHtml(formatSidebarTime(user.ultima_mensagem_em)) : '';
      const preview = truncateText(user.ultima_mensagem_preview || 'Nenhuma mensagem...', PREVIEW_LIMIT);
      const presenceLabel = user.chat_online ? 'ONLINE' : 'OFFLINE';
      const presenceClass = user.chat_online ? 'is-online' : 'is-offline';

      return `
        <button type="button" class="chat-widget-user-card ${isActive ? 'is-active' : ''}" data-user-id="${user.id}">
          <span class="chat-widget-user-avatar">${escapeHtml(buildInitials(user.nome || user.login || 'U'))}</span>
          <span class="chat-widget-user-content">
            <span class="chat-widget-user-top">
              <span class="chat-widget-user-name-line">
                <strong>${escapeHtml((user.nome || user.login || 'Usuario').toUpperCase())}</strong>
                <span class="chat-widget-presence ${presenceClass}">${presenceLabel}</span>
              </span>
              ${timestamp ? `<time>${timestamp}</time>` : ''}
            </span>
            <span class="chat-widget-user-subline">${escapeHtml((user.login || formatRole(user.role)).toLowerCase())}</span>
            <span class="chat-widget-user-preview">${escapeHtml(preview)}</span>
          </span>
          ${unread ? `<span class="chat-widget-user-badge">${unread}</span>` : ''}
        </button>
      `;
    }).join('');
  }

  function renderUnreadBadge() {
    const unreadTotal = state.users.reduce((total, user) => total + Number(user.nao_lidas || 0), 0);
    refs.triggerBadge.textContent = String(unreadTotal);
    refs.triggerBadge.classList.toggle('hidden', unreadTotal === 0);
  }

  function handleUserListClick(event) {
    const button = event.target.closest('button[data-user-id]');
    if (!button) {
      return;
    }

    activateUser(button.dataset.userId, { silent: false });
  }

  function activateUser(userId, options = {}) {
    const normalizedUserId = Number.parseInt(userId, 10);
    if (!Number.isInteger(normalizedUserId)) {
      return;
    }

    state.activeUserId = normalizedUserId;
    showThreadScreen();
    loadConversation(normalizedUserId, { silent: options.silent }).catch(() => {});
  }

  async function loadConversation(userId, options = {}) {
    const requestId = state.conversationRequestId + 1;
    state.conversationRequestId = requestId;
    state.conversationLoading = true;

    if (!options.silent && !state.messages.length) {
      refs.messageList.innerHTML = `
        <div class="chat-widget-empty">
          <div class="chat-widget-empty-icon">${renderEmptyMessageIcon()}</div>
          <strong>CARREGANDO CONVERSA</strong>
        </div>
      `;
    }

    try {
      const result = await requestJson(CONVERSATION_API_URL(userId));
      if (requestId !== state.conversationRequestId || Number(userId) !== Number(state.activeUserId)) {
        return;
      }

      state.activeConversationId = result.conversa_id || null;
      const nextMessages = Array.isArray(result.mensagens) ? result.mensagens : [];
      const changed = hasConversationChanged(nextMessages);
      state.messages = nextMessages;
      updateHeader(result.usuario);

      if (changed || !options.silent) {
        renderMessages();
      }

      if (state.panelOpen && !document.hidden) {
        markConversationAsRead(userId).catch(() => {});
      }
    } catch (error) {
      if (requestId !== state.conversationRequestId || Number(userId) !== Number(state.activeUserId)) {
        return;
      }

      state.messages = [];
      renderMessages(error.message);
      if (!options.silent) {
        showStatus(error.message, 'error');
      }
    } finally {
      if (requestId === state.conversationRequestId) {
        state.conversationLoading = false;
      }
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (state.sending || !state.activeUserId) {
      return;
    }

    const content = refs.input.value.trim();
    if (!content) {
      return;
    }

    state.sending = true;
    updateComposerState();

    try {
      const result = await requestJson(SEND_MESSAGE_API_URL(state.activeUserId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo: content })
      });

      refs.input.value = '';
      state.activeConversationId = result?.mensagem?.conversa_id || state.activeConversationId;
      state.messages = [...state.messages, result.mensagem];
      renderMessages();
      updateLocalUserSummaryAfterSend(result);
      renderUserList();
      renderUnreadBadge();
      refs.input.focus();
      clearStatus();
      loadUsers({ silent: true, skipNotification: true }).catch(() => {});
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      state.sending = false;
      updateComposerState();
    }
  }

  function updateLocalUserSummaryAfterSend(result) {
    const targetUserId = Number(result?.usuario?.id);
    const user = state.users.find((entry) => Number(entry.id) === targetUserId);
    if (!user || !result?.mensagem) {
      return;
    }

    user.conversa_id = result.mensagem.conversa_id;
    user.ultima_mensagem_id = result.mensagem.id;
    user.ultima_mensagem_preview = result.mensagem.conteudo;
    user.ultima_mensagem_em = result.mensagem.created_at;
    user.ultima_mensagem_remetente_id = result.mensagem.remetente_id;
  }

  async function markConversationAsRead(userId) {
    if (state.markReadInFlight || !state.activeUserId || Number(userId) !== Number(state.activeUserId)) {
      return;
    }

    const activeUser = state.users.find((user) => Number(user.id) === Number(userId));
    if (!activeUser || Number(activeUser.nao_lidas || 0) === 0) {
      return;
    }

    state.markReadInFlight = true;

    try {
      const result = await requestJson(MARK_READ_API_URL(userId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (Number(result.updated || 0) > 0) {
        activeUser.nao_lidas = 0;
        renderUserList();
        renderUnreadBadge();
        loadUsers({ silent: true, skipNotification: true }).catch(() => {});
      }
    } catch (error) {
      // Atualizacao auxiliar: falha silenciosa.
    } finally {
      state.markReadInFlight = false;
    }
  }

  function renderMessages(errorMessage = '') {
    if (errorMessage) {
      refs.messageList.innerHTML = `<div class="chat-widget-empty">${escapeHtml(errorMessage)}</div>`;
      return;
    }

    if (!state.activeUserId) {
      refs.messageList.innerHTML = `
        <div class="chat-widget-empty">
          <div class="chat-widget-empty-icon">${renderEmptyMessageIcon()}</div>
          <strong>INICIE A CONVERSA</strong>
        </div>
      `;
      return;
    }

    if (!state.messages.length) {
      refs.messageList.innerHTML = `
        <div class="chat-widget-empty">
          <div class="chat-widget-empty-icon">${renderEmptyMessageIcon()}</div>
          <strong>INICIE A CONVERSA</strong>
        </div>
      `;
      return;
    }

    const chunks = [];
    let previousDateKey = '';

    state.messages.forEach((message) => {
      const dateKey = formatDateKey(message.created_at);
      if (dateKey !== previousDateKey) {
        chunks.push(`
          <div class="chat-widget-date-separator">
            <span>${escapeHtml(formatDateDivider(message.created_at))}</span>
          </div>
        `);
        previousDateKey = dateKey;
      }

      chunks.push(`
        <article class="chat-widget-message ${message.mine ? 'is-mine' : 'is-theirs'}">
          <div class="chat-widget-message-bubble">
            <p>${escapeHtml(message.conteudo)}</p>
            <div class="chat-widget-message-meta">
              <time>${escapeHtml(formatMessageTime(message.created_at))}</time>
              ${message.mine ? renderMessageStatus(message) : ''}
            </div>
          </div>
        </article>
      `);
    });

    refs.messageList.innerHTML = chunks.join('');
    refs.messageList.scrollTop = refs.messageList.scrollHeight;
  }

  function hasConversationChanged(nextMessages) {
    if (nextMessages.length !== state.messages.length) {
      return true;
    }

    for (let index = 0; index < nextMessages.length; index += 1) {
      const current = state.messages[index];
      const next = nextMessages[index];

      if (!current || !next) {
        return true;
      }

      if (
        Number(current.id) !== Number(next.id)
        || String(current.lida_em || '') !== String(next.lida_em || '')
        || String(current.conteudo || '') !== String(next.conteudo || '')
      ) {
        return true;
      }
    }

    return false;
  }

  function updateHeader(userOverride = null) {
    const listedUser = state.users.find((user) => Number(user.id) === Number(state.activeUserId));
    const activeUser = userOverride ? { ...(listedUser || {}), ...userOverride } : listedUser;

    if (state.screen === 'thread' && activeUser) {
      const identityLabel = String(activeUser.login || formatRole(activeUser.role) || '').toUpperCase();
      const presenceLabel = activeUser.chat_online ? 'ONLINE' : 'OFFLINE';

      refs.headerTitle.textContent = `FALAR COM ${String(activeUser.nome || activeUser.login || 'USUARIO').toUpperCase()}`;
      refs.headerSubtitle.textContent = identityLabel ? `${identityLabel} - ${presenceLabel}` : presenceLabel;
      return;
    }

    refs.headerTitle.textContent = 'CHAT SAFISA';
    refs.headerSubtitle.textContent = 'SELECIONE O DESTINATARIO';
  }

  function updateComposerState() {
    const enabled = Boolean(state.activeUserId) && state.screen === 'thread' && !state.sending;
    refs.input.disabled = !enabled;
    refs.send.disabled = !enabled;
    refs.input.placeholder = state.activeUserId ? 'Digite sua mensagem...' : 'Selecione um usuario para conversar';
  }

  function startPolling() {
    if (state.pollHandle) {
      return;
    }

    state.pollHandle = window.setInterval(() => {
      loadUsers({ silent: true, skipNotification: false }).catch(() => {});
      if (state.panelOpen && state.screen === 'thread' && state.activeUserId) {
        loadConversation(state.activeUserId, { silent: true }).catch(() => {});
      }
    }, POLL_INTERVAL_MS);
  }

  function startPresenceHeartbeat() {
    if (state.presenceHandle) {
      return;
    }

    touchPresence().catch(() => {});
    state.presenceHandle = window.setInterval(() => {
      if (!document.hidden) {
        touchPresence().catch(() => {});
      }
    }, PRESENCE_INTERVAL_MS);
  }

  async function touchPresence() {
    await requestJson(PRESENCE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function maybeRequestNotificationPermission() {
    if (!('Notification' in window) || state.notificationPermissionAsked) {
      return;
    }

    state.notificationPermissionAsked = true;

    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  function maybeNotifyAboutNewMessages(previousUsers, nextUsers) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    if (!Array.isArray(previousUsers) || !previousUsers.length) {
      return;
    }

    const previousMap = new Map(previousUsers.map((user) => [Number(user.id), user]));

    nextUsers.forEach((user) => {
      const previousUser = previousMap.get(Number(user.id));
      const previousUnread = Number(previousUser?.nao_lidas || 0);
      const currentUnread = Number(user.nao_lidas || 0);
      const latestMessageId = Number(user.ultima_mensagem_id || 0);
      const latestIncoming = Number(user.ultima_mensagem_remetente_id || 0) === Number(user.id);
      const conversationVisible = state.panelOpen
        && state.screen === 'thread'
        && !document.hidden
        && Number(state.activeUserId) === Number(user.id);

      if (
        currentUnread > previousUnread
        && latestIncoming
        && latestMessageId > 0
        && !conversationVisible
        && !state.notifiedMessageIds.has(latestMessageId)
      ) {
        state.notifiedMessageIds.add(latestMessageId);
        showBrowserNotification(user);
      }
    });
  }

  function showBrowserNotification(user) {
    try {
      const notification = new Notification(user.nome || user.login || 'Nova mensagem', {
        body: truncateText(user.ultima_mensagem_preview || 'Voce recebeu uma nova mensagem.', PREVIEW_LIMIT),
        tag: `safisa-chat-${user.id}`,
        renotify: true
      });

      notification.onclick = () => {
        window.focus();
        openPanel();
        activateUser(user.id, { silent: true });
        notification.close();
      };
    } catch (error) {
      // Notificacao auxiliar: falha silenciosa.
    }
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
      throw new Error(result.message || 'Nao foi possivel processar a solicitacao do chat.');
    }

    return result;
  }

  function showStatus(text, type) {
    refs.status.textContent = text;
    refs.status.className = `chat-widget-status is-visible is-${type}`;
  }

  function clearStatus() {
    refs.status.textContent = '';
    refs.status.className = 'chat-widget-status hidden';
  }

  function formatSidebarTime(value) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const now = new Date();

    if (isSameCalendarDate(date, now)) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function formatMessageTime(value) {
    if (!value) {
      return '--:--';
    }

    return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateDivider(value) {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (isSameCalendarDate(date, today)) {
      return 'Hoje';
    }

    if (isSameCalendarDate(date, yesterday)) {
      return 'Ontem';
    }

    return date.toLocaleDateString('pt-BR');
  }

  function formatDateKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function buildInitials(value) {
    return String(value || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  function renderMessageStatus(message) {
    if (message.lida_em) {
      return `<span class="chat-widget-status-icon is-read" title="Visualizada">${renderCheckIcon()}</span>`;
    }

    return `<span class="chat-widget-status-icon is-pending" title="Aguardando visualizacao">${renderClockIcon()}</span>`;
  }

  function renderBubbleIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V12A8.5 8.5 0 1 1 21 12Z"></path>
      </svg>
    `;
  }

  function renderEmptyMessageIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V12A8.5 8.5 0 1 1 21 12Z"></path>
      </svg>
    `;
  }

  function renderSendIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M22 2 11 13"></path>
        <path d="m22 2-7 20-4-9-9-4Z"></path>
      </svg>
    `;
  }

  function renderBackIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="m15 18-6-6 6-6"></path>
      </svg>
    `;
  }

  function renderClockIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v5l3 3"></path>
      </svg>
    `;
  }

  function renderCheckIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="m5 12 4 4L19 6"></path>
      </svg>
    `;
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

  function truncateText(value, limit) {
    const text = String(value || '').trim();
    if (text.length <= limit) {
      return text;
    }

    return `${text.slice(0, Math.max(0, limit - 1)).trim()}...`;
  }

  function isSameCalendarDate(dateA, dateB) {
    return dateA.getDate() === dateB.getDate()
      && dateA.getMonth() === dateB.getMonth()
      && dateA.getFullYear() === dateB.getFullYear();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  global.SafisaChatWidget = {
    init
  };

  if (global.SafisaCurrentUser?.id) {
    init(global.SafisaCurrentUser);
  }
})(window);
