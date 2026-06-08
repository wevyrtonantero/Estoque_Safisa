const estoqueMateriaPrimaApiBaseUrl = '/api/estoque-materias-primas';
const materiasPrimasAutocompleteApiBaseUrl = '/api/materias-primas-autocomplete';
const ESTOQUE_MINIMO_PADRAO_TREFILADO = 60;
const ESTOQUE_MINIMO_PADRAO_FUNDIDO = 50;

let saldosCache = [];
let movimentacoesCache = [];
let materiasPrimasCache = [];
let filtroDebounceTimer = null;
let historicoMateriaPrimaIdAtual = null;
let entradasLoteCache = [];

const refs = {
  mensagem: document.getElementById('estoque-mp-mensagem'),
  tabela: document.getElementById('estoque-mp-tbody'),
  listaTitulo: document.getElementById('estoque-mp-lista-titulo'),
  total: document.getElementById('total-estoque-mp'),
  totalAlertas: document.getElementById('metric-mp-alertas'),
  totalCriticos: document.getElementById('metric-mp-criticos'),
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
  modalLoteBloco: document.getElementById('movimentacao-mp-lote-bloco'),
  modalLoteTotal: document.getElementById('movimentacao-mp-lote-total'),
  modalLoteTbody: document.getElementById('movimentacao-mp-lote-tbody'),
  btnSalvarModal: document.getElementById('btn-salvar-modal-mp-estoque'),
  btnConfirmarLote: document.getElementById('btn-confirmar-lote-mp-estoque'),
  historicoModal: document.getElementById('historico-mp-modal'),
  historicoModalTitulo: document.getElementById('historico-mp-modal-title'),
  historicoMensagem: document.getElementById('historico-mp-mensagem'),
  drawer: document.getElementById('app-drawer'),
  drawerScrim: document.getElementById('drawer-scrim')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarMateriasPrimas(), carregarSaldos()]);
});

