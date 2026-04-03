// Script principal da tela de controle de estoque.
const estoquesApiBaseUrl = '/api/estoques';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const estoquePrioridadesApiBaseUrl = '/api/estoque/prioridades';
const estoqueItensApiBaseUrl = '/api/estoque/itens';
const estoqueMovimentacoesApiBaseUrl = '/api/estoque/movimentacoes';
const entradaInicialApiBaseUrl = '/api/estoque/entrada-inicial';
const transferenciaApiBaseUrl = '/api/estoque/transferencia';
const ajusteApiBaseUrl = '/api/estoque/ajuste';
const saidaApiBaseUrl = '/api/estoque/saida';
let estoquesCache = [];
let itensCache = [];
let saldosCache = [];
let saldosOperacionaisCache = [];
let saidaLista = [];
let estruturasSubmontagemCache = new Map();
let filtroDebounceTimer = null;
const expedicaoNomeCorreto = 'Expedi\u00e7\u00e3o';

function obterEstoqueExpedicao() {
  return estoquesCache.find((estoque) => Number(estoque.id) === 3)
    || estoquesCache.find((estoque) => String(estoque.nome || '') === expedicaoNomeCorreto)
    || null;
}

function isRegistroExpedicao(registro) {
  const estoqueExpedicao = obterEstoqueExpedicao();

  if (estoqueExpedicao && Number(registro.id_estoque) === Number(estoqueExpedicao.id)) {
    return true;
  }

  return String(registro.estoque_nome || '') === expedicaoNomeCorreto;
}

const filtroForm = document.getElementById('estoque-filtro-form');
const estoqueMensagemBox = document.getElementById('estoque-mensagem');
const totalSaldosBox = document.getElementById('total-saldos');
const saldosTbody = document.getElementById('estoque-saldos-tbody');

const entradaModal = document.getElementById('entrada-modal');
const transferenciaModal = document.getElementById('transferencia-modal');
const saidaModal = document.getElementById('saida-modal');
const ajusteModal = document.getElementById('ajuste-modal');
const historicoModal = document.getElementById('historico-modal');

const entradaMensagemBox = document.getElementById('entrada-mensagem');
const transferenciaMensagemBox = document.getElementById('transferencia-mensagem');
const saidaMensagemBox = document.getElementById('saida-mensagem');
const ajusteMensagemBox = document.getElementById('ajuste-mensagem');
const historicoMensagemBox = document.getElementById('historico-mensagem');

const entradaForm = document.getElementById('entrada-form');
const transferenciaForm = document.getElementById('transferencia-form');
const saidaForm = document.getElementById('saida-form');
const ajusteForm = document.getElementById('ajuste-form');

const btnNovaEntrada = document.getElementById('btn-nova-entrada');
const btnNovaTransferencia = document.getElementById('btn-nova-transferencia');
const btnNovaSaida = document.getElementById('btn-nova-saida');
const btnLimparFiltros = document.getElementById('btn-limpar-filtros-estoque');

const menuToggleButton = document.getElementById('menu-toggle');
const drawerCloseButton = document.getElementById('drawer-close');
const drawerScrim = document.getElementById('drawer-scrim');
const appDrawer = document.getElementById('app-drawer');

const entradaItemBuscaInput = document.getElementById('entrada-item-busca');
const entradaItemIdInput = document.getElementById('entrada-item-id');
const entradaItemSugestoes = document.getElementById('entrada-item-sugestoes');
const entradaEstoqueOrigemComponentesSelect = document.getElementById('entrada-estoque-origem-componentes');
const entradaOrigemWrapper = document.getElementById('entrada-origem-wrapper');
const entradaSubmontagemPreview = document.getElementById('entrada-submontagem-preview');
const transferenciaItemBuscaInput = document.getElementById('transferencia-item-busca');
const transferenciaItemIdInput = document.getElementById('transferencia-item-id');
const transferenciaItemSugestoes = document.getElementById('transferencia-item-sugestoes');
const saidaItemBuscaInput = document.getElementById('saida-item-busca');
const saidaItemIdInput = document.getElementById('saida-item-id');
const saidaItemSugestoes = document.getElementById('saida-item-sugestoes');

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarEstoques(), carregarItens()]);
  await recarregarSaldos();
});

// Conecta filtros, modais, tabela e menu lateral.
function bindEvents() {
  filtroForm.addEventListener('submit', handleFilterSubmit);
  filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });

  btnLimparFiltros.addEventListener('click', limparFiltros);
  btnNovaEntrada.addEventListener('click', abrirModalEntrada);
  btnNovaTransferencia.addEventListener('click', () => abrirModalTransferencia());
  btnNovaSaida.addEventListener('click', abrirModalSaida);

  entradaForm.addEventListener('submit', handleEntradaInicial);
  transferenciaForm.addEventListener('submit', handleTransferencia);
  saidaForm.addEventListener('submit', (event) => event.preventDefault());
  ajusteForm.addEventListener('submit', handleAjuste);
  saldosTbody.addEventListener('click', handleSaldoActions);
  document.getElementById('saida-tbody').addEventListener('click', handleSaidaListActions);

  document.getElementById('btn-cancelar-modal-entrada').addEventListener('click', fecharModalEntrada);
  document.getElementById('btn-fechar-modal-entrada').addEventListener('click', fecharModalEntrada);
  document.getElementById('btn-cancelar-modal-transferencia').addEventListener('click', fecharModalTransferencia);
  document.getElementById('btn-fechar-modal-transferencia').addEventListener('click', fecharModalTransferencia);
  document.getElementById('btn-cancelar-modal-saida').addEventListener('click', fecharModalSaida);
  document.getElementById('btn-fechar-modal-saida').addEventListener('click', fecharModalSaida);
  document.getElementById('btn-adicionar-lista-saida').addEventListener('click', adicionarItemNaListaSaida);
  document.getElementById('btn-adicionar-mais-um-saida').addEventListener('click', adicionarMaisUmNaListaSaida);
  document.getElementById('btn-limpar-item-saida').addEventListener('click', limparItemSaidaAtual);
  document.getElementById('btn-limpar-lista-saida').addEventListener('click', limparListaSaida);
  document.getElementById('btn-baixar-tudo-saida').addEventListener('click', baixarTudoSaida);
  document.getElementById('btn-cancelar-modal-ajuste').addEventListener('click', fecharModalAjuste);
  document.getElementById('btn-fechar-modal-ajuste').addEventListener('click', fecharModalAjuste);
  document.getElementById('btn-fechar-modal-historico').addEventListener('click', fecharModalHistorico);
  document.getElementById('entrada-quantidade').addEventListener('input', atualizarPainelEntradaSubmontagem);
  document.getElementById('entrada-estoque').addEventListener('change', atualizarPainelEntradaSubmontagem);
  entradaEstoqueOrigemComponentesSelect.addEventListener('change', atualizarPainelEntradaSubmontagem);

  entradaModal.addEventListener('click', handleModalBackdrop);
  transferenciaModal.addEventListener('click', handleModalBackdrop);
  saidaModal.addEventListener('click', handleModalBackdrop);
  ajusteModal.addEventListener('click', handleModalBackdrop);
  historicoModal.addEventListener('click', handleModalBackdrop);

  menuToggleButton.addEventListener('click', abrirDrawer);
  drawerCloseButton.addEventListener('click', fecharDrawer);
  drawerScrim.addEventListener('click', fecharDrawer);
  document.addEventListener('keydown', handleKeyboardShortcuts);
  document.addEventListener('click', handleGlobalRowMenuClick);

  bindAutocompleteEvents();
}

