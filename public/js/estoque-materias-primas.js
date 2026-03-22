const estoqueMateriaPrimaApiBaseUrl = '/api/estoque-materias-primas';
const materiasPrimasAutocompleteApiBaseUrl = '/api/materias-primas-autocomplete';

let saldosCache = [];
let movimentacoesCache = [];
let materiasPrimasCache = [];
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('estoque-mp-mensagem'),
  tabela: document.getElementById('estoque-mp-tbody'),
  total: document.getElementById('total-estoque-mp'),
  movimentacoesTabela: document.getElementById('estoque-mp-movimentacoes-tbody'),
  totalMovimentacoes: document.getElementById('total-movimentacoes-mp'),
  filtroForm: document.getElementById('estoque-mp-filtro-form'),
  modal: document.getElementById('movimentacao-mp-modal'),
  modalMensagem: document.getElementById('movimentacao-mp-mensagem'),
  modalTitulo: document.getElementById('movimentacao-mp-modal-title'),
  modalSubtitulo: document.getElementById('movimentacao-mp-modal-subtitle'),
  modalTipo: document.getElementById('movimentacao-mp-tipo'),
  modalMateriaPrimaId: document.getElementById('movimentacao-mp-id'),
  modalBusca: document.getElementById('movimentacao-mp-busca'),
  modalSugestoes: document.getElementById('movimentacao-mp-sugestoes'),
  modalResumo: document.getElementById('movimentacao-mp-resumo'),
  modalQuantidade: document.getElementById('movimentacao-mp-quantidade'),
  modalQuantidadeLabel: document.getElementById('movimentacao-mp-quantidade-label'),
  modalObservacao: document.getElementById('movimentacao-mp-observacao'),
  drawer: document.getElementById('app-drawer'),
  drawerScrim: document.getElementById('drawer-scrim')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarMateriasPrimas(), carregarSaldos(), carregarMovimentacoes()]);
});

function bindEvents() {
  document.getElementById('menu-toggle').addEventListener('click', () => toggleDrawer(true));
  document.getElementById('drawer-close').addEventListener('click', () => toggleDrawer(false));
  refs.drawerScrim.addEventListener('click', () => toggleDrawer(false));

  document.getElementById('btn-nova-entrada-mp').addEventListener('click', () => abrirModalMovimentacao('ENTRADA'));
  document.getElementById('btn-ajuste-mp').addEventListener('click', () => abrirModalMovimentacao('AJUSTE'));
  document.getElementById('btn-fechar-modal-mp-estoque').addEventListener('click', fecharModalMovimentacao);
  document.getElementById('btn-cancelar-modal-mp-estoque').addEventListener('click', fecharModalMovimentacao);
  document.getElementById('movimentacao-mp-form').addEventListener('submit', handleSalvarMovimentacao);
  document.getElementById('btn-limpar-filtros-estoque-mp').addEventListener('click', limparFiltros);
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarSaldos();
  });
  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
  refs.modal.addEventListener('click', handleBackdrop);
  refs.tabela.addEventListener('click', handleTabelaActions);
  refs.modalBusca.addEventListener('input', () => {
    refs.modalMateriaPrimaId.value = '';
    renderizarSugestoes(refs.modalBusca.value.trim());
  });
  refs.modalBusca.addEventListener('focus', () => renderizarSugestoes(refs.modalBusca.value.trim()));
  refs.modalSugestoes.addEventListener('click', handleSugestaoClick);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarMateriasPrimas() {
  const response = await fetch(materiasPrimasAutocompleteApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as materias-primas.');
  }

  materiasPrimasCache = result;
}