function bindEvents() {
  document.getElementById('menu-toggle').addEventListener('click', () => toggleDrawer(true));
  document.getElementById('drawer-close').addEventListener('click', () => toggleDrawer(false));
  refs.drawerScrim.addEventListener('click', () => toggleDrawer(false));

  document.getElementById('btn-nova-entrada-mp').addEventListener('click', () => abrirModalMovimentacao('ENTRADA'));
  document.getElementById('btn-ajuste-mp').addEventListener('click', () => abrirModalMovimentacao('AJUSTE'));
  document.getElementById('btn-historico-mp').addEventListener('click', () => abrirModalHistorico());
  document.getElementById('btn-fechar-modal-mp-estoque').addEventListener('click', fecharModalMovimentacao);
  document.getElementById('btn-cancelar-modal-mp-estoque').addEventListener('click', fecharModalMovimentacao);
  refs.btnConfirmarLote.addEventListener('click', handleConfirmarLoteMovimentacao);
  document.getElementById('btn-fechar-modal-mp-historico').addEventListener('click', fecharModalHistorico);
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
  refs.historicoModal.addEventListener('click', handleBackdrop);
  refs.tabela.addEventListener('click', handleTabelaActions);
  refs.modalLoteTbody.addEventListener('click', handleLoteActions);
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
  params.append('modo', 'TODOS');

  try {
    const endpoint = `${estoqueMateriaPrimaApiBaseUrl}/saldos?${params.toString()}`;
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

async function carregarMovimentacoes(idMateriaPrima = null) {
  const params = new URLSearchParams();
  if (Number.isInteger(idMateriaPrima)) {
    params.append('id_materia_prima', String(idMateriaPrima));
  }

  try {
    const endpoint = params.toString()
      ? `${estoqueMateriaPrimaApiBaseUrl}/movimentacoes?${params.toString()}`
      : `${estoqueMateriaPrimaApiBaseUrl}/movimentacoes`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar as movimentacoes.');
    }

    movimentacoesCache = result;
    renderizarMovimentacoes();
  } catch (error) {
    movimentacoesCache = [];
    renderizarMovimentacoes();
    mostrarMensagemHistorico(error.message, 'error');
  }
}

function renderizarSaldos() {
  refs.listaTitulo.textContent = buscaIncluiMateriasSemSaldo()
    ? 'Materias-primas Localizadas'
    : 'Materias-primas Monitoradas';
  refs.total.textContent = `${saldosCache.length} registro(s) encontrado(s)`;

  if (saldosCache.length === 0) {
    refs.tabela.innerHTML = buscaIncluiMateriasSemSaldo()
      ? '<tr><td colspan="10" class="empty-state">Nenhuma materia-prima encontrada para a busca informada.</td></tr>'
      : '<tr><td colspan="10" class="empty-state">Nenhuma materia-prima monitorada no momento.</td></tr>';
    return;
  }

  const itensOrdenados = [...saldosCache].sort((a, b) => {
    const pesoA = obterPesoStatusEstoque(a);
    const pesoB = obterPesoStatusEstoque(b);

    if (pesoA !== pesoB) {
      return pesoA - pesoB;
    }

    return String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR');
  });

  refs.tabela.innerHTML = itensOrdenados.map((item) => `
    <tr class="${obterClasseLinhaEstoque(item)}">
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.nome)}</td>
      <td>${renderizarCategoriaGeometria(item)}</td>
      <td>${escapeHtml(formatarReferencia(item))}</td>
      <td>${escapeHtml(item.unidade_estoque)}</td>
      <td class="table-quantity">${renderizarQuantidadeEstoque(item)}</td>
      <td>${renderizarLimiteEstoque(item)}</td>
      <td>${renderizarStatusEstoque(item)}</td>
      <td>${escapeHtml(item.fornecedores_nomes || '-')}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="historico" data-id="${item.id_materia_prima}">Ver historico</button>
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
    refs.movimentacoesTabela.innerHTML = historicoMateriaPrimaIdAtual
      ? '<tr><td colspan="6" class="empty-state">Nenhuma movimentacao encontrada para esta materia-prima.</td></tr>'
      : '<tr><td colspan="6" class="empty-state">Nenhuma movimentacao registrada.</td></tr>';
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
  const trefilados = saldosCache.filter((item) => item.categoria === 'TREFILADO').length;
  const fundidos = saldosCache.filter((item) => item.categoria === 'FUNDIDO').length;
  const alertas = saldosCache.filter((item) => isMateriaPrimaEmAlerta(item)).length;
  const criticos = saldosCache.filter((item) => obterStatusEstoqueKey(item) === 'CRITICO').length;

  document.getElementById('metric-mp-com-saldo').textContent = String(saldosCache.length);
  document.getElementById('metric-mp-trefilados').textContent = String(trefilados);
  document.getElementById('metric-mp-fundidos').textContent = String(fundidos);
  refs.totalAlertas.textContent = String(alertas);
  refs.totalCriticos.textContent = `${criticos} criticos`;
}

function abrirModalMovimentacao(tipo, materiaPrimaId = null) {
  resetModalMovimentacao();
  refs.modalTipo.value = tipo;

  const isAjuste = tipo === 'AJUSTE';
  refs.modalTitulo.textContent = isAjuste ? 'Ajuste de Saldo' : 'Nova Entrada';
  refs.modalSubtitulo.textContent = isAjuste
    ? 'Defina o novo saldo final na unidade base da materia-prima.'
    : 'Monte uma lista de entradas e confirme tudo de uma vez.';
  refs.modalQuantidadeLabel.textContent = isAjuste ? 'Novo saldo' : 'Quantidade de entrada';
  refs.btnSalvarModal.textContent = isAjuste ? 'Salvar Ajuste' : 'Adicionar a Lista';
  refs.btnConfirmarLote.classList.toggle('hidden', isAjuste);
  refs.modalLoteBloco.classList.toggle('hidden', isAjuste);

  if (materiaPrimaId) {
    selecionarMateriaPrimaPorId(materiaPrimaId);
  }

  openModal(refs.modal);
}

async function abrirModalHistorico(materiaPrimaId = null) {
  const parsedMateriaPrimaId = materiaPrimaId === null || materiaPrimaId === undefined || materiaPrimaId === ''
    ? null
    : Number.parseInt(materiaPrimaId, 10);
  historicoMateriaPrimaIdAtual = Number.isInteger(parsedMateriaPrimaId) ? parsedMateriaPrimaId : null;
  const materiaPrima = historicoMateriaPrimaIdAtual
    ? encontrarMateriaPrima(historicoMateriaPrimaIdAtual)
    : null;

  refs.historicoModalTitulo.textContent = materiaPrima
    ? `Historico de ${materiaPrima.codigo}`
    : 'Movimentacoes de Materia-prima';
  refs.totalMovimentacoes.textContent = 'Carregando movimentacoes...';
  refs.movimentacoesTabela.innerHTML = '<tr><td colspan="6" class="empty-state">Carregando movimentacoes...</td></tr>';
  esconderMensagemHistorico();
  openModal(refs.historicoModal);
  await carregarMovimentacoes(historicoMateriaPrimaIdAtual);
}

function fecharModalHistorico() {
  historicoMateriaPrimaIdAtual = null;
  movimentacoesCache = [];
  refs.totalMovimentacoes.textContent = '0 movimentacao(oes)';
  refs.movimentacoesTabela.innerHTML = '<tr><td colspan="6" class="empty-state">Abra o historico para visualizar as movimentacoes.</td></tr>';
  esconderMensagemHistorico();
  closeModal(refs.historicoModal);
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
  refs.modalResumo.classList.add('selected-tags', 'empty');
  refs.modalResumo.textContent = 'Selecione uma materia-prima para continuar.';
  refs.modalMensagem.className = 'message hidden';
  refs.modalMensagem.textContent = '';
  refs.modalSugestoes.classList.add('hidden');
  refs.modalSugestoes.innerHTML = '';
  entradasLoteCache = [];
  renderizarLoteMovimentacao();
}

function renderizarSugestoes(termo) {
  const filtro = normalizarBusca(termo);
  const itens = materiasPrimasCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.nome} ${item.liga || ''}`).includes(filtro);
  }).sort((a, b) => compararPorPrioridadeCodigo(a, b, filtro)).slice(0, 8);

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
  refs.modalResumo.classList.remove('empty');
  refs.modalResumo.classList.add('selected-tags');
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
  if (!isAjuste) {
    adicionarEntradaAoLote();
    return;
  }

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
    await Promise.all([carregarSaldos(), carregarMovimentacoesSeHistoricoAberto()]);
  } catch (error) {
    refs.modalMensagem.textContent = error.message;
    refs.modalMensagem.className = 'message error';
    refs.modalMensagem.classList.remove('hidden');
  }
}

