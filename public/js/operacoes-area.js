const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';
const estoqueApiBaseUrl = '/api/estoque';

const AREA_CONFIG = {
  '/pagina-expedicao': {
    type: 'EXPEDICAO',
    title: 'Expedicao',
    subtitle: 'Solicite pecas ao almoxarifado e acompanhe o atendimento sem abrir o estoque geral.',
    section: 'Expedicao',
    metricLabels: ['Pendentes', 'Em Separacao', 'Atendidas'],
    canCreate: true
  },
  '/pagina-montagem': {
    type: 'MONTAGEM',
    title: 'Montagem',
    subtitle: 'Solicite materiais ao almoxarifado e acompanhe a separacao para manter a montagem abastecida.',
    section: 'Montagem',
    metricLabels: ['Pendentes', 'Em Separacao', 'Atendidas'],
    canCreate: true
  },
  '/pagina-almoxarifado': {
    type: 'ALMOXARIFADO',
    title: 'Almoxarifado',
    subtitle: 'Fila central de solicitacoes internas, separacao e transferencia para Expedicao e Montagem.',
    section: 'Almoxarifado',
    metricLabels: ['Pendentes', 'Em Separacao', 'Atendidas/Parciais'],
    canCreate: false
  }
};

const currentArea = AREA_CONFIG[window.location.pathname] || AREA_CONFIG['/pagina-expedicao'];

let solicitacoesCache = [];
let itensCache = [];
let debounceTimer = null;

const refs = {
  mensagem: document.getElementById('area-mensagem'),
  total: document.getElementById('total-solicitacoes'),
  tableHead: document.getElementById('area-table-head'),
  tableBody: document.getElementById('area-table-body'),
  filtroForm: document.getElementById('area-filtro-form'),
  btnNova: document.getElementById('btn-nova-solicitacao'),
  solicitacaoModal: document.getElementById('solicitacao-modal'),
  solicitacaoMensagem: document.getElementById('solicitacao-mensagem'),
  solicitacaoItem: document.getElementById('solicitacao-item'),
  solicitacaoQuantidade: document.getElementById('solicitacao-quantidade'),
  solicitacaoObservacao: document.getElementById('solicitacao-observacao'),
  atendimentoModal: document.getElementById('atendimento-modal'),
  atendimentoMensagem: document.getElementById('atendimento-mensagem'),
  atendimentoId: document.getElementById('atendimento-id'),
  atendimentoResumo: document.getElementById('atendimento-resumo'),
  atendimentoQuantidade: document.getElementById('atendimento-quantidade'),
  atendimentoObservacao: document.getElementById('atendimento-observacao')
};

document.addEventListener('DOMContentLoaded', async () => {
  configurarTela();
  bindEvents();
  await Promise.all([
    carregarSolicitacoes(),
    currentArea.canCreate ? carregarItens() : Promise.resolve()
  ]);
});

function configurarTela() {
  document.title = `SAFISA | ${currentArea.title}`;
  document.getElementById('area-kicker').textContent = currentArea.section;
  document.getElementById('area-page-title').textContent = currentArea.title;
  document.getElementById('area-page-subtitle').textContent = currentArea.subtitle;
  document.getElementById('area-section-pill').textContent = currentArea.section;
  document.getElementById('area-table-title').textContent = currentArea.canCreate
    ? 'Minhas Solicitacoes'
    : 'Solicitacoes Recebidas';
  document.getElementById('metric-label-1').textContent = currentArea.metricLabels[0];
  document.getElementById('metric-label-2').textContent = currentArea.metricLabels[1];
  document.getElementById('metric-label-3').textContent = currentArea.metricLabels[2];

  if (!currentArea.canCreate) {
    refs.btnNova.classList.add('hidden');
  }

  const topActions = document.getElementById('area-top-actions');
  topActions.innerHTML = `
    <a class="btn btn-neutral" href="/pagina-acesso">Portal de Areas</a>
    ${currentArea.type === 'ALMOXARIFADO'
      ? '<a class="btn btn-secondary" href="/pagina-estoque">Controle de Estoque</a>'
      : '<a class="btn btn-secondary" href="/pagina-estoque">Ver Estoque</a>'}
  `;
}