function closeAllRowMenus(exceptMenu = null) {
  document.querySelectorAll('.row-menu[open]').forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) {
      return;
    }

    menu.removeAttribute('open');
  });
}

function handleGlobalRowMenuClick(event) {
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

// Carrega estoques para filtros e selects dos modais.
async function carregarEstoques() {
  try {
    const response = await fetch(estoquesApiBaseUrl);
    const estoques = await response.json();

    if (!response.ok) {
      throw new Error(estoques.message || 'Nao foi possivel carregar os estoques.');
    }

    estoquesCache = estoques;
    preencherSelectEstoques(document.getElementById('filtro-estoque'), 'Todos');
    preencherSelectEstoques(document.getElementById('entrada-estoque'), 'Selecione');
    preencherSelectEstoques(entradaEstoqueOrigemComponentesSelect, 'Selecione');
    preencherSelectEstoques(document.getElementById('transferencia-estoque-origem'), 'Selecione');
    preencherSelectEstoques(document.getElementById('transferencia-estoque-destino'), 'Selecione');
    document.getElementById('metric-estoques-ativos').textContent = String(estoques.length);
  } catch (error) {
    mostrarMensagemEstoque(error.message, 'error');
  }
}

// Carrega pecas e submontagens para os modais de movimentacao.
async function carregarItens() {
  try {
    const response = await fetch(estoqueItensApiBaseUrl);
    const itens = await response.json();

    if (!response.ok) {
      throw new Error(itens.message || 'Nao foi possivel carregar os itens do estoque.');
    }

    itensCache = itens;
    await preCarregarEstruturasSubmontagem();
  } catch (error) {
    mostrarMensagemEstoque(error.message, 'error');
  }
}

async function preCarregarEstruturasSubmontagem() {
  const submontagens = itensCache.filter((item) => item.classificacao === 'SUBMONTAGEM');

  await Promise.all(submontagens.map(async (submontagem) => {
    if (estruturasSubmontagemCache.has(submontagem.id)) {
      return;
    }

    try {
      const response = await fetch(`/api/submontagens/${submontagem.id}/componentes`);
      const componentes = await response.json();

      if (response.ok) {
        estruturasSubmontagemCache.set(submontagem.id, componentes);
      }
    } catch (_) {
      // Mantem a busca resiliente mesmo se alguma estrutura falhar.
    }
  }));
}

// Lista os saldos da tela principal com filtros dinamicos.
async function carregarSaldos() {
  const params = new URLSearchParams();
  const filtros = {
    estoque: document.getElementById('filtro-estoque').value,
    codigo: document.getElementById('filtro-codigo-estoque').value.trim(),
    descricao: document.getElementById('filtro-descricao-estoque').value.trim(),
    classificacao: document.getElementById('filtro-classificacao-estoque').value
  };
  const filtroEstado = String(document.getElementById('filtro-estado-estoque').value || '').trim().toUpperCase();

  Object.entries(filtros).forEach(([key, value]) => {
    if (value) {
      params.append(key, value);
    }
  });

  if (filtroEstado === 'PRIORITARIOS') {
    params.append('modo', 'prioritarios');
  } else {
    params.append('modo', 'todos');
    if (filtroEstado) {
      params.append('estado', filtroEstado);
    }
  }

  try {
    const endpoint = params.toString()
      ? `${estoquePrioridadesApiBaseUrl}?${params.toString()}`
      : `${estoquePrioridadesApiBaseUrl}?modo=todos`;
    const response = await fetch(endpoint);
    const prioridades = await response.json();

    if (!response.ok) {
      throw new Error(prioridades.message || 'Nao foi possivel carregar os saldos.');
    }

    const registros = montarRegistrosEstoque(Array.isArray(prioridades) ? prioridades : []);
    const saldosFiltrados = filtrarRegistrosEstoque(registros);

    saldosCache = saldosFiltrados;
    renderizarTabelaSaldos(saldosFiltrados);
    atualizarIndicadores(saldosFiltrados);
  } catch (error) {
    saldosCache = [];
    renderizarTabelaSaldos([]);
    atualizarIndicadores([]);
    mostrarMensagemEstoque(error.message, 'error');
  }
}

// Mantem uma copia completa dos saldos para operacoes internas, independente dos filtros visiveis.
async function carregarSaldosOperacionais() {
  try {
    const response = await fetch(estoqueSaldosApiBaseUrl);
    const saldos = await response.json();

    if (!response.ok) {
      throw new Error(saldos.message || 'Nao foi possivel carregar os saldos operacionais.');
    }

    saldosOperacionaisCache = saldos;
  } catch (error) {
    saldosOperacionaisCache = [];
  }
}

async function recarregarSaldos() {
  await carregarSaldosOperacionais();
  await carregarSaldos();
}

function buildSaldoKey(idEstoque, idPeca) {
  return `${Number(idEstoque) || 0}:${Number(idPeca) || 0}`;
}

function montarRegistrosEstoque(prioridades) {
  const itensPorId = new Map(itensCache.map((item) => [Number(item.id), item]));
  const saldosPorChave = new Map(
    saldosOperacionaisCache.map((item) => [buildSaldoKey(item.id_estoque, item.id_peca), item])
  );

  return prioridades.map((prioridade) => {
    const saldoOperacional = saldosPorChave.get(buildSaldoKey(prioridade.id_estoque, prioridade.id_peca)) || null;
    const itemBase = itensPorId.get(Number(prioridade.id_peca)) || {};

    return {
      ...prioridade,
      id: saldoOperacional?.id ?? null,
      id_estoque: Number(prioridade.id_estoque ?? saldoOperacional?.id_estoque ?? 0),
      id_peca: Number(prioridade.id_peca ?? saldoOperacional?.id_peca ?? 0),
      estoque_nome: prioridade.estoque_nome ?? saldoOperacional?.estoque_nome ?? '-',
      codigo: prioridade.codigo ?? saldoOperacional?.codigo ?? itemBase.codigo ?? '-',
      descricao: prioridade.descricao ?? saldoOperacional?.descricao ?? itemBase.descricao ?? '-',
      tipo: prioridade.tipo ?? saldoOperacional?.tipo ?? itemBase.tipo ?? '-',
      classificacao: prioridade.classificacao ?? saldoOperacional?.classificacao ?? itemBase.classificacao ?? '-',
      maquina_nome: saldoOperacional?.maquina_nome ?? itemBase.maquina_nome ?? '-',
      quantidade: Number(prioridade.quantidade ?? saldoOperacional?.quantidade ?? 0),
      quantidade_saida_mes: Number(
        prioridade.quantidade_saida_mes
        ?? saldoOperacional?.consumo_mensal
        ?? itemBase.consumo_mensal
        ?? 0
      ),
      data_prevista_ruptura: prioridade.data_prevista_ruptura ?? null,
      dias_cobertura: prioridade.dias_cobertura ?? null,
      estado_necessidade: String(prioridade.estado_necessidade || 'NORMAL').toUpperCase(),
      estoque_seguranca: Number(
        prioridade.estoque_seguranca
        ?? saldoOperacional?.estoque_seguranca
        ?? itemBase.estoque_seguranca
        ?? 0
      ),
      consumo_mensal: Number(
        prioridade.quantidade_saida_mes
        ?? saldoOperacional?.consumo_mensal
        ?? itemBase.consumo_mensal
        ?? 0
      )
    };
  });
}

function filtrarRegistrosEstoque(registros) {
  const filtroEstoque = document.getElementById('filtro-estoque').value.trim();
  const filtroQ = document.getElementById('filtro-q').value.trim();
  const filtroCodigo = document.getElementById('filtro-codigo-estoque').value.trim();
  const filtroDescricao = document.getElementById('filtro-descricao-estoque').value.trim();
  const filtroTipo = document.getElementById('filtro-tipo-estoque').value.trim().toUpperCase();
  const filtroMaquina = document.getElementById('filtro-maquina-estoque').value.trim();
  const filtroClassificacao = document.getElementById('filtro-classificacao-estoque').value.trim().toUpperCase();
  const filtroEstado = document.getElementById('filtro-estado-estoque').value.trim().toUpperCase();
  const ordemQuantidade = document.getElementById('filtro-ordem-quantidade').value.trim().toUpperCase();

  const registrosFiltrados = registros.filter((item) => {
    if (filtroEstoque && Number(item.id_estoque) !== Number(filtroEstoque)) {
      return false;
    }

    if (filtroCodigo && !normalizarBusca(item.codigo).includes(normalizarBusca(filtroCodigo))) {
      return false;
    }

    if (filtroDescricao && !normalizarBusca(item.descricao).includes(normalizarBusca(filtroDescricao))) {
      return false;
    }

    if (filtroTipo && String(item.tipo || '').toUpperCase() !== filtroTipo) {
      return false;
    }

    if (filtroMaquina && !normalizarBusca(item.maquina_nome).includes(normalizarBusca(filtroMaquina))) {
      return false;
    }

    if (filtroClassificacao && String(item.classificacao || '').toUpperCase() !== filtroClassificacao) {
      return false;
    }

    if (filtroEstado === 'PRIORITARIOS' && String(item.estado_necessidade || '').toUpperCase() === 'NORMAL') {
      return false;
    }

    if (filtroEstado && filtroEstado !== 'PRIORITARIOS' && String(item.estado_necessidade || '').toUpperCase() !== filtroEstado) {
      return false;
    }

    if (!filtroQ) {
      return true;
    }

    return normalizarBusca([
      item.codigo,
      item.descricao,
      item.estoque_nome,
      item.maquina_nome
    ].join(' ')).includes(normalizarBusca(filtroQ));
  });

  if (ordemQuantidade === 'ASC') {
    registrosFiltrados.sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));
  } else if (ordemQuantidade === 'DESC') {
    registrosFiltrados.sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0));
  }

  return registrosFiltrados;
}