function adicionarEntradaAoLote() {
  const materiaPrimaId = Number.parseInt(refs.modalMateriaPrimaId.value, 10);
  const quantidade = Number.parseFloat(String(refs.modalQuantidade.value || '').replace(',', '.'));
  const observacao = refs.modalObservacao.value.trim();
  const materiaPrima = encontrarMateriaPrima(materiaPrimaId);

  if (!Number.isInteger(materiaPrimaId) || !materiaPrima) {
    throwErroLoteMovimentacao('Selecione uma materia-prima valida antes de adicionar.');
    return;
  }

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throwErroLoteMovimentacao('Informe uma quantidade maior que zero para adicionar.');
    return;
  }

  entradasLoteCache.push({
    id_materia_prima: materiaPrimaId,
    codigo: materiaPrima.codigo,
    nome: materiaPrima.nome,
    quantidade,
    unidade_estoque: materiaPrima.unidade_estoque,
    observacao
  });

  limparCamposEntradaMovimentacao();
  renderizarLoteMovimentacao();
  refs.modalMensagem.textContent = 'Entrada adicionada a lista.';
  refs.modalMensagem.className = 'message success';
  refs.modalMensagem.classList.remove('hidden');
}

async function handleConfirmarLoteMovimentacao() {
  if (refs.modalTipo.value === 'AJUSTE') {
    return;
  }

  if (!entradasLoteCache.length) {
    throwErroLoteMovimentacao('Adicione pelo menos uma entrada antes de confirmar.');
    return;
  }

  try {
    const response = await fetch(`${estoqueMateriaPrimaApiBaseUrl}/entrada-lote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: entradasLoteCache.map((item) => ({
          id_materia_prima: item.id_materia_prima,
          quantidade: item.quantidade,
          observacao: item.observacao
        }))
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalMovimentacao();
    mostrarMensagem(`${result.total_itens || entradasLoteCache.length} entrada(s) de materia-prima registrada(s) com sucesso.`, 'success');
    await Promise.all([carregarSaldos(), carregarMovimentacoesSeHistoricoAberto()]);
  } catch (error) {
    throwErroLoteMovimentacao(error.message);
  }
}

function handleLoteActions(event) {
  const button = event.target.closest('button[data-lote-index]');
  if (!button) {
    return;
  }

  const index = Number.parseInt(button.dataset.loteIndex, 10);
  if (!Number.isInteger(index) || index < 0 || index >= entradasLoteCache.length) {
    return;
  }

  entradasLoteCache.splice(index, 1);
  renderizarLoteMovimentacao();
}

function renderizarLoteMovimentacao() {
  refs.modalLoteTotal.textContent = `${entradasLoteCache.length} item(ns) na lista`;
  refs.btnConfirmarLote.disabled = entradasLoteCache.length === 0;

  if (!entradasLoteCache.length) {
    refs.modalLoteTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma entrada adicionada.</td></tr>';
    return;
  }

  refs.modalLoteTbody.innerHTML = entradasLoteCache.map((item, index) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.nome)}</td>
      <td class="table-quantity">${formatQuantity(item.quantidade)} ${escapeHtml(item.unidade_estoque || '')}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
      <td class="table-actions-cell">
        <button type="button" class="btn btn-danger" data-lote-index="${index}">Remover</button>
      </td>
    </tr>
  `).join('');
}

function limparCamposEntradaMovimentacao() {
  refs.modalMateriaPrimaId.value = '';
  refs.modalBusca.value = '';
  refs.modalQuantidade.value = '';
  refs.modalObservacao.value = '';
  refs.modalResumo.classList.add('selected-tags', 'empty');
  refs.modalResumo.textContent = 'Selecione uma materia-prima para continuar.';
  refs.modalSugestoes.classList.add('hidden');
  refs.modalSugestoes.innerHTML = '';
}

function throwErroLoteMovimentacao(message) {
  refs.modalMensagem.textContent = message;
  refs.modalMensagem.className = 'message error';
  refs.modalMensagem.classList.remove('hidden');
}

function handleTabelaActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'historico') {
    abrirModalHistorico(button.dataset.id);
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

  if (event.target.dataset.closeModal === 'historico-mp') {
    fecharModalHistorico();
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

  if (!refs.historicoModal.classList.contains('hidden')) {
    fecharModalHistorico();
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

function mostrarMensagemHistorico(texto, tipo) {
  refs.historicoMensagem.textContent = texto;
  refs.historicoMensagem.className = `message ${tipo}`;
  refs.historicoMensagem.classList.remove('hidden');
}

function esconderMensagemHistorico() {
  refs.historicoMensagem.className = 'message hidden';
  refs.historicoMensagem.textContent = '';
}

async function carregarMovimentacoesSeHistoricoAberto() {
  if (refs.historicoModal.classList.contains('hidden')) {
    return;
  }

  await carregarMovimentacoes(historicoMateriaPrimaIdAtual);
}

function encontrarMateriaPrima(idMateriaPrima) {
  return saldosCache.find((item) => Number(item.id_materia_prima) === Number(idMateriaPrima))
    || materiasPrimasCache.find((item) => Number(item.id) === Number(idMateriaPrima))
    || null;
}

function buscaIncluiMateriasSemSaldo() {
  return Boolean(
    document.getElementById('filtro-mp-estoque-codigo').value.trim()
    || document.getElementById('filtro-mp-estoque-nome').value.trim()
  );
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

function renderizarCategoriaGeometria(item) {
  const categoria = String(item.categoria || '').toUpperCase();

  if (categoria === 'FUNDIDO') {
    return '<span class="category-geometry-chip is-fundido"><span>Fund.</span></span>';
  }

  if (categoria !== 'TREFILADO') {
    return `<span class="category-geometry-chip"><span>${escapeHtml(categoria || '-')}</span></span>`;
  }

  const geometria = obterGeometriaVisual(item.geometria);

  return `
    <span class="category-geometry-chip is-trefilado" title="${escapeHtml(`Trefilado - ${geometria.titulo}`)}">
      <span class="geometry-symbol ${geometria.classe}" aria-hidden="true"></span>
      <span>Tref.</span>
      <small>${escapeHtml(geometria.label)}</small>
    </span>
  `;
}

function obterGeometriaVisual(value) {
  const geometria = String(value || '').trim().toUpperCase();
  const geometriaMap = {
    REDONDO: { classe: 'is-round', label: 'Red.', titulo: 'REDONDO' },
    QUADRADO: { classe: 'is-square', label: 'Quad.', titulo: 'QUADRADO' },
    SEXTAVADO: { classe: 'is-hex', label: 'Sext.', titulo: 'SEXTAVADO' },
    'FITA / BOBINA': { classe: 'is-strip', label: 'Fita', titulo: 'FITA / BOBINA' }
  };

  return geometriaMap[geometria] || {
    classe: 'is-generic',
    label: geometria ? geometria.slice(0, 5) : '-',
    titulo: geometria || '-'
  };
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

function getEstoqueMinimoPadrao(item) {
  return String(item?.unidade_estoque || '').toUpperCase() === 'UN'
    ? ESTOQUE_MINIMO_PADRAO_FUNDIDO
    : ESTOQUE_MINIMO_PADRAO_TREFILADO;
}

function getEstoqueMinimoEfetivo(item) {
  const valorConfigurado = Number(item?.estoque_minimo);
  if (Number.isFinite(valorConfigurado) && valorConfigurado > 0) {
    return valorConfigurado;
  }

  return getEstoqueMinimoPadrao(item);
}

function usaEstoqueMinimoPadrao(item) {
  const valorConfigurado = Number(item?.estoque_minimo);
  return !(Number.isFinite(valorConfigurado) && valorConfigurado > 0);
}

function obterStatusEstoqueKey(item) {
  const quantidadeAtual = Number(item?.quantidade || 0);
  const limite = getEstoqueMinimoEfetivo(item);

  if (quantidadeAtual < limite) {
    return 'CRITICO';
  }

  if (quantidadeAtual === limite) {
    return 'ATENCAO';
  }

  return 'NORMAL';
}

function obterPesoStatusEstoque(item) {
  const status = obterStatusEstoqueKey(item);

  if (status === 'CRITICO') return 0;
  if (status === 'ATENCAO') return 1;
  return 2;
}

function isMateriaPrimaEmAlerta(item) {
  return obterStatusEstoqueKey(item) !== 'NORMAL';
}

function obterClasseLinhaEstoque(item) {
  return isMateriaPrimaEmAlerta(item) ? 'table-row-attention' : '';
}

function renderizarStatusEstoque(item) {
  const status = obterStatusEstoqueKey(item);

  if (status === 'CRITICO') {
    return '<span class="status-chip is-danger">Abaixo do limite</span>';
  }

  if (status === 'ATENCAO') {
    return '<span class="status-chip is-warning">No limite</span>';
  }

  return '<span class="status-chip is-success">Normal</span>';
}

function renderizarQuantidadeEstoque(item) {
  const quantidade = `${formatQuantity(item.quantidade)} ${String(item.unidade_estoque || '').trim()}`;
  const status = obterStatusEstoqueKey(item);

  if (status === 'CRITICO') {
    return `<span class="status-chip is-danger">${escapeHtml(quantidade)}</span>`;
  }

  if (status === 'ATENCAO') {
    return `<span class="status-chip is-warning">${escapeHtml(quantidade)}</span>`;
  }

  return escapeHtml(quantidade);
}

function renderizarLimiteEstoque(item) {
  const limite = `${formatQuantity(getEstoqueMinimoEfetivo(item))} ${String(item.unidade_estoque || '').trim()}`;
  const detalhe = usaEstoqueMinimoPadrao(item) ? 'Padrao' : 'Configurado';

  return `
    <strong>${escapeHtml(limite)}</strong><br>
    <small>${escapeHtml(detalhe)}</small>
  `;
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

function normalizarBusca(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function compararPorPrioridadeCodigo(a, b, termo) {
  const rankA = obterPrioridadeCodigo(a, termo);
  const rankB = obterPrioridadeCodigo(b, termo);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return String(a?.codigo || '').localeCompare(String(b?.codigo || ''), 'pt-BR', { numeric: true })
    || String(a?.descricao || a?.nome || '').localeCompare(String(b?.descricao || b?.nome || ''), 'pt-BR', { numeric: true });
}

function obterPrioridadeCodigo(item, termo) {
  const busca = normalizarBusca(termo);
  if (!busca) {
    return 0;
  }

  const codigo = normalizarBusca(item?.codigo);
  const descricao = normalizarBusca(item?.descricao || item?.nome);

  if (codigo === busca) return 0;
  if (codigo.startsWith(busca)) return 1;
  if (codigo.includes(busca)) return 2;
  if (descricao.includes(busca)) return 3;
  return 4;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