function bindEvents() {
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarSolicitacoes();
  });

  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltro);
    field.addEventListener('change', agendarFiltro);
  });

  document.getElementById('btn-limpar-filtros-area').addEventListener('click', () => {
    refs.filtroForm.reset();
    carregarSolicitacoes();
  });

  if (currentArea.canCreate) {
    refs.btnNova.addEventListener('click', abrirModalSolicitacao);
    document.getElementById('btn-fechar-modal-solicitacao').addEventListener('click', fecharModalSolicitacao);
    document.getElementById('btn-cancelar-modal-solicitacao').addEventListener('click', fecharModalSolicitacao);
    document.getElementById('solicitacao-form').addEventListener('submit', handleCreateSolicitacao);
  } else {
    refs.tableBody.addEventListener('click', handleAlmoxActions);
    document.getElementById('btn-fechar-modal-atendimento').addEventListener('click', fecharModalAtendimento);
    document.getElementById('btn-cancelar-modal-atendimento').addEventListener('click', fecharModalAtendimento);
    document.getElementById('atendimento-form').addEventListener('submit', handleAtenderSolicitacao);
  }

  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleBackdrop);
}

async function carregarItens() {
  const response = await fetch(`${estoqueApiBaseUrl}/itens`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os itens para solicitacao.');
  }

  itensCache = result;
  refs.solicitacaoItem.innerHTML = `
    <option value="">Selecione</option>
    ${itensCache.map((item) => `<option value="${item.id}">${escapeHtml(`${item.codigo} - ${item.descricao} [${item.classificacao}]`)}</option>`).join('')}
  `;
}