function handleFilterSubmit(event) {
  event.preventDefault();
  carregarSaldos();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarSaldos(), 220);
}

function limparFiltros() {
  filtroForm.reset();
  carregarSaldos();
}

// Trata as acoes da tabela principal do estoque.
function handleSaldoActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const saldo = saldosCache.find((item) => (
    Number(item.id_peca) === Number(actionButton.dataset.itemId)
    && Number(item.id_estoque) === Number(actionButton.dataset.stockId)
  ));

  if (!saldo) {
    mostrarMensagemEstoque('Registro de saldo nao encontrado.', 'error');
    return;
  }

  if (actionButton.dataset.action === 'history') {
    abrirModalHistorico(saldo);
  }

  if (actionButton.dataset.action === 'transfer') {
    abrirModalTransferencia(saldo);
  }

  if (actionButton.dataset.action === 'sale') {
    abrirModalSaida(saldo);
  }

  if (actionButton.dataset.action === 'adjust') {
    abrirModalAjuste(saldo);
  }
}

function bindAutocompleteEvents() {
  entradaItemBuscaInput.addEventListener('input', () => {
    entradaItemIdInput.value = '';
    atualizarPainelEntradaSubmontagem();
    renderizarSugestoesItem('entrada', entradaItemBuscaInput.value.trim());
  });
  entradaItemBuscaInput.addEventListener('focus', () => {
    renderizarSugestoesItem('entrada', entradaItemBuscaInput.value.trim());
  });
  entradaItemSugestoes.addEventListener('click', (event) => handleSugestaoItemClick(event, 'entrada'));

  transferenciaItemBuscaInput.addEventListener('input', () => {
    transferenciaItemIdInput.value = '';
    renderizarSugestoesItem('transferencia', transferenciaItemBuscaInput.value.trim());
  });
  transferenciaItemBuscaInput.addEventListener('focus', () => {
    renderizarSugestoesItem('transferencia', transferenciaItemBuscaInput.value.trim());
  });
  transferenciaItemSugestoes.addEventListener('click', (event) => handleSugestaoItemClick(event, 'transferencia'));
  saidaItemBuscaInput.addEventListener('input', () => {
    saidaItemIdInput.value = '';
    atualizarSaldoDisponivelSaida();
    renderizarSugestoesItem('saida', saidaItemBuscaInput.value.trim());
  });
  saidaItemBuscaInput.addEventListener('focus', () => {
    renderizarSugestoesItem('saida', saidaItemBuscaInput.value.trim());
  });
  saidaItemSugestoes.addEventListener('click', (event) => handleSugestaoItemClick(event, 'saida'));

  document.addEventListener('click', handleClickForaDaBusca);
}

// Filtra pecas e submontagens por codigo, descricao, tipo e classificacao.
function renderizarSugestoesItem(tipo, termo) {
  const config = getItemAutocompleteConfig(tipo);
  const filtro = termo.toLowerCase();
  const itensFiltrados = itensCache.filter((item) => {
    if (
      tipo === 'saida'
      && item.classificacao !== 'SUBMONTAGEM'
      && obterSaldoExpedicao(item.id) <= 0
    ) {
      return false;
    }

    if (!filtro) return true;

    return (
      String(item.codigo).toLowerCase().includes(filtro) ||
      String(item.descricao).toLowerCase().includes(filtro) ||
      String(item.classificacao).toLowerCase().includes(filtro) ||
      String(item.maquina_nome || '').toLowerCase().includes(filtro)
    );
  }).slice(0, 8);

  if (itensFiltrados.length === 0) {
    config.panel.innerHTML = '<div class="autocomplete-empty">Nenhum item encontrado para a busca informada.</div>';
    config.panel.classList.remove('hidden');
    return;
  }

  config.panel.innerHTML = itensFiltrados.map((item) => {
    const disponivelSaida = item.classificacao === 'SUBMONTAGEM'
      ? calcularDisponibilidadeTotalSubmontagem(item.id, estruturasSubmontagemCache.get(item.id) || [])
      : obterSaldoExpedicao(item.id);
    const subtitulo = tipo === 'saida'
      ? `${item.classificacao} | ${item.tipo} | Disponivel ${expedicaoNomeCorreto}: ${formatarQuantidade(disponivelSaida)}`
      : `${item.classificacao} | ${item.tipo} | Maquina: ${item.maquina_nome || '-'}`;

    return `
      <button type="button" class="autocomplete-option" data-item-id="${item.id}" data-item-codigo="${escapeHtml(item.codigo)}" data-item-descricao="${escapeHtml(item.descricao)}">
        <strong>${escapeHtml(item.codigo)} - ${escapeHtml(item.descricao)}</strong>
        <span>${escapeHtml(subtitulo)}</span>
      </button>
    `;
  }).join('');
  config.panel.classList.remove('hidden');
}

