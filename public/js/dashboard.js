const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';

let solicitacoesCache = [];
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('dashboard-mensagem'),
  total: document.getElementById('dashboard-total'),
  tabela: document.getElementById('dashboard-tbody'),
  filtroForm: document.getElementById('dashboard-filtro-form'),
  atendimentoModal: document.getElementById('atendimento-modal'),
  atendimentoMensagem: document.getElementById('atendimento-mensagem'),
  atendimentoId: document.getElementById('atendimento-id'),
  atendimentoResumo: document.getElementById('atendimento-resumo'),
  atendimentoQuantidade: document.getElementById('atendimento-quantidade'),
  atendimentoObservacao: document.getElementById('atendimento-observacao')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await carregarSolicitacoes();
});

function bindEvents() {
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarSolicitacoes();
  });

  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltro);
    field.addEventListener('change', agendarFiltro);
  });

  document.getElementById('dashboard-btn-limpar').addEventListener('click', () => {
    refs.filtroForm.reset();
    carregarSolicitacoes();
  });

  refs.tabela.addEventListener('click', handleTableActions);
  document.getElementById('btn-fechar-modal-atendimento').addEventListener('click', fecharModalAtendimento);
  document.getElementById('btn-cancelar-modal-atendimento').addEventListener('click', fecharModalAtendimento);
  document.getElementById('atendimento-form').addEventListener('submit', handleAtenderSolicitacao);
  refs.atendimentoModal.addEventListener('click', handleBackdrop);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarSolicitacoes() {
  const params = new URLSearchParams();
  const q = document.getElementById('dashboard-filtro-q').value.trim();
  const status = document.getElementById('dashboard-filtro-status').value;

  if (q) params.append('q', q);
  if (status) params.append('status', status);
  params.append('origem_atendimento', 'ALMOXARIFADO');

  try {
    const endpoint = `${solicitacoesApiBaseUrl}?${params.toString()}`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar as solicitacoes.');
    }

    solicitacoesCache = result;
    renderizarTabela();
    atualizarIndicadores();
  } catch (error) {
    solicitacoesCache = [];
    renderizarTabela();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarTabela() {
  refs.total.textContent = `${solicitacoesCache.length} registro(s) encontrado(s)`;

  if (!solicitacoesCache.length) {
    refs.tabela.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma solicitacao encontrada.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = solicitacoesCache.map((item) => `
    <tr>
      <td>${escapeHtml(item.destino_nome)}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatPackage(item.quantidade_pacote)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_solicitada)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente)}</td>
      <td class="table-quantity">${formatInteger(item.saldo_almoxarifado)}</td>
      <td>${renderStatus(item.status)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="iniciar" data-id="${item.id}">Iniciar separacao</button>
            <button type="button" class="row-menu-item" data-action="atender" data-id="${item.id}">Atender</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  document.getElementById('dashboard-metric-pendente').textContent = String(
    solicitacoesCache.filter((item) => item.status === 'PENDENTE').length
  );
  document.getElementById('dashboard-metric-separacao').textContent = String(
    solicitacoesCache.filter((item) => item.status === 'EM_SEPARACAO').length
  );
  document.getElementById('dashboard-metric-atendidas').textContent = String(
    solicitacoesCache.filter((item) => ['ATENDIDA', 'ATENDIDA_PARCIAL'].includes(item.status)).length
  );
}

function handleTableActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const item = solicitacoesCache.find((entry) => Number(entry.id) === Number(button.dataset.id));
  if (!item) {
    return;
  }

  if (button.dataset.action === 'iniciar') {
    executarAcao(`${solicitacoesApiBaseUrl}/${item.id}/iniciar-separacao`, 'Separacao iniciada com sucesso.');
    return;
  }

  if (button.dataset.action === 'atender') {
    abrirModalAtendimento(item);
  }
}

async function executarAcao(url, successMessage, body = {}) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Operacao nao concluida.');
    }

    mostrarMensagem(successMessage, 'success');
    await carregarSolicitacoes();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function abrirModalAtendimento(item) {
  refs.atendimentoMensagem.className = 'message hidden';
  refs.atendimentoMensagem.textContent = '';
  refs.atendimentoId.value = String(item.id);
  refs.atendimentoQuantidade.value = '1';
  refs.atendimentoQuantidade.max = String(Math.max(1, Number(item.quantidade_pendente || 0)));
  refs.atendimentoObservacao.value = item.observacao || '';
  refs.atendimentoResumo.classList.remove('empty');
  refs.atendimentoResumo.classList.add('selected-tags');
  refs.atendimentoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.destino_nome)}</span>
    <span class="selected-tag">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Qtd pacote: ${formatPackage(item.quantidade_pacote)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Pendente: ${formatInteger(item.quantidade_pendente)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo Almox: ${formatInteger(item.saldo_almoxarifado)}`)}</span>
  `;
  openModal(refs.atendimentoModal);
}

function fecharModalAtendimento() {
  refs.atendimentoId.value = '';
  refs.atendimentoResumo.classList.add('selected-tags', 'empty');
  refs.atendimentoResumo.textContent = 'Selecione uma solicitacao para atender.';
  closeModal(refs.atendimentoModal);
}

async function handleAtenderSolicitacao(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${solicitacoesApiBaseUrl}/${refs.atendimentoId.value}/atender`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidade_atendida: refs.atendimentoQuantidade.value,
        observacao: refs.atendimentoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel atender a solicitacao.');
    }

    fecharModalAtendimento();
    mostrarMensagem('Solicitacao atendida com sucesso.', 'success');
    await carregarSolicitacoes();
  } catch (error) {
    refs.atendimentoMensagem.textContent = error.message;
    refs.atendimentoMensagem.className = 'message error';
    refs.atendimentoMensagem.classList.remove('hidden');
  }
}

function agendarFiltro() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarSolicitacoes(), 220);
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'atendimento') {
    fecharModalAtendimento();
  }
}

function handleGlobalClick(event) {
  const trigger = event.target.closest('.row-menu-trigger');
  if (trigger) {
    const currentMenu = trigger.closest('.row-menu');
    window.requestAnimationFrame(() => {
      const shouldKeepOpen = currentMenu && currentMenu.hasAttribute('open');
      closeAllRowMenus(shouldKeepOpen ? currentMenu : null);
    });
    return;
  }

  if (event.target.closest('.row-menu-item')) {
    closeAllRowMenus();
    return;
  }

  if (!event.target.closest('.row-menu')) {
    closeAllRowMenus();
  }
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  closeAllRowMenus();
  if (!refs.atendimentoModal.classList.contains('hidden')) {
    fecharModalAtendimento();
  }
}

function closeAllRowMenus(exceptMenu = null) {
  document.querySelectorAll('.row-menu[open]').forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) {
      return;
    }

    menu.removeAttribute('open');
  });
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function renderStatus(status) {
  const normalized = String(status || '').toUpperCase();
  let className = 'status-chip';

  if (normalized === 'ATENDIDA') className += ' is-success';
  if (normalized === 'ATENDIDA_PARCIAL') className += ' is-warning';
  if (normalized === 'PENDENTE') className += ' is-danger';
  if (normalized === 'EM_SEPARACAO') className += ' is-info';

  return `<span class="${className}">${escapeHtml(normalized || '-')}</span>`;
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatPackage(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return formatInteger(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
