const producaoApiBaseUrl = '/api/producao';
const maquinasApiBaseUrl = '/api/maquinas';
const pecasApiBaseUrl = '/api/pecas?tipo=PRODUZIDA';

let producoesCache = [];
let maquinasCache = [];
let pecasCache = [];
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('producao-mensagem'),
  modalMensagem: document.getElementById('producao-modal-mensagem'),
  finalizacaoMensagem: document.getElementById('finalizacao-mensagem'),
  tabela: document.getElementById('producao-tbody'),
  total: document.getElementById('total-producao'),
  filtroForm: document.getElementById('producao-filtro-form'),
  modal: document.getElementById('producao-modal'),
  finalizacaoModal: document.getElementById('finalizacao-modal'),
  drawer: document.getElementById('app-drawer'),
  drawerScrim: document.getElementById('drawer-scrim'),
  pecaBusca: document.getElementById('producao-peca-busca'),
  pecaId: document.getElementById('producao-peca-id'),
  pecaSugestoes: document.getElementById('producao-peca-sugestoes'),
  maquinaSelect: document.getElementById('producao-maquina'),
  finalizacaoComprimentoWrapper: document.getElementById('finalizacao-comprimento-wrapper'),
  finalizacaoComprimentoInput: document.getElementById('finalizacao-comprimento-corte'),
  finalizacaoComprimentoHint: document.getElementById('finalizacao-comprimento-hint')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarMaquinas(), carregarPecas()]);
  await carregarProducoes();
});

function bindEvents() {
  document.getElementById('btn-nova-producao').addEventListener('click', abrirModalProducao);
  document.getElementById('btn-cancelar-modal-producao').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-producao').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-cancelar-modal-finalizacao').addEventListener('click', fecharModalFinalizacao);
  document.getElementById('btn-fechar-modal-finalizacao').addEventListener('click', fecharModalFinalizacao);
  document.getElementById('btn-limpar-filtros-producao').addEventListener('click', limparFiltros);
  document.getElementById('menu-toggle').addEventListener('click', () => toggleDrawer(true));
  document.getElementById('drawer-close').addEventListener('click', () => toggleDrawer(false));
  refs.drawerScrim.addEventListener('click', () => toggleDrawer(false));
  refs.modal.addEventListener('click', handleBackdrop);
  refs.finalizacaoModal.addEventListener('click', handleBackdrop);
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarProducoes();
  });
  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
  document.getElementById('producao-form').addEventListener('submit', handleCriarProducao);
  document.getElementById('finalizacao-form').addEventListener('submit', handleFinalizarProducao);
  refs.tabela.addEventListener('click', handleTabelaActions);
  refs.pecaBusca.addEventListener('input', () => {
    refs.pecaId.value = '';
    renderizarSugestoesPeca(refs.pecaBusca.value.trim());
  });
  refs.pecaBusca.addEventListener('focus', () => renderizarSugestoesPeca(refs.pecaBusca.value.trim()));
  refs.pecaSugestoes.addEventListener('click', handleSugestaoPecaClick);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarMaquinas() {
  const response = await fetch(maquinasApiBaseUrl);
  const maquinas = await response.json();

  if (!response.ok) {
    throw new Error(maquinas.message || 'Nao foi possivel carregar as maquinas.');
  }

  maquinasCache = maquinas;
  refs.maquinaSelect.innerHTML = `
    <option value="">Selecione</option>
    ${maquinasCache.map((maquina) => `<option value="${maquina.id}">${escapeHtml(maquina.nome)}</option>`).join('')}
  `;
}

async function carregarPecas() {
  const response = await fetch(pecasApiBaseUrl);
  const pecas = await response.json();

  if (!response.ok) {
    throw new Error(pecas.message || 'Nao foi possivel carregar as pecas produzidas.');
  }

  pecasCache = pecas.filter((peca) => peca.tipo === 'PRODUZIDA' && peca.classificacao === 'ITEM');
}