async function handleSugestaoItemClick(event, tipo) {
  const option = event.target.closest('button[data-item-id]');
  if (!option) return;

  const config = getItemAutocompleteConfig(tipo);
  config.hidden.value = option.dataset.itemId;
  config.input.value = `${option.dataset.itemCodigo} - ${option.dataset.itemDescricao}`;
  if (tipo === 'entrada') {
    await atualizarPainelEntradaSubmontagem();
  }
  if (tipo === 'saida') {
    await atualizarSaldoDisponivelSaida();
  }
  esconderTodasSugestoesItem();
}

function handleClickForaDaBusca(event) {
  if (!event.target.closest('.autocomplete')) {
    esconderTodasSugestoesItem();
  }
}

function getItemAutocompleteConfig(tipo) {
  if (tipo === 'entrada') {
    return {
      input: entradaItemBuscaInput,
      hidden: entradaItemIdInput,
      panel: entradaItemSugestoes
    };
  }

  if (tipo === 'saida') {
    return {
      input: saidaItemBuscaInput,
      hidden: saidaItemIdInput,
      panel: saidaItemSugestoes
    };
  }

  return {
    input: transferenciaItemBuscaInput,
    hidden: transferenciaItemIdInput,
    panel: transferenciaItemSugestoes
  };
}

function esconderTodasSugestoesItem() {
  [entradaItemSugestoes, transferenciaItemSugestoes, saidaItemSugestoes].forEach((panel) => {
    panel.classList.add('hidden');
    panel.innerHTML = '';
  });
}

function preencherSelectEstoques(selectElement, placeholder) {
  const primeiraOpcao = placeholder ? `<option value="">${placeholder}</option>` : '';
  selectElement.innerHTML = `
    ${primeiraOpcao}
    ${estoquesCache.map((estoque) => `<option value="${estoque.id}">${escapeHtml(estoque.nome)}</option>`).join('')}
  `;
}

// Modal de entrada inicial.
function abrirModalEntrada() {
  resetEntradaForm();
  atualizarPainelEntradaSubmontagem();
  abrirModal(entradaModal);
}

function fecharModalEntrada() {
  resetEntradaForm();
  fecharModal(entradaModal);
}