async function carregarSolicitacoes() {
  const params = new URLSearchParams();
  const q = document.getElementById('filtro-area-q').value.trim();
  const status = document.getElementById('filtro-area-status').value;

  if (currentArea.type !== 'ALMOXARIFADO') {
    params.append('area_origem', currentArea.type);
  }
  if (q) params.append('q', q);
  if (status) params.append('status', status);

  try {
    const endpoint = `${solicitacoesApiBaseUrl}?${params.toString()}`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar as solicitacoes.');
    }

    solicitacoesCache = result;
    renderizarSolicitacoes();
    atualizarIndicadores();
  } catch (error) {
    solicitacoesCache = [];
    renderizarSolicitacoes();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarSolicitacoes() {
  refs.total.textContent = `${solicitacoesCache.length} registro(s) encontrado(s)`;

  if (currentArea.type === 'ALMOXARIFADO') {
    refs.tableHead.innerHTML = `
      <tr>
        <th>Area</th>
        <th>Codigo</th>
        <th>Descricao</th>
        <th>Qtd Solicitada</th>
        <th>Pendente</th>
        <th>Saldo Almox</th>
        <th>Status</th>
        <th>Acoes</th>
      </tr>
    `;

    if (solicitacoesCache.length === 0) {
      refs.tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma solicitacao encontrada.</td></tr>';
      return;
    }

    refs.tableBody.innerHTML = solicitacoesCache.map((item) => `
      <tr>
        <td>${escapeHtml(item.destino_nome)}</td>
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(item.descricao)}</td>
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

    return;
  }

  refs.tableHead.innerHTML = `
    <tr>
      <th>Codigo</th>
      <th>Descricao</th>
      <th>Qtd Solicitada</th>
      <th>Qtd Atendida</th>
      <th>Status</th>
      <th>Data Solicitacao</th>
      <th>Observacao</th>
    </tr>
  `;

  if (solicitacoesCache.length === 0) {
    refs.tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma solicitacao encontrada.</td></tr>';
    return;
  }

  refs.tableBody.innerHTML = solicitacoesCache.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_solicitada)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_atendida)}</td>
      <td>${renderStatus(item.status)}</td>
      <td>${formatDate(item.data_solicitacao)}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  const pendentes = solicitacoesCache.filter((item) => item.status === 'PENDENTE').length;
  const emSeparacao = solicitacoesCache.filter((item) => item.status === 'EM_SEPARACAO').length;
  const atendidas = solicitacoesCache.filter((item) => ['ATENDIDA', 'ATENDIDA_PARCIAL'].includes(item.status)).length;

  document.getElementById('metric-area-1').textContent = String(pendentes);
  document.getElementById('metric-area-2').textContent = String(emSeparacao);
  document.getElementById('metric-area-3').textContent = String(atendidas);
}

function abrirModalSolicitacao() {
  refs.solicitacaoMensagem.className = 'message hidden';
  refs.solicitacaoMensagem.textContent = '';
  document.getElementById('solicitacao-form').reset();
  refs.solicitacaoQuantidade.value = '1';
  openModal(refs.solicitacaoModal);
}

function fecharModalSolicitacao() {
  closeModal(refs.solicitacaoModal);
}

async function handleCreateSolicitacao(event) {
  event.preventDefault();

  try {
    const response = await fetch(solicitacoesApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_origem: currentArea.type,
        id_peca: refs.solicitacaoItem.value,
        quantidade_solicitada: refs.solicitacaoQuantidade.value,
        observacao: refs.solicitacaoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel criar a solicitacao.');
    }

    fecharModalSolicitacao();
    mostrarMensagem('Solicitacao enviada ao Almoxarifado com sucesso.', 'success');
    await carregarSolicitacoes();
  } catch (error) {
    refs.solicitacaoMensagem.textContent = error.message;
    refs.solicitacaoMensagem.className = 'message error';
    refs.solicitacaoMensagem.classList.remove('hidden');
  }
}

async function handleAlmoxActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const item = solicitacoesCache.find((entry) => Number(entry.id) === Number(button.dataset.id));
  if (!item) {
    return;
  }

  if (button.dataset.action === 'iniciar') {
    await executarAcaoAlmox(`${solicitacoesApiBaseUrl}/${item.id}/iniciar-separacao`, 'Separacao iniciada com sucesso.');
    return;
  }

  if (button.dataset.action === 'atender') {
    abrirModalAtendimento(item);
  }
}

async function executarAcaoAlmox(url, successMessage, body = {}) {
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
  refs.atendimentoResumo.className = 'selected-tags';
  refs.atendimentoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`${item.destino_nome} | ${item.codigo} - ${item.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Pendente: ${formatInteger(item.quantidade_pendente)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo Almox: ${formatInteger(item.saldo_almoxarifado)}`)}</span>
  `;
  openModal(refs.atendimentoModal);
}

function fecharModalAtendimento() {
  refs.atendimentoId.value = '';
  refs.atendimentoResumo.className = 'selected-tags empty';
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
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => carregarSolicitacoes(), 220);
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'solicitacao') {
    fecharModalSolicitacao();
  }
  if (event.target.dataset.closeModal === 'atendimento') {
    fecharModalAtendimento();
  }
}

function handleKeydown(event) {
  if (event.key !== 'Escape') {
    return;
  }

  closeAllRowMenus();

  if (!refs.atendimentoModal.classList.contains('hidden')) {
    fecharModalAtendimento();
    return;
  }

  if (!refs.solicitacaoModal.classList.contains('hidden')) {
    fecharModalSolicitacao();
  }
}

function handleGlobalClick(event) {
  const trigger = event.target.closest('.row-menu-trigger');
  if (trigger) {
    const currentMenu = trigger.closest('.row-menu');
    window.requestAnimationFrame(() => {
      const keepOpen = currentMenu && currentMenu.hasAttribute('open');
      closeAllRowMenus(keepOpen ? currentMenu : null);
    });
    return;
  }

  if (event.target.closest('.row-menu-item')) {
    closeAllRowMenus();
  }

  if (!event.target.closest('.row-menu')) {
    closeAllRowMenus();
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
  document.body.classList.add('has-modal');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  const hasModal = [refs.solicitacaoModal, refs.atendimentoModal].some((entry) => !entry.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

function renderStatus(status) {
  let cssClass = 'status-chip';

  if (status === 'ATENDIDA') {
    cssClass += ' is-success';
  } else if (status === 'ATENDIDA_PARCIAL' || status === 'EM_SEPARACAO') {
    cssClass += ' is-warning';
  } else if (status === 'CANCELADA') {
    cssClass += ' is-danger';
  }

  return `<span class="${cssClass}">${escapeHtml(status)}</span>`;
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