async function carregarSaldos() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-mp-estoque-codigo').value.trim();
  const nome = document.getElementById('filtro-mp-estoque-nome').value.trim();
  const categoria = document.getElementById('filtro-mp-estoque-categoria').value;
  const geometria = document.getElementById('filtro-mp-estoque-geometria').value;

  if (codigo) params.append('codigo', codigo);
  if (nome) params.append('nome', nome);
  if (categoria) params.append('categoria', categoria);
  if (geometria) params.append('geometria', geometria);

  try {
    const endpoint = params.toString()
      ? `${estoqueMateriaPrimaApiBaseUrl}/saldos?${params.toString()}`
      : `${estoqueMateriaPrimaApiBaseUrl}/saldos`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar o estoque de materia-prima.');
    }

    saldosCache = result;
    renderizarSaldos();
    atualizarIndicadores();
  } catch (error) {
    saldosCache = [];
    renderizarSaldos();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

async function carregarMovimentacoes() {
  try {
    const response = await fetch(`${estoqueMateriaPrimaApiBaseUrl}/movimentacoes`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar as movimentacoes.');
    }

    movimentacoesCache = result;
    renderizarMovimentacoes();
  } catch (error) {
    movimentacoesCache = [];
    renderizarMovimentacoes();
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarSaldos() {
  refs.total.textContent = `${saldosCache.length} registro(s) encontrado(s)`;

  if (saldosCache.length === 0) {
    refs.tabela.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum saldo de materia-prima encontrado.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = saldosCache.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.nome)}</td>
      <td>${escapeHtml(item.categoria)}</td>
      <td>${escapeHtml(formatarReferencia(item))}</td>
      <td>${escapeHtml(item.unidade_estoque)}</td>
      <td class="table-quantity">${formatQuantity(item.quantidade)} ${escapeHtml(item.unidade_estoque)}</td>
      <td>${escapeHtml(item.fornecedores_nomes || '-')}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="ajustar" data-id="${item.id_materia_prima}">Ajustar saldo</button>
            <button type="button" class="row-menu-item" data-action="entrada" data-id="${item.id_materia_prima}">Nova entrada</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function renderizarMovimentacoes() {
  refs.totalMovimentacoes.textContent = `${movimentacoesCache.length} movimentacao(oes)`;

  if (movimentacoesCache.length === 0) {
    refs.movimentacoesTabela.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma movimentacao registrada.</td></tr>';
    return;
  }

  refs.movimentacoesTabela.innerHTML = movimentacoesCache.slice(0, 20).map((item) => `
    <tr>
      <td>${formatarData(item.data_movimentacao)}</td>
      <td>${escapeHtml(item.tipo_movimentacao)}</td>
      <td>${escapeHtml(`${item.codigo} - ${item.nome}`)}</td>
      <td>${formatQuantity(item.quantidade)} ${escapeHtml(item.unidade)}</td>
      <td>${item.saldo_resultante === null ? '-' : `${formatQuantity(item.saldo_resultante)} ${escapeHtml(item.unidade)}`}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  const laminados = saldosCache.filter((item) => item.categoria === 'LAMINADO').length;
  const fundidos = saldosCache.filter((item) => item.categoria === 'FUNDIDO').length;

  document.getElementById('metric-mp-com-saldo').textContent = String(saldosCache.length);
  document.getElementById('metric-mp-laminados').textContent = String(laminados);
  document.getElementById('metric-mp-fundidos').textContent = String(fundidos);
}

function abrirModalMovimentacao(tipo, materiaPrimaId = null) {
  resetModalMovimentacao();
  refs.modalTipo.value = tipo;

  const isAjuste = tipo === 'AJUSTE';
  refs.modalTitulo.textContent = isAjuste ? 'Ajuste de Saldo' : 'Nova Entrada';
  refs.modalSubtitulo.textContent = isAjuste
    ? 'Defina o novo saldo final na unidade base da materia-prima.'
    : 'Informe a entrada na unidade base da materia-prima.';
  refs.modalQuantidadeLabel.textContent = isAjuste ? 'Novo saldo' : 'Quantidade de entrada';
  document.getElementById('btn-salvar-modal-mp-estoque').textContent = isAjuste ? 'Salvar Ajuste' : 'Salvar Entrada';

  if (materiaPrimaId) {
    selecionarMateriaPrimaPorId(materiaPrimaId);
  }

  openModal(refs.modal);
}

function fecharModalMovimentacao() {
  resetModalMovimentacao();
  closeModal(refs.modal);
}

function resetModalMovimentacao() {
  document.getElementById('movimentacao-mp-form').reset();
  refs.modalTipo.value = 'ENTRADA';
  refs.modalMateriaPrimaId.value = '';
  refs.modalBusca.value = '';
  refs.modalResumo.className = 'selected-tags empty';
  refs.modalResumo.textContent = 'Selecione uma materia-prima para continuar.';
  refs.modalMensagem.className = 'message hidden';
  refs.modalMensagem.textContent = '';
  refs.modalSugestoes.classList.add('hidden');
  refs.modalSugestoes.innerHTML = '';
}

function renderizarSugestoes(termo) {
  const filtro = termo.toLowerCase();
  const itens = materiasPrimasCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return `${item.codigo} ${item.nome} ${item.liga || ''}`.toLowerCase().includes(filtro);
  }).slice(0, 8);

  if (itens.length === 0) {
    refs.modalSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma materia-prima encontrada.</div>';
    refs.modalSugestoes.classList.remove('hidden');
    return;
  }

  refs.modalSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-mp-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.nome}`)}</strong>
      <span>${escapeHtml(`${item.categoria} | ${item.geometria || '-'} | ${formatarBitolaAutocomplete(item)}`)}</span>
    </button>
  `).join('');
  refs.modalSugestoes.classList.remove('hidden');
}

function handleSugestaoClick(event) {
  const option = event.target.closest('button[data-mp-id]');
  if (!option) {
    return;
  }

  selecionarMateriaPrimaPorId(option.dataset.mpId);
}

function selecionarMateriaPrimaPorId(id) {
  const materiaPrima = materiasPrimasCache.find((item) => Number(item.id) === Number(id));
  if (!materiaPrima) {
    return;
  }

  const saldoAtual = saldosCache.find((item) => Number(item.id_materia_prima) === Number(materiaPrima.id));
  refs.modalMateriaPrimaId.value = String(materiaPrima.id);
  refs.modalBusca.value = `${materiaPrima.codigo} - ${materiaPrima.nome}`;
  refs.modalResumo.className = 'selected-tags';
  refs.modalResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`Categoria: ${materiaPrima.categoria}`)}</span>
    <span class="selected-tag">${escapeHtml(`Referencia: ${formatarBitolaAutocomplete(materiaPrima)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo atual: ${formatQuantity(saldoAtual ? saldoAtual.quantidade : 0)} ${materiaPrima.unidade_estoque}`)}</span>
  `;
  refs.modalSugestoes.classList.add('hidden');
  refs.modalSugestoes.innerHTML = '';
}

async function handleSalvarMovimentacao(event) {
  event.preventDefault();

  const isAjuste = refs.modalTipo.value === 'AJUSTE';
  const endpoint = isAjuste
    ? `${estoqueMateriaPrimaApiBaseUrl}/ajuste`
    : `${estoqueMateriaPrimaApiBaseUrl}/entrada`;
  const payload = isAjuste
    ? {
      id_materia_prima: refs.modalMateriaPrimaId.value,
      novo_saldo: refs.modalQuantidade.value,
      observacao: refs.modalObservacao.value.trim()
    }
    : {
      id_materia_prima: refs.modalMateriaPrimaId.value,
      quantidade: refs.modalQuantidade.value,
      observacao: refs.modalObservacao.value.trim()
    };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalMovimentacao();
    mostrarMensagem(isAjuste ? 'Saldo ajustado com sucesso.' : 'Entrada registrada com sucesso.', 'success');
    await Promise.all([carregarSaldos(), carregarMovimentacoes()]);
  } catch (error) {
    refs.modalMensagem.textContent = error.message;
    refs.modalMensagem.className = 'message error';
    refs.modalMensagem.classList.remove('hidden');
  }
}

function handleTabelaActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'ajustar') {
    abrirModalMovimentacao('AJUSTE', button.dataset.id);
  }

  if (button.dataset.action === 'entrada') {
    abrirModalMovimentacao('ENTRADA', button.dataset.id);
  }
}