async function handleEntradaInicial(event) {
  event.preventDefault();

  try {
    const response = await fetch(entradaInicialApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: entradaItemIdInput.value,
        id_estoque_origem_componentes: entradaEstoqueOrigemComponentesSelect.value,
        id_estoque_destino: document.getElementById('entrada-estoque').value,
        quantidade: document.getElementById('entrada-quantidade').value,
        observacao: document.getElementById('entrada-observacao').value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalEntrada();
    mostrarMensagemEstoque('Entrada inicial registrada com sucesso.', 'success');
    await recarregarSaldos();
  } catch (error) {
    mostrarMensagemEntrada(error.message, 'error');
  }
}

// Modal de transferencia entre estoques.
function abrirModalTransferencia(saldo = null) {
  resetTransferenciaForm();

  if (saldo) {
    transferenciaItemIdInput.value = saldo.id_peca;
    transferenciaItemBuscaInput.value = `${saldo.codigo} - ${saldo.descricao}`;
    document.getElementById('transferencia-estoque-origem').value = String(saldo.id_estoque);
  }

  abrirModal(transferenciaModal);
}

function fecharModalTransferencia() {
  resetTransferenciaForm();
  fecharModal(transferenciaModal);
}

async function handleTransferencia(event) {
  event.preventDefault();

  try {
    const response = await fetch(transferenciaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: transferenciaItemIdInput.value,
        id_estoque_origem: document.getElementById('transferencia-estoque-origem').value,
        id_estoque_destino: document.getElementById('transferencia-estoque-destino').value,
        quantidade: document.getElementById('transferencia-quantidade').value,
        observacao: document.getElementById('transferencia-observacao').value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalTransferencia();
    mostrarMensagemEstoque('Transferencia realizada com sucesso.', 'success');
    await recarregarSaldos();
  } catch (error) {
    mostrarMensagemTransferencia(error.message, 'error');
  }
}

// Modal da saida de venda sempre usando o estoque de expedicao.
async function abrirModalSaida(saldo = null) {
  resetSaidaForm();

  if (saldo && isRegistroExpedicao(saldo)) {
    saidaItemIdInput.value = saldo.id_peca;
    saidaItemBuscaInput.value = `${saldo.codigo} - ${saldo.descricao}`;
    await atualizarSaldoDisponivelSaida();
  }

  abrirModal(saidaModal);
}

function fecharModalSaida() {
  resetSaidaForm();
  fecharModal(saidaModal);
}

async function carregarEstruturaSubmontagemSaida(submontagemId) {
  if (estruturasSubmontagemCache.has(submontagemId)) {
    return estruturasSubmontagemCache.get(submontagemId);
  }

  const response = await fetch(`/api/submontagens/${submontagemId}/componentes`);
  const componentes = await response.json();

  if (!response.ok) {
    throw new Error(componentes.message || 'Nao foi possivel carregar a estrutura da submontagem.');
  }

  estruturasSubmontagemCache.set(submontagemId, componentes);
  return componentes;
}

async function carregarEstruturaSubmontagem(submontagemId) {
  return carregarEstruturaSubmontagemSaida(submontagemId);
}

function obterSaldoEmEstoque(idEstoque, itemId) {
  const saldo = saldosOperacionaisCache.find((registro) => (
    Number(registro.id_estoque) === Number(idEstoque)
    && Number(registro.id_peca) === Number(itemId)
  ));

  return saldo ? Number(saldo.quantidade) : 0;
}

function esconderPainelEntradaSubmontagem() {
  entradaOrigemWrapper.classList.add('hidden');
  entradaSubmontagemPreview.classList.add('hidden');
  entradaEstoqueOrigemComponentesSelect.required = false;
  document.getElementById('entrada-preview-titulo').textContent = 'Selecione uma submontagem';
  document.getElementById('entrada-preview-subtitulo').textContent = 'A entrada vai consumir os componentes do estoque escolhido e gerar a submontagem pronta no destino.';
  document.getElementById('entrada-preview-componentes-chip').textContent = 'Componentes: 0';
  document.getElementById('entrada-preview-consumo-chip').textContent = 'Consumo total: 0';
  document.getElementById('entrada-preview-status-chip').textContent = 'Status: aguardando origem';
  document.getElementById('entrada-preview-tbody').innerHTML = '<tr><td colspan="6" class="empty-state">Selecione a submontagem e o estoque de origem para visualizar o consumo.</td></tr>';
}

async function atualizarPainelEntradaSubmontagem() {
  const itemId = Number.parseInt(entradaItemIdInput.value, 10);
  const item = itensCache.find((registro) => Number(registro.id) === itemId);

  if (!item || item.classificacao !== 'SUBMONTAGEM') {
    esconderPainelEntradaSubmontagem();
    return;
  }

  entradaOrigemWrapper.classList.remove('hidden');
  entradaSubmontagemPreview.classList.remove('hidden');
  entradaEstoqueOrigemComponentesSelect.required = true;

  const quantidadeInformada = Number.parseFloat(document.getElementById('entrada-quantidade').value);
  const quantidade = Number.isFinite(quantidadeInformada) && quantidadeInformada > 0 ? quantidadeInformada : 0;
  const estoqueOrigemId = Number.parseInt(entradaEstoqueOrigemComponentesSelect.value, 10);
  const estoqueDestinoId = Number.parseInt(document.getElementById('entrada-estoque').value, 10);
  const estoqueOrigem = estoquesCache.find((estoque) => Number(estoque.id) === estoqueOrigemId) || null;
  const estoqueDestino = estoquesCache.find((estoque) => Number(estoque.id) === estoqueDestinoId) || null;

  document.getElementById('entrada-preview-titulo').textContent = `${item.codigo} - ${item.descricao}`;
  document.getElementById('entrada-preview-subtitulo').textContent = [
    estoqueOrigem ? `Origem dos componentes: ${estoqueOrigem.nome}` : 'Selecione a origem dos componentes',
    estoqueDestino ? `Destino da submontagem: ${estoqueDestino.nome}` : 'Selecione o destino da submontagem'
  ].join(' | ');

  try {
    const componentes = await carregarEstruturaSubmontagem(item.id);

    if (componentes.length === 0) {
      document.getElementById('entrada-preview-componentes-chip').textContent = 'Componentes: 0';
      document.getElementById('entrada-preview-consumo-chip').textContent = 'Consumo total: 0';
      document.getElementById('entrada-preview-status-chip').textContent = 'Status: sem estrutura';
      document.getElementById('entrada-preview-tbody').innerHTML = '<tr><td colspan="6" class="empty-state">Esta submontagem nao possui componentes cadastrados.</td></tr>';
      return;
    }

    const totalConsumo = componentes.reduce(
      (total, componente) => total + (Number(componente.quantidade) * quantidade),
      0
    );

    const linhas = componentes.map((componente) => {
      const quantidadeNecessaria = Number((Number(componente.quantidade) * quantidade).toFixed(2));
      const saldoOrigem = estoqueOrigem
        ? obterSaldoEmEstoque(estoqueOrigem.id, componente.id_item_componente)
        : 0;
      const suficiente = estoqueOrigem && quantidade > 0 && saldoOrigem >= quantidadeNecessaria;

      return {
        ...componente,
        quantidade_necessaria: quantidadeNecessaria,
        saldo_origem: saldoOrigem,
        suficiente
      };
    });

    const prontoParaMontar = (
      Boolean(estoqueOrigem)
      && quantidade > 0
      && linhas.every((componente) => componente.suficiente)
    );

    document.getElementById('entrada-preview-componentes-chip').textContent = `Componentes: ${componentes.length}`;
    document.getElementById('entrada-preview-consumo-chip').textContent = `Consumo total: ${formatarQuantidade(totalConsumo)}`;
    document.getElementById('entrada-preview-status-chip').textContent = prontoParaMontar
      ? 'Status: pronto para montar'
      : estoqueOrigem
        ? 'Status: saldo insuficiente'
        : 'Status: aguardando origem';

    document.getElementById('entrada-preview-tbody').innerHTML = linhas.map((componente) => `
      <tr>
        <td class="table-code">${escapeHtml(componente.codigo_componente)}</td>
        <td class="table-description">${escapeHtml(componente.descricao_componente)}</td>
        <td>${formatarQuantidade(componente.quantidade)}</td>
        <td>${formatarQuantidade(componente.quantidade_necessaria)}</td>
        <td>${estoqueOrigem ? formatarQuantidade(componente.saldo_origem) : '-'}</td>
        <td>${componente.suficiente ? 'OK' : (estoqueOrigem ? 'Faltando' : 'Aguardando origem')}</td>
      </tr>
    `).join('');
  } catch (error) {
    document.getElementById('entrada-preview-componentes-chip').textContent = 'Componentes: 0';
    document.getElementById('entrada-preview-consumo-chip').textContent = 'Consumo total: 0';
    document.getElementById('entrada-preview-status-chip').textContent = 'Status: erro';
    document.getElementById('entrada-preview-tbody').innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

function obterSaldoExpedicao(itemId) {
  const saldo = saldosOperacionaisCache.find((registro) => (
    isRegistroExpedicao(registro) &&
    Number(registro.id_peca) === Number(itemId)
  ));

  return saldo ? Number(saldo.quantidade) : 0;
}

function calcularDisponibilidadeSubmontagem(componentes) {
  if (!Array.isArray(componentes) || componentes.length === 0) {
    return 0;
  }

  return componentes.reduce((menorDisponibilidade, componente) => {
    const saldoComponente = obterSaldoExpedicao(componente.id_item_componente);
    const quantidadePorSubmontagem = Number(componente.quantidade);
    const disponibilidadeComponente = quantidadePorSubmontagem > 0
      ? Math.floor(saldoComponente / quantidadePorSubmontagem)
      : 0;

    return Math.min(menorDisponibilidade, disponibilidadeComponente);
  }, Number.POSITIVE_INFINITY);
}

function calcularDisponibilidadeTotalSubmontagem(submontagemId, componentes) {
  const saldoPronto = obterSaldoExpedicao(submontagemId);
  const disponibilidadeComponentes = calcularDisponibilidadeSubmontagem(componentes);
  return Number((saldoPronto + disponibilidadeComponentes).toFixed(2));
}

function obterSaldoDisponivelRegistroSaida(registro) {
  if (registro.classificacao !== 'SUBMONTAGEM') {
    return obterSaldoExpedicao(registro.id_peca);
  }

  const componentes = estruturasSubmontagemCache.get(registro.id_peca) || [];
  return calcularDisponibilidadeTotalSubmontagem(registro.id_peca, componentes);
}

async function obterItemSelecionadoSaida() {
  const itemId = Number.parseInt(saidaItemIdInput.value, 10);
  const item = itensCache.find((registro) => Number(registro.id) === itemId);

  if (!item) {
    mostrarMensagemSaida('Escolha um item ou submontagem valida para a lista de venda.', 'error');
    return null;
  }

  if (item.classificacao === 'SUBMONTAGEM') {
    const componentes = await carregarEstruturaSubmontagem(item.id);
    const saldoPronto = obterSaldoExpedicao(item.id);
    const saldoDisponivel = calcularDisponibilidadeTotalSubmontagem(item.id, componentes);

    if (saldoDisponivel <= 0) {
      mostrarMensagemSaida(`A submontagem ${item.codigo} nao possui saldo pronto nem componentes suficientes na Expedicao.`, 'error');
      return null;
    }

    return {
      ...item,
      saldo_disponivel: saldoDisponivel,
      saldo_pronto: saldoPronto
    };
  }

  const saldoDisponivel = obterSaldoExpedicao(item.id);
  if (saldoDisponivel <= 0) {
    mostrarMensagemSaida(`O item ${item.codigo} nao possui saldo disponivel na Expedicao.`, 'error');
    return null;
  }

  return {
    ...item,
    saldo_disponivel: saldoDisponivel
  };
}

async function atualizarSaldoDisponivelSaida() {
  const itemId = Number.parseInt(saidaItemIdInput.value, 10);
  if (!Number.isInteger(itemId)) {
    document.getElementById('saida-saldo-disponivel').value = '0';
    return;
  }

  const item = itensCache.find((registro) => Number(registro.id) === itemId);
  if (!item) {
    document.getElementById('saida-saldo-disponivel').value = '0';
    return;
  }

  if (item.classificacao === 'SUBMONTAGEM') {
    try {
      const componentes = await carregarEstruturaSubmontagem(item.id);
      document.getElementById('saida-saldo-disponivel').value = formatarQuantidade(
        calcularDisponibilidadeTotalSubmontagem(item.id, componentes)
      );
    } catch (error) {
      document.getElementById('saida-saldo-disponivel').value = '0';
    }

    return;
  }

  document.getElementById('saida-saldo-disponivel').value = formatarQuantidade(obterSaldoExpedicao(item.id));
}

async function adicionarItemNaListaSaida() {
  const item = await obterItemSelecionadoSaida();
  if (!item) return;

  const quantidade = Number.parseFloat(document.getElementById('saida-quantidade').value);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return mostrarMensagemSaida('Informe uma quantidade valida para a lista de venda.', 'error');
  }

  const itemExistente = saidaLista.find((registro) => Number(registro.id_peca) === Number(item.id));
  const quantidadeAtualLista = itemExistente ? Number(itemExistente.quantidade) : 0;
  const novaQuantidade = Number((quantidadeAtualLista + quantidade).toFixed(2));

  if (novaQuantidade > Number(item.saldo_disponivel)) {
    return mostrarMensagemSaida(`A quantidade da lista excede o disponivel na Expedicao para ${item.codigo}.`, 'error');
  }

  upsertItemNaSaida(item, quantidade);
  limparItemSaidaAtual(false);
  mostrarMensagemSaida('Item adicionado na lista de baixa.', 'success');
}

async function adicionarMaisUmNaListaSaida() {
  const item = await obterItemSelecionadoSaida();
  if (!item) return;

  const itemExistente = saidaLista.find((registro) => Number(registro.id_peca) === Number(item.id));
  const quantidadeAtualLista = itemExistente ? Number(itemExistente.quantidade) : 0;

  if (quantidadeAtualLista + 1 > Number(item.saldo_disponivel)) {
    return mostrarMensagemSaida(`Nao ha saldo suficiente na Expedicao para adicionar mais 1 de ${item.codigo}.`, 'error');
  }

  upsertItemNaSaida(item, 1);
  mostrarMensagemSaida('Mais 1 unidade adicionada na lista de venda.', 'success');
}

function upsertItemNaSaida(item, quantidadeSomada) {
  const itemExistente = saidaLista.find((registro) => Number(registro.id_peca) === Number(item.id));

  if (itemExistente) {
    itemExistente.quantidade = Number((Number(itemExistente.quantidade) + Number(quantidadeSomada)).toFixed(2));
  } else {
    saidaLista.push({
      id_peca: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      classificacao: item.classificacao,
      quantidade: Number(Number(quantidadeSomada).toFixed(2)),
      saldo_disponivel: Number(item.saldo_disponivel)
    });
  }

  sincronizarSaldosDaListaSaida();
  renderizarListaSaida();
}

function limparItemSaidaAtual(limparMensagem = true) {
  saidaItemIdInput.value = '';
  saidaItemBuscaInput.value = '';
  document.getElementById('saida-quantidade').value = '1';
  document.getElementById('saida-saldo-disponivel').value = '0';
  if (limparMensagem) {
    esconderMensagemSaida();
  }
}

function limparListaSaida() {
  saidaLista = [];
  renderizarListaSaida();
  mostrarMensagemSaida('Lista de baixa limpa.', 'success');
}

function handleSaidaListActions(event) {
  const actionButton = event.target.closest('button[data-saida-action]');
  if (!actionButton) return;

  const itemId = Number.parseInt(actionButton.dataset.itemId, 10);
  const registro = saidaLista.find((item) => Number(item.id_peca) === itemId);
  if (!registro) return;

  if (actionButton.dataset.saidaAction === 'plus') {
    const saldoDisponivel = obterSaldoDisponivelRegistroSaida(registro);
    if (Number(registro.quantidade) + 1 > saldoDisponivel) {
      return mostrarMensagemSaida(`Nao ha saldo suficiente na Expedicao para adicionar mais 1 de ${registro.codigo}.`, 'error');
    }
    registro.quantidade = Number((Number(registro.quantidade) + 1).toFixed(2));
  }

  if (actionButton.dataset.saidaAction === 'minus') {
    registro.quantidade = Number((Number(registro.quantidade) - 1).toFixed(2));
    if (registro.quantidade <= 0) {
      saidaLista = saidaLista.filter((item) => Number(item.id_peca) !== itemId);
    }
  }

  if (actionButton.dataset.saidaAction === 'remove') {
    saidaLista = saidaLista.filter((item) => Number(item.id_peca) !== itemId);
  }

  sincronizarSaldosDaListaSaida();
  renderizarListaSaida();
}

async function baixarTudoSaida() {
  if (saidaLista.length === 0) {
    return mostrarMensagemSaida('Monte a lista de venda antes de baixar.', 'error');
  }

  try {
    const response = await fetch(saidaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: saidaLista.map((item) => ({
          id_peca: item.id_peca,
          quantidade: item.quantidade
        })),
        observacao: document.getElementById('saida-observacao').value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalSaida();
    mostrarMensagemEstoque('Baixa de venda realizada com sucesso na Expedicao.', 'success');
    await recarregarSaldos();
  } catch (error) {
    mostrarMensagemSaida(error.message, 'error');
  }
}

function sincronizarSaldosDaListaSaida() {
  saidaLista = saidaLista.map((item) => ({
    ...item,
    saldo_disponivel: obterSaldoDisponivelRegistroSaida(item)
  }));
}

function renderizarListaSaida() {
  const saidaTbody = document.getElementById('saida-tbody');

  if (saidaLista.length === 0) {
    saidaTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum item adicionado para a baixa de venda.</td></tr>';
  } else {
    saidaTbody.innerHTML = saidaLista.map((item) => `
      <tr>
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(item.descricao)}</td>
        <td class="table-quantity">${formatarQuantidade(item.quantidade)}</td>
        <td>${formatarQuantidade(item.saldo_disponivel)}</td>
        <td class="table-actions-cell">
          <details class="row-menu">
            <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
            <div class="row-menu-panel">
              <button type="button" class="row-menu-item" data-saida-action="plus" data-item-id="${item.id_peca}">Baixar +1</button>
              <button type="button" class="row-menu-item" data-saida-action="minus" data-item-id="${item.id_peca}">Remover 1</button>
              <button type="button" class="row-menu-item danger" data-saida-action="remove" data-item-id="${item.id_peca}">Remover da Lista</button>
            </div>
          </details>
        </td>
      </tr>
    `).join('');
  }

  const quantidadeTotal = saidaLista.reduce((acumulador, item) => acumulador + Number(item.quantidade), 0);
  document.getElementById('saida-total-itens-chip').textContent = `Itens na lista: ${saidaLista.length}`;
  document.getElementById('saida-total-quantidade-chip').textContent = `Quantidade total: ${formatarQuantidade(quantidadeTotal)}`;
}

// Modal de ajuste de saldo usando o novo saldo final.
function abrirModalAjuste(saldo) {
  resetAjusteForm();
  document.getElementById('ajuste-item-id').value = saldo.id_peca;
  document.getElementById('ajuste-estoque-id').value = saldo.id_estoque;
  document.getElementById('ajuste-item-titulo').textContent = `${saldo.codigo} - ${saldo.descricao}`;
  document.getElementById('ajuste-item-subtitulo').textContent = `${saldo.classificacao} | ${saldo.tipo} | Maquina: ${saldo.maquina_nome}`;
  document.getElementById('ajuste-estoque-chip').textContent = `Estoque: ${saldo.estoque_nome}`;
  document.getElementById('ajuste-saldo-chip').textContent = `Saldo atual: ${formatarQuantidade(saldo.quantidade)}`;
  document.getElementById('ajuste-novo-saldo').value = Number(saldo.quantidade);
  abrirModal(ajusteModal);
}

function fecharModalAjuste() {
  resetAjusteForm();
  fecharModal(ajusteModal);
}

async function handleAjuste(event) {
  event.preventDefault();

  try {
    const response = await fetch(ajusteApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: document.getElementById('ajuste-item-id').value,
        id_estoque: document.getElementById('ajuste-estoque-id').value,
        novo_saldo: document.getElementById('ajuste-novo-saldo').value,
        observacao: document.getElementById('ajuste-observacao').value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalAjuste();
    mostrarMensagemEstoque('Ajuste de saldo realizado com sucesso.', 'success');
    await recarregarSaldos();
  } catch (error) {
    mostrarMensagemAjuste(error.message, 'error');
  }
}

// Modal de historico do item selecionado.
async function abrirModalHistorico(saldo) {
  try {
    document.getElementById('historico-modal-title').textContent = `Historico de ${saldo.codigo}`;
    esconderMensagemHistorico();
    renderizarHistorico([]);
    abrirModal(historicoModal);

    const response = await fetch(`${estoqueMovimentacoesApiBaseUrl}/${saldo.id_peca}`);
    const movimentacoes = await response.json();

    if (!response.ok) {
      throw new Error(movimentacoes.message || 'Nao foi possivel carregar o historico do item.');
    }

    renderizarHistorico(movimentacoes);
  } catch (error) {
    mostrarMensagemHistorico(error.message, 'error');
  }
}

function fecharModalHistorico() {
  renderizarHistorico([]);
  esconderMensagemHistorico();
  fecharModal(historicoModal);
}

function renderizarTabelaSaldos(saldos) {
  totalSaldosBox.textContent = `${saldos.length} registro(s) encontrado(s)`;

  if (saldos.length === 0) {
    saldosTbody.innerHTML = '<tr><td colspan="11" class="empty-state">Nenhum saldo encontrado para os filtros informados.</td></tr>';
    return;
  }

  saldosTbody.innerHTML = saldos.map((saldo) => `
    <tr class="${String(saldo.estado_necessidade || '').toUpperCase() === 'CRITICO' ? 'table-row-attention' : ''}">
      <td>${escapeHtml(saldo.estoque_nome)}</td>
      <td class="table-code">${escapeHtml(saldo.codigo)}</td>
      <td class="table-description">${escapeHtml(saldo.descricao)}</td>
      <td>${escapeHtml(saldo.tipo)}</td>
      <td>${escapeHtml(saldo.classificacao)}</td>
      <td>${escapeHtml(saldo.maquina_nome || '-')}</td>
      <td class="table-quantity">${renderizarQuantidadeEstoque(saldo)}</td>
      <td class="table-quantity">${formatarQuantidade(saldo.quantidade_saida_mes)}</td>
      <td>${escapeHtml(renderizarDuracaoPrioridade(saldo))}</td>
      <td>${renderizarEstadoNecessidade(saldo.estado_necessidade)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="history" data-item-id="${saldo.id_peca}" data-stock-id="${saldo.id_estoque}">Ver Historico</button>
            ${Number(saldo.quantidade || 0) > 0
              ? `<button type="button" class="row-menu-item" data-action="transfer" data-item-id="${saldo.id_peca}" data-stock-id="${saldo.id_estoque}">Transferir</button>`
              : ''}
            ${isRegistroExpedicao(saldo) && Number(saldo.quantidade || 0) > 0
              ? `<button type="button" class="row-menu-item" data-action="sale" data-item-id="${saldo.id_peca}" data-stock-id="${saldo.id_estoque}">Saida de Venda</button>`
              : ''}
            <button type="button" class="row-menu-item" data-action="adjust" data-item-id="${saldo.id_peca}" data-stock-id="${saldo.id_estoque}">Ajustar Saldo</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function renderizarQuantidadeEstoque(saldo) {
  const quantidade = formatarQuantidade(saldo.quantidade);
  const estado = String(saldo.estado_necessidade || '').toUpperCase();

  if (estado === 'CRITICO') {
    return `<span class="status-chip is-danger">${escapeHtml(quantidade)}</span>`;
  }

  if (estado === 'ATENCAO') {
    return `<span class="status-chip is-warning">${escapeHtml(quantidade)}</span>`;
  }

  return quantidade;
}

function formatarDataCurta(valor) {
  if (!valor) {
    return '-';
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleDateString('pt-BR');
}

function renderizarDuracaoPrioridade(saldo) {
  const dias = Number(saldo.dias_cobertura);
  const dataPrevista = formatarDataCurta(saldo.data_prevista_ruptura);

  if (!Number.isFinite(dias) && dataPrevista === '-') {
    return 'Sem previsao';
  }

  if (!Number.isFinite(dias)) {
    return `ate ${dataPrevista}`;
  }

  return `${formatarQuantidade(dias)} dia(s) | ate ${dataPrevista}`;
}

function renderizarEstadoNecessidade(estado) {
  const normalized = String(estado || '').toUpperCase();
  let className = 'status-chip';

  if (normalized === 'CRITICO') className += ' is-danger';
  if (normalized === 'ATENCAO') className += ' is-warning';
  if (normalized === 'OBSERVAR') className += ' is-info';
  if (normalized === 'NORMAL') className += ' is-success';

  return `<span class="${className}">${escapeHtml(normalized || '-')}</span>`;
}

function renderizarHistorico(movimentacoes) {
  const historicoTbody = document.getElementById('historico-tbody');

  if (movimentacoes.length === 0) {
    historicoTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma movimentacao encontrada para este item.</td></tr>';
    return;
  }

  historicoTbody.innerHTML = movimentacoes.map((movimentacao) => `
    <tr>
      <td>${formatarData(movimentacao.data_movimentacao)}</td>
      <td>${escapeHtml(movimentacao.tipo_movimentacao)}</td>
      <td>${escapeHtml(movimentacao.estoque_origem_nome)}</td>
      <td>${escapeHtml(movimentacao.estoque_destino_nome)}</td>
      <td class="table-quantity">${formatarQuantidade(movimentacao.quantidade)}</td>
      <td>${escapeHtml(movimentacao.observacao || '-')}</td>
    </tr>
  `).join('');
}

function atualizarIndicadores(saldos) {
  const quantidadeTotal = saldos.reduce((acumulador, saldo) => acumulador + Number(saldo.quantidade), 0);
  document.getElementById('metric-total-saldos').textContent = String(saldos.length);
  document.getElementById('metric-quantidade-total').textContent = formatarQuantidade(quantidadeTotal);
  document.getElementById('metric-estoques-ativos').textContent = String(estoquesCache.length);
}

function resetEntradaForm() {
  entradaForm.reset();
  entradaItemIdInput.value = '';
  entradaEstoqueOrigemComponentesSelect.value = '';
  esconderPainelEntradaSubmontagem();
  esconderMensagemEntrada();
  esconderTodasSugestoesItem();
}

function resetTransferenciaForm() {
  transferenciaForm.reset();
  transferenciaItemIdInput.value = '';
  esconderMensagemTransferencia();
  esconderTodasSugestoesItem();
}

function resetSaidaForm() {
  saidaForm.reset();
  saidaLista = [];
  saidaItemIdInput.value = '';
  document.getElementById('saida-estoque-titulo').textContent = expedicaoNomeCorreto;
  document.getElementById('saida-estoque-subtitulo').textContent = 'Monte a lista de venda e baixe tudo de uma vez.';
  document.getElementById('saida-quantidade').value = '1';
  atualizarSaldoDisponivelSaida();
  renderizarListaSaida();
  esconderMensagemSaida();
  esconderTodasSugestoesItem();
}

function resetAjusteForm() {
  ajusteForm.reset();
  document.getElementById('ajuste-item-id').value = '';
  document.getElementById('ajuste-estoque-id').value = '';
  document.getElementById('ajuste-item-titulo').textContent = 'Nenhum item selecionado';
  document.getElementById('ajuste-item-subtitulo').textContent = 'Escolha uma linha da tabela para ajustar o saldo.';
  document.getElementById('ajuste-estoque-chip').textContent = 'Estoque: -';
  document.getElementById('ajuste-saldo-chip').textContent = 'Saldo atual: 0';
  esconderMensagemAjuste();
}

function abrirModal(modalElement) {
  modalElement.classList.remove('hidden');
  modalElement.setAttribute('aria-hidden', 'false');
  syncBodyModalState();
}

function fecharModal(modalElement) {
  modalElement.classList.add('hidden');
  modalElement.setAttribute('aria-hidden', 'true');
  syncBodyModalState();
}

function syncBodyModalState() {
  const existeModalAberto = [entradaModal, transferenciaModal, saidaModal, ajusteModal, historicoModal]
    .some((modal) => !modal.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', existeModalAberto);
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'entrada') fecharModalEntrada();
  if (event.target.dataset.closeModal === 'transferencia') fecharModalTransferencia();
  if (event.target.dataset.closeModal === 'saida') fecharModalSaida();
  if (event.target.dataset.closeModal === 'ajuste') fecharModalAjuste();
  if (event.target.dataset.closeModal === 'historico') fecharModalHistorico();
}

function abrirDrawer() {
  appDrawer.classList.add('is-open');
  drawerScrim.classList.remove('hidden');
  document.body.classList.add('has-drawer');
}

function fecharDrawer() {
  appDrawer.classList.remove('is-open');
  drawerScrim.classList.add('hidden');
  document.body.classList.remove('has-drawer');
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') return;

  esconderTodasSugestoesItem();
  closeAllRowMenus();

  if (!historicoModal.classList.contains('hidden')) return fecharModalHistorico();
  if (!saidaModal.classList.contains('hidden')) return fecharModalSaida();
  if (!ajusteModal.classList.contains('hidden')) return fecharModalAjuste();
  if (!transferenciaModal.classList.contains('hidden')) return fecharModalTransferencia();
  if (!entradaModal.classList.contains('hidden')) return fecharModalEntrada();
  if (appDrawer.classList.contains('is-open')) fecharDrawer();
}

function mostrarMensagemEstoque(texto, tipo) {
  estoqueMensagemBox.textContent = texto;
  estoqueMensagemBox.className = `message ${tipo}`;
  estoqueMensagemBox.classList.remove('hidden');
}

function mostrarMensagemEntrada(texto, tipo) {
  entradaMensagemBox.textContent = texto;
  entradaMensagemBox.className = `message ${tipo}`;
  entradaMensagemBox.classList.remove('hidden');
}

function esconderMensagemEntrada() {
  entradaMensagemBox.className = 'message hidden';
  entradaMensagemBox.textContent = '';
}

function mostrarMensagemTransferencia(texto, tipo) {
  transferenciaMensagemBox.textContent = texto;
  transferenciaMensagemBox.className = `message ${tipo}`;
  transferenciaMensagemBox.classList.remove('hidden');
}

function esconderMensagemTransferencia() {
  transferenciaMensagemBox.className = 'message hidden';
  transferenciaMensagemBox.textContent = '';
}

function mostrarMensagemAjuste(texto, tipo) {
  ajusteMensagemBox.textContent = texto;
  ajusteMensagemBox.className = `message ${tipo}`;
  ajusteMensagemBox.classList.remove('hidden');
}

function esconderMensagemAjuste() {
  ajusteMensagemBox.className = 'message hidden';
  ajusteMensagemBox.textContent = '';
}

function mostrarMensagemSaida(texto, tipo) {
  saidaMensagemBox.textContent = texto;
  saidaMensagemBox.className = `message ${tipo}`;
  saidaMensagemBox.classList.remove('hidden');
}

function esconderMensagemSaida() {
  saidaMensagemBox.className = 'message hidden';
  saidaMensagemBox.textContent = '';
}

function mostrarMensagemHistorico(texto, tipo) {
  historicoMensagemBox.textContent = texto;
  historicoMensagemBox.className = `message ${tipo}`;
  historicoMensagemBox.classList.remove('hidden');
}

function esconderMensagemHistorico() {
  historicoMensagemBox.className = 'message hidden';
  historicoMensagemBox.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function formatarNumero(valor, casasDecimais) {
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais
  });
}

function formatarQuantidade(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatarData(data) {
  return new Date(data).toLocaleString('pt-BR');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