async function carregarProducoes() {
  const params = new URLSearchParams();
  const q = document.getElementById('filtro-producao-q').value.trim();
  const status = document.getElementById('filtro-producao-status').value;

  if (q) params.append('q', q);
  if (status) params.append('status', status);

  try {
    const endpoint = params.toString() ? `${producaoApiBaseUrl}?${params.toString()}` : producaoApiBaseUrl;
    const response = await fetch(endpoint);
    const producoes = await response.json();

    if (!response.ok) {
      throw new Error(producoes.message || 'Nao foi possivel carregar as ordens de producao.');
    }

    producoesCache = producoes;
    renderizarTabela();
    atualizarIndicadores();
  } catch (error) {
    producoesCache = [];
    renderizarTabela();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarTabela() {
  refs.total.textContent = `${producoesCache.length} registro(s) encontrado(s)`;

  if (producoesCache.length === 0) {
    refs.tabela.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhuma ordem de producao encontrada.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = producoesCache.map((producao) => `
    <tr>
      <td>${renderStatusBadge(producao.status)}</td>
      <td>${escapeHtml(producao.maquina_nome)}</td>
      <td class="table-description">${escapeHtml(`${producao.peca_codigo} - ${producao.peca_descricao}`)}</td>
      <td class="table-quantity">${formatInteger(producao.quantidade_planejada)}</td>
      <td class="table-quantity">${formatInteger(producao.quantidade_produzida || 0)}</td>
      <td class="table-quantity">${formatInteger(producao.quantidade_refugo || 0)}</td>
      <td>${escapeHtml(producao.materia_prima_codigo ? `${producao.materia_prima_codigo} - ${producao.materia_prima_nome}` : 'Sem materia-prima')}</td>
      <td>${escapeHtml(formatarConsumo(producao))}</td>
      <td>${formatarData(producao.data_inicio)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            ${producao.status === 'EM_ANDAMENTO'
              ? `<button type="button" class="row-menu-item" data-action="finalizar" data-id="${producao.id}">Finalizar</button>`
              : '<span class="row-menu-item">Finalizada</span>'}
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  const emAndamento = producoesCache.filter((item) => item.status === 'EM_ANDAMENTO').length;
  const finalizadas = producoesCache.filter((item) => item.status === 'FINALIZADA').length;
  const planejada = producoesCache.reduce((total, item) => total + Number(item.quantidade_planejada || 0), 0);

  document.getElementById('metric-producao-andamento').textContent = String(emAndamento);
  document.getElementById('metric-producao-finalizada').textContent = String(finalizadas);
  document.getElementById('metric-producao-planejada').textContent = formatInteger(planejada);
}

function renderizarSugestoesPeca(termo) {
  const filtro = termo.toLowerCase();
  const itens = pecasCache.filter((peca) => {
    if (!filtro) {
      return true;
    }

    return `${peca.codigo} ${peca.descricao}`.toLowerCase().includes(filtro);
  }).slice(0, 8);

  if (itens.length === 0) {
    refs.pecaSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma peca produzida encontrada.</div>';
    refs.pecaSugestoes.classList.remove('hidden');
    return;
  }

  refs.pecaSugestoes.innerHTML = itens.map((peca) => `
    <button type="button" class="autocomplete-option" data-peca-id="${peca.id}" data-peca-label="${escapeHtml(`${peca.codigo} - ${peca.descricao}`)}">
      <strong>${escapeHtml(`${peca.codigo} - ${peca.descricao}`)}</strong>
      <span>${escapeHtml(peca.materia_prima_nome ? `Materia-prima: ${peca.materia_prima_codigo} - ${peca.materia_prima_nome}` : 'Sem materia-prima vinculada')}</span>
      <span>${escapeHtml(peca.comprimento_mm ? `Corte atual: ${formatDecimal(peca.comprimento_mm)} mm` : 'Corte atual: nao definido')}</span>
    </button>
  `).join('');
  refs.pecaSugestoes.classList.remove('hidden');
}

function handleSugestaoPecaClick(event) {
  const option = event.target.closest('button[data-peca-id]');
  if (!option) {
    return;
  }

  refs.pecaId.value = option.dataset.pecaId;
  refs.pecaBusca.value = option.dataset.pecaLabel;
  esconderSugestoes();
}

async function handleCriarProducao(event) {
  event.preventDefault();

  try {
    const response = await fetch(producaoApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_maquina: refs.maquinaSelect.value,
        id_peca: refs.pecaId.value,
        quantidade_planejada: document.getElementById('producao-quantidade-planejada').value,
        observacao_inicio: document.getElementById('producao-observacao-inicio').value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalProducao();
    mostrarMensagem('Ordem de producao iniciada com sucesso.', 'success');
    await carregarProducoes();
  } catch (error) {
    mostrarMensagemModal(error.message, 'error');
  }
}

async function handleFinalizarProducao(event) {
  event.preventDefault();
  const id = document.getElementById('finalizacao-id').value;

  try {
    const response = await fetch(`${producaoApiBaseUrl}/${id}/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidade_produzida: document.getElementById('finalizacao-quantidade-produzida').value,
        quantidade_refugo: document.getElementById('finalizacao-quantidade-refugo').value,
        comprimento_corte_mm: refs.finalizacaoComprimentoInput.value.trim(),
        observacao_fim: document.getElementById('finalizacao-observacao').value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalFinalizacao();
    mostrarMensagem('Ordem de producao finalizada com sucesso.', 'success');
    await carregarProducoes();
  } catch (error) {
    mostrarMensagemFinalizacao(error.message, 'error');
  }
}

function handleTabelaActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) {
    return;
  }

  const producao = producoesCache.find((item) => Number(item.id) === Number(actionButton.dataset.id));
  if (!producao) {
    return;
  }

  if (actionButton.dataset.action === 'finalizar') {
    abrirModalFinalizacao(producao);
  }
}

function abrirModalProducao() {
  resetFormProducao();
  openModal(refs.modal);
}

function fecharModalProducao() {
  resetFormProducao();
  closeModal(refs.modal);
}

function abrirModalFinalizacao(producao) {
  document.getElementById('finalizacao-id').value = producao.id;
  document.getElementById('finalizacao-titulo').textContent = `${producao.peca_codigo} - ${producao.peca_descricao}`;
  document.getElementById('finalizacao-subtitulo').textContent = `${producao.maquina_nome} | ${producao.materia_prima_codigo ? `${producao.materia_prima_codigo} - ${producao.materia_prima_nome}` : 'Sem materia-prima'}`;
  document.getElementById('finalizacao-planejada-chip').textContent = `Planejada: ${formatInteger(producao.quantidade_planejada)}`;
  document.getElementById('finalizacao-mp-chip').textContent = `Materia-prima: ${producao.materia_prima_codigo || '-'}`;
  document.getElementById('finalizacao-regra-chip').textContent = `Regra: ${producao.materia_prima_geometria === 'FUNDIDO' ? 'consumo unitario' : 'consumo por comprimento'}`;
  document.getElementById('finalizacao-quantidade-produzida').value = '0';
  document.getElementById('finalizacao-quantidade-refugo').value = '0';
  refs.finalizacaoComprimentoInput.value = producao.comprimento_corte_mm ? formatInputDecimal(producao.comprimento_corte_mm) : '';
  refs.finalizacaoComprimentoWrapper.classList.toggle(
    'hidden',
    String(producao.materia_prima_geometria || '').toUpperCase() === 'FUNDIDO'
  );
  document.getElementById('finalizacao-observacao').value = '';
  esconderMensagemFinalizacao();
  openModal(refs.finalizacaoModal);
}

function fecharModalFinalizacao() {
  document.getElementById('finalizacao-form').reset();
  document.getElementById('finalizacao-id').value = '';
  document.getElementById('finalizacao-titulo').textContent = 'Nenhuma ordem selecionada';
  document.getElementById('finalizacao-subtitulo').textContent = 'Selecione uma ordem em andamento na tabela.';
  document.getElementById('finalizacao-planejada-chip').textContent = 'Planejada: 0';
  document.getElementById('finalizacao-mp-chip').textContent = 'Materia-prima: -';
  document.getElementById('finalizacao-regra-chip').textContent = 'Regra: aguardando';
  refs.finalizacaoComprimentoInput.value = '';
  refs.finalizacaoComprimentoWrapper.classList.remove('hidden');
  esconderMensagemFinalizacao();
  closeModal(refs.finalizacaoModal);
}

function resetFormProducao() {
  document.getElementById('producao-form').reset();
  refs.pecaId.value = '';
  refs.pecaBusca.value = '';
  document.getElementById('producao-quantidade-planejada').value = '1';
  esconderSugestoes();
  esconderMensagemModal();
}

function limparFiltros() {
  refs.filtroForm.reset();
  carregarProducoes();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarProducoes(), 220);
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
  }

  if (!event.target.closest('.autocomplete')) {
    esconderSugestoes();
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

function esconderSugestoes() {
  refs.pecaSugestoes.classList.add('hidden');
  refs.pecaSugestoes.innerHTML = '';
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'producao') {
    fecharModalProducao();
  }

  if (event.target.dataset.closeModal === 'finalizacao') {
    fecharModalFinalizacao();
  }
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  esconderSugestoes();
  closeAllRowMenus();

  if (!refs.finalizacaoModal.classList.contains('hidden')) {
    fecharModalFinalizacao();
    return;
  }

  if (!refs.modal.classList.contains('hidden')) {
    fecharModalProducao();
    return;
  }

  if (refs.drawer.classList.contains('is-open')) {
    toggleDrawer(false);
  }
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  const hasModal = [refs.modal, refs.finalizacaoModal].some((item) => !item.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

function toggleDrawer(shouldOpen) {
  refs.drawer.classList.toggle('is-open', shouldOpen);
  refs.drawerScrim.classList.toggle('hidden', !shouldOpen);
  document.body.classList.toggle('has-drawer', shouldOpen);
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemModal(texto, tipo) {
  refs.modalMensagem.textContent = texto;
  refs.modalMensagem.className = `message ${tipo}`;
  refs.modalMensagem.classList.remove('hidden');
}

function esconderMensagemModal() {
  refs.modalMensagem.className = 'message hidden';
  refs.modalMensagem.textContent = '';
}

function mostrarMensagemFinalizacao(texto, tipo) {
  refs.finalizacaoMensagem.textContent = texto;
  refs.finalizacaoMensagem.className = `message ${tipo}`;
  refs.finalizacaoMensagem.classList.remove('hidden');
}

function esconderMensagemFinalizacao() {
  refs.finalizacaoMensagem.className = 'message hidden';
  refs.finalizacaoMensagem.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function renderStatusBadge(status) {
  const normalized = String(status || '').toUpperCase();
  let cssClass = 'status-chip';

  if (normalized === 'FINALIZADA') {
    cssClass += ' is-success';
  } else if (normalized === 'EM_ANDAMENTO') {
    cssClass += ' is-warning';
  } else if (normalized === 'CANCELADA') {
    cssClass += ' is-danger';
  }

  return `<span class="${cssClass}">${escapeHtml(status || '-')}</span>`;
}

function formatInteger(value) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDecimal(value) {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatInputDecimal(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }

  return String(Number(numeric.toFixed(2)));
}

function formatarConsumo(producao) {
  if (!producao.quantidade_consumida_materia_prima || !producao.unidade_consumo) {
    return '-';
  }

  return `${Number(producao.quantidade_consumida_materia_prima).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  })} ${producao.unidade_consumo}`;
}

function formatarData(value) {
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