function limparFiltros() {
  refs.filtroForm.reset();
  carregarSaldos();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarSaldos(), 220);
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'movimentacao-mp') {
    fecharModalMovimentacao();
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

  if (!event.target.closest('.autocomplete')) {
    refs.modalSugestoes.classList.add('hidden');
    refs.modalSugestoes.innerHTML = '';
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
  refs.modalSugestoes.classList.add('hidden');
  refs.modalSugestoes.innerHTML = '';

  if (!refs.modal.classList.contains('hidden')) {
    fecharModalMovimentacao();
    return;
  }

  if (refs.drawer.classList.contains('is-open')) {
    toggleDrawer(false);
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
  document.body.classList.remove('has-modal');
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

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function formatarReferencia(item) {
  if (item.categoria === 'FUNDIDO') {
    return item.liga || 'Fundido';
  }

  return formatarBitolaAutocomplete(item);
}

function formatarBitolaAutocomplete(item) {
  if (item.bitola && item.bitola_mm) {
    return `${item.bitola} | ${formatQuantity(item.bitola_mm)} mm`;
  }

  if (item.bitola) {
    return item.bitola;
  }

  if (item.bitola_mm) {
    return `${formatQuantity(item.bitola_mm)} mm`;
  }

  return item.geometria || '-';
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  });
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
