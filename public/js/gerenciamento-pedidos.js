const pedidosApiBaseUrl = '/api/pedidos-expedicao';
const estoqueItensApiBaseUrl = '/api/estoque/itens';
const submontagemSeriaisApiBaseUrl = '/api/submontagem-seriais';
const AUTO_REFRESH_MS = 15000;
const KIT_IMAGE_EXTENSIONS = ['.jpg', '.png', '.jpeg', '.webp'];
const PRINT_HISTORY_ENDPOINT = `${pedidosApiBaseUrl}/etiquetas/historico-impressao`;
const DEFAULT_PRINTER_NAME = 'IMPRESSORA PADRAO';
const PRINT_PREFERENCE_STORAGE_KEY = 'safisa_preferred_printer_name';
const AUTO_PRINTER_NAME_CANDIDATES = Object.freeze([
  '\\\\exp02\\ZDesigner ZD220-203dpi ZPL',
  'ZDesigner ZD220-203dpi ZPL'
]);
const RELATORIO_REPARO_CODES = new Set(['R064', 'R065', 'R066', 'R067', 'R068']);

let itensCache = [];
let clientesCache = [];
let pedidosCache = [];
let resumoSeriaisDisponiveis = { total_disponivel: 0, modelos: [] };
let pedidoItensDraft = [];
let itemDraftSelecionado = null;
let pedidoSelecionadoId = null;
let pedidoItemSerialSelecionadoId = null;
let serialDisponiveisContexto = null;
let impressaoSeriaisContexto = null;
let kitsResumoContexto = {
  escopo: 'dia',
  data: null
};
let autoRefreshHandle = null;
let jspmReadyPromise = null;
let draggedPedidoCard = null;
let jspmPrintState = {
  printers: [],
  lastError: ''
};

const refs = {
  mensagem: document.getElementById('pedidos-mensagem'),
  filtroBusca: document.getElementById('pedidos-filtro-busca'),
  pedidosBoard: document.getElementById('pedidos-board'),
  pedidosHojeLista: document.getElementById('pedidos-hoje-lista'),
  prioridadeLista: document.getElementById('pedidos-prioridade-lista'),
  pedidosHojeTotal: document.getElementById('pedidos-hoje-total'),
  pedidosBaseTotal: document.getElementById('pedidos-base-total'),
  historicoTbody: document.getElementById('pedidos-historico-tbody'),
  ativosTotal: document.getElementById('pedidos-ativos-total'),
  historicoTotal: document.getElementById('pedidos-historico-total'),
  cardAtivos: document.getElementById('pedidos-card-ativos'),
  cardNf: document.getElementById('pedidos-card-nf'),
  cardTransportadora: document.getElementById('pedidos-card-transportadora'),
  cardHoje: document.getElementById('pedidos-card-hoje'),
  cardSeriais: document.getElementById('pedidos-card-seriais'),
  sectorMenu: document.getElementById('pedidos-sector-menu'),

  criacaoModal: document.getElementById('pedido-criacao-modal'),
  criacaoMensagem: document.getElementById('pedido-criacao-mensagem'),
  criacaoForm: document.getElementById('pedido-criacao-form'),
  criacaoTitulo: document.getElementById('pedido-criacao-titulo'),
  criacaoSubtitulo: document.getElementById('pedido-criacao-subtitulo'),
  criacaoSubmit: document.getElementById('pedido-criacao-submit'),
  pedidoId: document.getElementById('pedido-id'),
  pedidoCodigo: document.getElementById('pedido-codigo'),
  cliente: document.getElementById('pedido-cliente'),
  clientesLista: document.getElementById('pedido-clientes-lista'),
  cidade: document.getElementById('pedido-cidade'),
  data: document.getElementById('pedido-data'),
  vendedora: document.getElementById('pedido-vendedora'),
  transportadora: document.getElementById('pedido-transportadora'),
  possuiNf: document.getElementById('pedido-possui-nf'),
  observacao: document.getElementById('pedido-observacao'),
  itemBusca: document.getElementById('pedido-item-busca'),
  itemSugestoes: document.getElementById('pedido-item-sugestoes'),
  itemQuantidade: document.getElementById('pedido-item-quantidade'),
  itemResumo: document.getElementById('pedido-item-resumo'),
  itensTotal: document.getElementById('pedido-itens-total'),
  itensTbody: document.getElementById('pedido-itens-tbody'),

  detalheModal: document.getElementById('pedido-detalhe-modal'),
  detalheMensagem: document.getElementById('pedido-detalhe-mensagem'),
  detalheTitulo: document.getElementById('pedido-detalhe-titulo'),
  detalheSubtitulo: document.getElementById('pedido-detalhe-subtitulo'),
  detalheObservacao: document.getElementById('pedido-detalhe-observacao'),
  detalheResumo: document.getElementById('pedido-detalhe-resumo'),
  detalheItensTbody: document.getElementById('pedido-detalhe-itens-tbody'),
  detalheNf: document.getElementById('pedido-detalhe-nf'),
  detalhePesoTotal: document.getElementById('pedido-detalhe-peso-total'),
  detalheVolumes: document.getElementById('pedido-detalhe-volumes'),
  detalheExcluir: document.getElementById('pedido-btn-excluir'),
  detalheEditar: document.getElementById('pedido-btn-editar'),
  detalheSalvarDadosFinais: document.getElementById('pedido-btn-salvar-dados-finais'),
  detalheMarcarColetado: document.getElementById('pedido-btn-marcar-coletado'),
  detalheImprimirCaixas: document.getElementById('pedido-btn-imprimir-caixas'),

  seriaisModal: document.getElementById('pedido-seriais-modal'),
  seriaisMensagem: document.getElementById('pedido-seriais-mensagem'),
  seriaisTitulo: document.getElementById('pedido-seriais-titulo'),
  seriaisSubtitulo: document.getElementById('pedido-seriais-subtitulo'),
  seriaisResumo: document.getElementById('pedido-seriais-resumo'),
  seriaisVinculados: document.getElementById('pedido-seriais-vinculados'),
  seriaisTbody: document.getElementById('pedido-seriais-tbody'),
  seriaisAutoSelecionar: document.getElementById('pedido-btn-auto-selecionar-seriais'),
  impressaoSeriaisModal: document.getElementById('pedido-impressao-seriais-modal'),
  impressaoSeriaisMensagem: document.getElementById('pedido-impressao-seriais-mensagem'),
  impressaoSeriaisTitulo: document.getElementById('pedido-impressao-seriais-titulo'),
  impressaoSeriaisSubtitulo: document.getElementById('pedido-impressao-seriais-subtitulo'),
  impressaoSeriaisResumo: document.getElementById('pedido-impressao-seriais-resumo'),
  impressaoSeriaisTbody: document.getElementById('pedido-impressao-seriais-tbody'),

  faltasModal: document.getElementById('pedido-faltas-modal'),
  faltasTitulo: document.getElementById('pedido-faltas-titulo'),
  faltasSubtitulo: document.getElementById('pedido-faltas-subtitulo'),
  faltasTbody: document.getElementById('pedido-faltas-tbody'),

  historicoModal: document.getElementById('pedido-historico-modal'),
  historicoFiltroCliente: document.getElementById('pedido-historico-filtro-cliente'),
  historicoFiltroTransportadora: document.getElementById('pedido-historico-filtro-transportadora'),
  historicoFiltroPedido: document.getElementById('pedido-historico-filtro-pedido'),
  historicoFiltroData: document.getElementById('pedido-historico-filtro-data'),

  relatorioModal: document.getElementById('pedido-relatorio-modal'),
  relatorioTitulo: document.getElementById('pedido-relatorio-titulo'),
  relatorioSubtitulo: document.getElementById('pedido-relatorio-subtitulo'),
  relatorioResumo: document.getElementById('pedido-relatorio-resumo'),
  relatorioImprimir: document.getElementById('pedido-btn-imprimir-relatorio'),
  relatorioTabs: document.querySelectorAll('[data-relatorio-tab]'),
  relatorioPaineis: document.querySelectorAll('[data-relatorio-panel]'),
  relatorioMontagemTbody: document.getElementById('pedido-relatorio-montagem-tbody'),
  relatorioKitsTbody: document.getElementById('pedido-relatorio-kits-tbody'),
  relatorioItensTbody: document.getElementById('pedido-relatorio-itens-tbody'),
  relatorioReparosTbody: document.getElementById('pedido-relatorio-reparos-tbody'),
  kitsModal: document.getElementById('pedido-kits-modal'),
  kitsMensagem: document.getElementById('pedido-kits-mensagem'),
  kitsResumo: document.getElementById('pedido-kits-resumo'),
  kitsTbody: document.getElementById('pedido-kits-tbody'),
  kitsBtnDia: document.getElementById('pedido-btn-kits-dia'),
  kitsBtnGeral: document.getElementById('pedido-btn-kits-geral'),

  kitImagemModal: document.getElementById('pedido-kit-imagem-modal'),
  kitImagemTitulo: document.getElementById('pedido-kit-imagem-titulo'),
  kitImagemSubtitulo: document.getElementById('pedido-kit-imagem-subtitulo'),
  kitImagemPreview: document.getElementById('pedido-kit-imagem-preview'),
  coletaConfirmModal: document.getElementById('pedido-coleta-confirm-modal'),
  coletaConfirmMensagem: document.getElementById('pedido-coleta-confirm-mensagem'),
  coletaConfirmCheckbox: document.getElementById('pedido-coleta-confirm-checkbox'),
  coletaConfirmar: document.getElementById('pedido-btn-confirmar-coleta')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  registrarSincronizacaoEntreAbas();
  inicializarJsPrintManager().catch(() => {});

  try {
    await carregarTudo();
    await abrirPedidoViaQueryString();
    iniciarAtualizacaoAutomatica();
  } catch (error) {
    mostrarMensagem(error.message || 'Nao foi possivel carregar a tela de pedidos.', 'error');
  }
});

function bindEvents() {
  document.getElementById('pedidos-btn-novo').addEventListener('click', () => {
    fecharMenuPedidos();
    abrirModalCriacao();
  });
  document.getElementById('pedidos-btn-atualizar').addEventListener('click', () => {
    fecharMenuPedidos();
    carregarTudo().catch((error) => mostrarMensagem(error.message, 'error'));
  });
  document.getElementById('pedidos-btn-historico').addEventListener('click', () => {
    fecharMenuPedidos();
    abrirModalHistoricoPedidos();
  });
  document.getElementById('pedidos-btn-relatorio-dia').addEventListener('click', () => {
    fecharMenuPedidos();
    abrirModalRelatorio('dia');
  });
  document.getElementById('pedidos-btn-relatorio-geral').addEventListener('click', () => {
    fecharMenuPedidos();
    abrirModalRelatorio('geral');
  });
  document.getElementById('pedidos-btn-kits').addEventListener('click', () => {
    fecharMenuPedidos();
    abrirModalKits('dia').catch((error) => {
      mostrarMensagem(error.message || 'Nao foi possivel abrir o gerenciamento de kits.', 'error');
    });
  });

  refs.filtroBusca.addEventListener('input', renderizarPedidos);

  refs.pedidosHojeLista.addEventListener('click', handleListaPedidosActions);
  refs.prioridadeLista.addEventListener('click', handleListaPedidosActions);
  refs.pedidosHojeLista.addEventListener('dragstart', handlePedidoDragStart);
  refs.pedidosHojeLista.addEventListener('dragover', handlePedidoDragOver);
  refs.pedidosHojeLista.addEventListener('drop', handlePedidoDrop);
  refs.pedidosHojeLista.addEventListener('dragend', handlePedidoDragEnd);
  refs.prioridadeLista.addEventListener('dragstart', handlePedidoDragStart);
  refs.prioridadeLista.addEventListener('dragover', handlePedidoDragOver);
  refs.prioridadeLista.addEventListener('drop', handlePedidoDrop);
  refs.prioridadeLista.addEventListener('dragend', handlePedidoDragEnd);
  refs.historicoTbody.addEventListener('click', handleHistoricoActions);
  refs.historicoFiltroCliente.addEventListener('input', () => renderizarHistoricoPedidos(obterHistoricoFiltrado()));
  refs.historicoFiltroTransportadora.addEventListener('input', () => renderizarHistoricoPedidos(obterHistoricoFiltrado()));
  refs.historicoFiltroPedido.addEventListener('input', () => renderizarHistoricoPedidos(obterHistoricoFiltrado()));
  refs.historicoFiltroData.addEventListener('input', () => renderizarHistoricoPedidos(obterHistoricoFiltrado()));
  document.getElementById('pedido-historico-filtro-limpar').addEventListener('click', limparFiltrosHistorico);

  document.getElementById('btn-fechar-modal-pedido-criacao').addEventListener('click', fecharModalCriacao);
  document.getElementById('btn-cancelar-modal-pedido-criacao').addEventListener('click', fecharModalCriacao);
  refs.criacaoForm.addEventListener('submit', handleCriarPedido);
  refs.cliente.addEventListener('input', handleClienteInput);
  refs.itemBusca.addEventListener('input', () => {
    itemDraftSelecionado = null;
    renderizarResumoItemDraft(null);
    renderizarSugestoesItemPedido(refs.itemBusca.value.trim());
  });
  refs.itemBusca.addEventListener('focus', () => renderizarSugestoesItemPedido(refs.itemBusca.value.trim()));
  refs.itemSugestoes.addEventListener('click', handleSugestaoItemPedidoClick);
  document.getElementById('pedido-btn-adicionar-item').addEventListener('click', adicionarItemDraft);
  refs.itensTbody.addEventListener('click', handleItensDraftActions);

  document.getElementById('btn-fechar-modal-pedido-detalhe').addEventListener('click', fecharModalDetalhe);
  refs.detalheExcluir.addEventListener('click', excluirPedidoSelecionado);
  refs.detalheEditar.addEventListener('click', abrirEdicaoPedidoSelecionado);
  refs.detalheSalvarDadosFinais.addEventListener('click', salvarDadosFinaisPedido);
  refs.detalheImprimirCaixas.addEventListener('click', imprimirEtiquetasCaixaPedidoSelecionado);
  document.getElementById('pedido-btn-marcar-coletado').addEventListener('click', abrirConfirmacaoColetaPedido);
  refs.detalheItensTbody.addEventListener('click', handleDetalheItemActions);
  refs.detalheItensTbody.addEventListener('change', handleDetalheItemChanges);

  document.getElementById('btn-fechar-modal-pedido-seriais').addEventListener('click', fecharModalSeriais);
  document.getElementById('btn-cancelar-modal-pedido-seriais').addEventListener('click', fecharModalSeriais);
  document.getElementById('pedido-btn-vincular-seriais').addEventListener('click', vincularSeriaisSelecionados);
  refs.seriaisAutoSelecionar?.addEventListener('click', selecionarAutomaticamenteSeriais);
  refs.seriaisTbody.addEventListener('click', handleSeriaisModalClick);
  refs.seriaisTbody.addEventListener('change', handleSeriaisModalChange);
  refs.seriaisVinculados.addEventListener('click', handleSeriaisVinculadosActions);
  document.getElementById('btn-fechar-modal-pedido-impressao-seriais').addEventListener('click', fecharModalImpressaoSeriais);
  document.getElementById('btn-cancelar-modal-pedido-impressao-seriais').addEventListener('click', fecharModalImpressaoSeriais);
  document.getElementById('pedido-btn-confirmar-impressao-seriais').addEventListener('click', confirmarImpressaoSeriaisSelecionados);
  document.getElementById('pedido-btn-marcar-todos-seriais-impressao').addEventListener('click', () => marcarTodosSeriaisImpressao(true));
  document.getElementById('pedido-btn-limpar-seriais-impressao').addEventListener('click', () => marcarTodosSeriaisImpressao(false));
  refs.impressaoSeriaisTbody.addEventListener('click', handleImpressaoSeriaisModalClick);
  refs.impressaoSeriaisTbody.addEventListener('change', handleImpressaoSeriaisModalChange);

  document.getElementById('btn-fechar-modal-pedido-faltas').addEventListener('click', fecharModalFaltas);
  document.getElementById('btn-fechar-modal-pedido-historico').addEventListener('click', fecharModalHistoricoPedidos);
  document.getElementById('btn-fechar-modal-pedido-relatorio').addEventListener('click', fecharModalRelatorio);
  document.getElementById('btn-fechar-modal-pedido-kits').addEventListener('click', fecharModalKits);
  refs.kitsBtnDia.addEventListener('click', () => carregarResumoKits('dia').catch((error) => {
    refs.kitsMensagem.textContent = error.message || 'Nao foi possivel carregar os kits do dia.';
    refs.kitsMensagem.className = 'message error';
    refs.kitsMensagem.classList.remove('hidden');
  }));
  refs.kitsBtnGeral.addEventListener('click', () => carregarResumoKits('geral').catch((error) => {
    refs.kitsMensagem.textContent = error.message || 'Nao foi possivel carregar os kits globais.';
    refs.kitsMensagem.className = 'message error';
    refs.kitsMensagem.classList.remove('hidden');
  }));
  refs.kitsTbody.addEventListener('click', handleKitsActions);
  document.getElementById('btn-fechar-modal-pedido-kit-imagem').addEventListener('click', fecharModalKitImagem);
  document.getElementById('btn-fechar-modal-pedido-kit-imagem-rodape').addEventListener('click', fecharModalKitImagem);
  document.getElementById('btn-fechar-modal-pedido-coleta-confirm').addEventListener('click', fecharConfirmacaoColetaPedido);
  document.getElementById('pedido-btn-cancelar-coleta-confirm').addEventListener('click', fecharConfirmacaoColetaPedido);
  refs.coletaConfirmCheckbox?.addEventListener('change', () => {
    refs.coletaConfirmar.disabled = !refs.coletaConfirmCheckbox.checked;
  });
  refs.coletaConfirmar?.addEventListener('click', marcarPedidoColetado);
  refs.relatorioImprimir.addEventListener('click', imprimirRelatorioAtual);
  refs.relatorioTabs.forEach((tab) => {
    tab.addEventListener('click', () => alternarAbaRelatorio(tab.dataset.relatorioTab));
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) {
      esconderSugestoesItemPedido();
    }

    if (refs.sectorMenu?.open && !event.target.closest('.sector-menu')) {
      refs.sectorMenu.open = false;
    }
  });

  document.addEventListener('keydown', handleKeyboardShortcuts);
  document.querySelectorAll('[data-close-modal]').forEach((element) => {
    element.addEventListener('click', handleModalBackdrop);
  });
}

function notificarAtualizacaoOperacional(topics, payload = {}) {
  window.SafisaSync?.notify?.(topics, payload);
}

function registrarSincronizacaoEntreAbas() {
  if (!window.SafisaSync?.subscribe) {
    return;
  }

  let refreshTimer = null;
  const agendarRefresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      carregarTudo()
        .catch((error) => {
          console.error('Falha ao sincronizar pedidos entre abas:', error);
        });
    }, 180);
  };

  ['pedidos-expedicao', 'submontagem-seriais', 'estoque'].forEach((topic) => {
    window.SafisaSync.subscribe(topic, agendarRefresh);
  });
}

function getStoredPreferredPrinter() {
  try {
    return window.localStorage.getItem(PRINT_PREFERENCE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function resolvePreferredPrinter(printers = []) {
  const safePrinters = Array.isArray(printers) ? printers : [];
  const storedPrinter = getStoredPreferredPrinter();

  if (storedPrinter && (!safePrinters.length || safePrinters.includes(storedPrinter))) {
    return storedPrinter;
  }

  for (const candidate of AUTO_PRINTER_NAME_CANDIDATES) {
    if (safePrinters.includes(candidate)) {
      return candidate;
    }
  }

  return safePrinters.find((printerName) => /zdesigner\s+zd220|zebra\s+zd220|zd220-203dpi/i.test(printerName)) || '';
}

async function carregarImpressorasJsPrintManager() {
  const JSPM = window.JSPM;
  if (!JSPM?.JSPrintManager?.getPrinters) {
    return [];
  }

  try {
    const printers = await Promise.resolve(JSPM.JSPrintManager.getPrinters());
    return Array.isArray(printers) ? printers : [];
  } catch (error) {
    jspmPrintState.lastError = error.message || 'Nao foi possivel consultar as impressoras.';
    return [];
  }
}

async function iniciarJsPrintManagerClient(JSPM, onStatusChanged) {
  if (!window.SafisaJspmClient?.start) {
    throw new Error('Cliente local de impressao nao carregado nesta pagina.');
  }

  return window.SafisaJspmClient.start({ jspm: JSPM, onStatusChanged });
}

function esperar(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function aguardarJsPrintManagerAberto(JSPM) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const status = JSPM.JSPrintManager.websocket_status;
    if (status === JSPM.WSStatus.Open) {
      return;
    }

    if (status === JSPM.WSStatus.Blocked) {
      throw new Error('O JSPrintManager bloqueou esta pagina nesta maquina.');
    }

    await esperar(250);
  }

  throw new Error('O servico local do JSPrintManager nao respondeu como esperado.');
}

async function atualizarImpressorasDisponiveis() {
  const printers = await carregarImpressorasJsPrintManager();
  jspmPrintState.printers = printers;
  if (printers.length) {
    jspmPrintState.lastError = '';
  }
  return printers;
}

function inicializarJsPrintManager(options = {}) {
  const { forceRestart = false } = options;

  if (!window.JSPM?.JSPrintManager) {
    jspmPrintState = {
      printers: [],
      lastError: 'A biblioteca JSPrintManager.js nao esta disponivel nesta pagina.'
    };
    return Promise.reject(new Error(jspmPrintState.lastError));
  }

  const JSPM = window.JSPM;
  const statusAtual = JSPM.JSPrintManager.websocket_status;

  if (forceRestart) {
    jspmReadyPromise = null;
  }

  if (statusAtual === JSPM.WSStatus.Open && !forceRestart) {
    return atualizarImpressorasDisponiveis();
  }

  if (jspmReadyPromise) {
    return jspmReadyPromise;
  }

  JSPM.JSPrintManager.auto_reconnect = true;

  jspmReadyPromise = iniciarJsPrintManagerClient(JSPM)
    .then(async () => {
      await aguardarJsPrintManagerAberto(JSPM);
      await atualizarImpressorasDisponiveis();
    })
    .catch((error) => {
      const detail = error.message || String(error);
      const clientDescription = window.SafisaJspmClient?.description || 'localhost:28443';
      jspmPrintState = {
        printers: [],
        lastError: `Nao foi possivel conectar ao JSPrintManager local em ${clientDescription}. ${detail}`
      };
      throw error;
    });

  jspmReadyPromise.catch(() => {
    jspmReadyPromise = null;
  });

  return jspmReadyPromise;
}

async function ensureJsPrintManagerReady() {
  if (!window.JSPM?.JSPrintManager) {
    throw new Error('Biblioteca JSPrintManager nao carregada nesta pagina.');
  }

  if (!jspmReadyPromise) {
    jspmReadyPromise = Promise.resolve(inicializarJsPrintManager());
  }

  return jspmReadyPromise;
}

async function enviarZplParaImpressoraPadrao(zplAgrupado) {
  await ensureJsPrintManagerReady();

  const JSPM = window.JSPM;
  const knownPrinters = Array.isArray(jspmPrintState.printers) ? jspmPrintState.printers : [];
  const preferredPrinter = resolvePreferredPrinter(knownPrinters);
  const printJob = new JSPM.ClientPrintJob();
  printJob.clientPrinter = preferredPrinter
    ? new JSPM.InstalledPrinter(preferredPrinter)
    : new JSPM.DefaultPrinter();
  printJob.printerCommands = zplAgrupado;

  await Promise.resolve(printJob.sendToClient());
  return preferredPrinter || DEFAULT_PRINTER_NAME;
}

function agruparZplLabels(labels = []) {
  return labels
    .map((label) => String(label?.zpl || '').trim())
    .filter(Boolean)
    .join('\n');
}

async function registrarHistoricoImpressao(entries = [], impressoraNome = DEFAULT_PRINTER_NAME) {
  if (!entries.length) {
    return;
  }

  await fetchJson(PRINT_HISTORY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      impressora_nome: impressoraNome,
      entries
    })
  });
}

async function carregarTudo() {
  const [itens, clientes, pedidos, resumoSeriais] = await Promise.all([
    fetchJson(`${estoqueItensApiBaseUrl}`),
    fetchJson(`${pedidosApiBaseUrl}/clientes?limit=20`),
    fetchJson(`${pedidosApiBaseUrl}`),
    fetchJson(`${submontagemSeriaisApiBaseUrl}/disponiveis/resumo`)
  ]);

  itensCache = Array.isArray(itens) ? itens : [];
  clientesCache = Array.isArray(clientes) ? clientes : [];
  pedidosCache = Array.isArray(pedidos) ? pedidos : [];
  resumoSeriaisDisponiveis = resumoSeriais || { total_disponivel: 0, modelos: [] };

  preencherClientesDatalist();
  atualizarIndicadores();
  renderizarPedidos();
}

function preencherClientesDatalist() {
  refs.clientesLista.innerHTML = clientesCache.map((cliente) => `
    <option value="${escapeHtml(cliente.cliente_nome)}"></option>
  `).join('');
}

function atualizarIndicadores() {
  const ativos = pedidosCache.filter((pedido) => pedido.status !== 'PEDIDO COLETADO');
  const aguardandoNf = ativos.filter((pedido) => pedido.status === 'AGUARDANDO NF').length;
  const aguardandoTransportadora = ativos.filter((pedido) => pedido.status === 'AGUARDANDO TRANSPORTADORA').length;
  const programadosHoje = ativos.filter((pedido) => isPedidoProgramadoHoje(pedido)).length;

  refs.cardAtivos.textContent = String(ativos.length);
  refs.cardNf.textContent = String(aguardandoNf);
  refs.cardTransportadora.textContent = String(aguardandoTransportadora);
  refs.cardHoje.textContent = String(programadosHoje);
  refs.cardSeriais.textContent = formatInteger(resumoSeriaisDisponiveis.total_disponivel || 0);
}

function obterPedidosFiltrados() {
  const busca = normalizarBusca(refs.filtroBusca.value.trim());

  return pedidosCache.filter((pedido) => {
    if (pedido.status === 'PEDIDO COLETADO') {
      return false;
    }

    if (!busca) {
      return true;
    }

    return [
      pedido.codigo_pedido,
      pedido.cliente_nome,
      pedido.cidade,
      pedido.transportadora,
      pedido.vendedora
    ].some((value) => normalizarBusca(value).includes(busca));
  });
}

function renderizarPedidos() {
  const pedidosFiltrados = obterPedidosFiltrados();
  const ativos = pedidosFiltrados.filter((pedido) => pedido.status !== 'PEDIDO COLETADO');
  const historico = obterHistoricoFiltrado();
  const ativosOrdenados = [...ativos].sort((a, b) => a.prioridade_ordem - b.prioridade_ordem || a.id - b.id);
  const pedidosHoje = ativosOrdenados.filter((pedido) => isPedidoProgramadoHoje(pedido));
  const pedidosBase = ativosOrdenados.filter((pedido) => !isPedidoProgramadoHoje(pedido));

  refs.ativosTotal.textContent = `${ativos.length} pedido(s) ativo(s)`;
  refs.historicoTotal.textContent = `${historico.length} registro(s)`;
  refs.pedidosHojeTotal.textContent = `${pedidosHoje.length} pedido(s)`;
  refs.pedidosBaseTotal.textContent = `${pedidosBase.length} pedido(s)`;
  refs.pedidosBoard.classList.remove('hidden');

  if (!pedidosFiltrados.length) {
    refs.pedidosHojeLista.innerHTML = '<div class="empty-state">Nenhum pedido encontrado com os filtros informados.</div>';
    refs.prioridadeLista.innerHTML = '<div class="empty-state">Nenhum pedido encontrado com os filtros informados.</div>';
    renderizarHistoricoPedidos(historico);
    return;
  }

  refs.pedidosHojeLista.innerHTML = pedidosHoje.length
    ? pedidosHoje.map((pedido) => renderizarCardPedido(pedido, { lane: 'hoje' })).join('')
    : '<div class="empty-state">Nenhum pedido selecionado para sair hoje.</div>';

  refs.prioridadeLista.innerHTML = pedidosBase.length
    ? pedidosBase.map((pedido) => renderizarCardPedido(pedido, { lane: 'base' })).join('')
    : '<div class="empty-state">Nenhum pedido aguardando programacao.</div>';

  renderizarHistoricoPedidos(historico);
}

function renderizarHistoricoPedidos(historico) {
  refs.historicoTbody.innerHTML = historico.length
    ? historico.map((pedido) => `
      <tr>
        <td>${escapeHtml(pedido.cliente_nome)}</td>
        <td class="table-code">${escapeHtml(pedido.codigo_pedido)}</td>
        <td>${escapeHtml(pedido.cidade || '-')}</td>
        <td>${renderStatusPedido('COLETADO')}</td>
        <td>${formatDate(pedido.data_coleta || pedido.data_pedido)}</td>
        <td>${escapeHtml(pedido.transportadora || '-')}</td>
        <td>${formatDecimal(pedido.massa_total_kg || 0)} kg</td>
        <td>${escapeHtml(String(pedido.quantidade_volumes ?? '-'))}</td>
        <td><button class="btn btn-neutral btn-small" type="button" data-action="abrir-pedido" data-id="${pedido.id}">Ver</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="9" class="empty-state">Nenhum pedido coletado ainda.</td></tr>';
}

function renderizarCardPedido(pedido, options = {}) {
  const lane = options.lane || 'base';
  const faltas = Array.isArray(pedido.faltantes) ? pedido.faltantes.length : 0;
  const progresso = `${formatInteger(pedido.itens_concluidos || 0)}/${formatInteger(pedido.total_itens || 0)}`;
  const linhaSecundaria = [pedido.codigo_pedido, pedido.cidade].filter(Boolean).join(' | ');
  const acaoProgramacao = lane === 'hoje'
    ? { action: 'tirar-de-hoje', label: 'Voltar' }
    : { action: 'colocar-hoje', label: 'Hoje' };
  const observacao = String(pedido.observacao || '').trim();
  const alertaObservacao = observacao
    ? `
      <button
        class="btn btn-small"
        type="button"
        data-action="ver-observacao"
        data-id="${pedido.id}"
        title="${escapeHtml(observacao)}"
        aria-label="Ver observacao do pedido"
        style="min-width:30px;padding:0 10px;background:#f5b942;border-color:#e2a51c;color:#5b3a00;font-weight:900;"
      >
        !
      </button>
    `
    : '';

  return `
    <article
      class="pedido-prioridade-card ${pedido.pode_atender ? 'is-ready' : 'is-pending'}"
      data-id="${pedido.id}"
      data-lane="${lane}"
      draggable="true"
    >
      <div class="pedido-prioridade-handle" aria-hidden="true">::</div>

      <div class="pedido-prioridade-main">
        <div class="pedido-prioridade-head">
          <div class="pedido-prioridade-identidade">
            <h3>${escapeHtml(pedido.cliente_nome || pedido.codigo_pedido || '-')}</h3>
            <p>${escapeHtml(linhaSecundaria || '-')}</p>
          </div>

          <div class="selected-tags pedido-prioridade-tags">
            <span class="selected-tag ${obterClasseChipPedido(pedido)}">${escapeHtml(obterTextoChipPedido(pedido))}</span>
          </div>
        </div>

        <div class="pedido-prioridade-grid pedido-prioridade-grid-compact">
          <span>${formatarDataCurta(pedido.data_pedido)}</span>
          <span>${escapeHtml(pedido.transportadora || '-')}</span>
          <span>Itens ${progresso}</span>
          <span>Faltam ${formatInteger(faltas)}</span>
        </div>

        <div class="pedido-prioridade-actions">
          <button class="btn btn-neutral btn-small" type="button" data-action="abrir-pedido" data-id="${pedido.id}">Ver</button>
          <button class="btn btn-primary btn-small" type="button" data-action="${acaoProgramacao.action}" data-id="${pedido.id}">${acaoProgramacao.label}</button>
          <button class="btn btn-secondary btn-small" type="button" data-action="ver-faltas" data-id="${pedido.id}">${formatInteger(faltas)}</button>
          ${alertaObservacao}
        </div>
      </div>
    </article>
  `;
}

function contarSeriaisPedido(pedido) {
  return (pedido.itens || []).reduce((total, item) => total + (item.seriais_vinculados?.length || 0), 0);
}

function handleListaPedidosActions(event) {
  const actionElement = event.target.closest('[data-action][data-id]');
  if (!actionElement) {
    const card = event.target.closest('.pedido-prioridade-card[data-id]');
    if (card && !event.target.closest('button')) {
      const lane = card.dataset.lane || 'base';
      const pedidoId = Number(card.dataset.id);
      if (lane === 'base') {
        atualizarProgramacaoHojePedido(pedidoId, true).catch((error) => mostrarMensagem(error.message, 'error'));
      } else {
        abrirDetalhePedido(pedidoId).catch((error) => mostrarMensagem(error.message, 'error'));
      }
    }
    return;
  }

  const pedidoId = Number(actionElement.dataset.id);
  if (actionElement.dataset.action === 'abrir-pedido') {
    abrirDetalhePedido(pedidoId).catch((error) => mostrarMensagem(error.message, 'error'));
    return;
  }

  if (actionElement.dataset.action === 'ver-faltas') {
    abrirModalFaltasPedido(pedidoId);
    return;
  }

  if (actionElement.dataset.action === 'ver-observacao') {
    const pedido = pedidosCache.find((item) => item.id === pedidoId);
    if (pedido && String(pedido.observacao || '').trim()) {
      mostrarMensagem(`Observacao de ${pedido.cliente_nome}: ${pedido.observacao}`, 'warning');
    }
    return;
  }

  if (actionElement.dataset.action === 'colocar-hoje') {
    atualizarProgramacaoHojePedido(pedidoId, true).catch((error) => mostrarMensagem(error.message, 'error'));
    return;
  }

  if (actionElement.dataset.action === 'tirar-de-hoje') {
    atualizarProgramacaoHojePedido(pedidoId, false).catch((error) => mostrarMensagem(error.message, 'error'));
  }
}

function handleHistoricoActions(event) {
  const button = event.target.closest('[data-action="abrir-pedido"][data-id]');
  if (!button) {
    return;
  }

  fecharModalHistoricoPedidos();
  abrirDetalhePedido(Number(button.dataset.id)).catch((error) => mostrarMensagem(error.message, 'error'));
}

function abrirModalHistoricoPedidos() {
  openModal(refs.historicoModal);
}

function fecharModalHistoricoPedidos() {
  closeModal(refs.historicoModal);
}

function limparFiltrosHistorico() {
  refs.historicoFiltroCliente.value = '';
  refs.historicoFiltroTransportadora.value = '';
  refs.historicoFiltroPedido.value = '';
  refs.historicoFiltroData.value = '';
  renderizarHistoricoPedidos(obterHistoricoFiltrado());
}

function obterHistoricoFiltrado() {
  const filtroCliente = normalizarBusca(refs.historicoFiltroCliente?.value?.trim());
  const filtroTransportadora = normalizarBusca(refs.historicoFiltroTransportadora?.value?.trim());
  const filtroPedido = normalizarBusca(refs.historicoFiltroPedido?.value?.trim());
  const filtroData = String(refs.historicoFiltroData?.value || '').trim();

  return pedidosCache
    .filter((pedido) => pedido.status === 'PEDIDO COLETADO')
    .filter((pedido) => {
      if (filtroCliente && !normalizarBusca(pedido.cliente_nome).includes(filtroCliente)) {
        return false;
      }

      if (filtroTransportadora && !normalizarBusca(pedido.transportadora).includes(filtroTransportadora)) {
        return false;
      }

      if (filtroPedido && !normalizarBusca(pedido.codigo_pedido).includes(filtroPedido)) {
        return false;
      }

       if (filtroData) {
        const dataHistorico = normalizeDateInput(pedido.data_coleta || pedido.data_pedido);
        if (dataHistorico !== filtroData) {
          return false;
        }
      }

      return true;
    });
}

function obterTextoChipPedido(pedido) {
  if (!pedido.pode_atender && ['AGUARDANDO MONTAGEM', 'EM MONTAGEM'].includes(pedido.status)) {
    return 'Faltam itens';
  }

  if (pedido.status === 'PEDIDO COLETADO') {
    return 'COLETADO';
  }

  return pedido.status || 'AGUARDANDO MONTAGEM';
}

function obterClasseChipPedido(pedido) {
  const texto = obterTextoChipPedido(pedido);
  if (texto === 'Faltam itens') {
    return 'status-pending';
  }

  if (texto === 'AGUARDANDO TRANSPORTADORA' || texto === 'COLETADO') {
    return 'status-ready';
  }

  if (texto === 'AGUARDANDO NF') {
    return 'status-warning';
  }

  return 'status-neutral';
}

function abrirModalRelatorio(tipo) {
  const pedidosBase = pedidosCache.filter((pedido) => pedido.status !== 'PEDIDO COLETADO');
  const pedidos = tipo === 'dia'
    ? pedidosBase.filter((pedido) => isPedidoProgramadoHoje(pedido))
    : pedidosBase;
  const relatorio = construirRelatorioOperacional(pedidos);
  const titulo = tipo === 'dia' ? 'Relatorio do dia' : 'Relatorio geral';
  const subtitulo = tipo === 'dia'
    ? 'Pedidos programados para sair hoje.'
    : 'Todos os pedidos ativos da expedicao.';

  refs.relatorioTitulo.textContent = titulo;
  refs.relatorioSubtitulo.textContent = subtitulo;
  refs.relatorioResumo.innerHTML = `
    <span class="selected-tag">Pedidos: ${formatInteger(relatorio.totalPedidos)}</span>
    <span class="selected-tag">Servos: ${formatInteger(relatorio.totalMontagem)}</span>
    <span class="selected-tag">Kits: ${formatInteger(relatorio.totalKits)}</span>
    <span class="selected-tag">Itens: ${formatInteger(relatorio.totalItens)}</span>
    <span class="selected-tag">Reparos: ${formatInteger(relatorio.totalReparos)}</span>
  `;

  refs.relatorioMontagemTbody.innerHTML = renderizarTabelaRelatorio(
    relatorio.montagem,
    'Nenhum servo pendente.'
  );
  refs.relatorioKitsTbody.innerHTML = renderizarTabelaRelatorio(
    relatorio.kits,
    'Nenhum kit pendente.'
  );
  refs.relatorioItensTbody.innerHTML = renderizarTabelaRelatorio(
    relatorio.itens,
    'Nenhum item pendente.'
  );
  refs.relatorioReparosTbody.innerHTML = renderizarTabelaRelatorio(
    relatorio.reparos,
    'Nenhum reparo pendente.'
  );

  alternarAbaRelatorio('montagem');
  openModal(refs.relatorioModal);
}

function fecharModalRelatorio() {
  closeModal(refs.relatorioModal);
}

function alternarAbaRelatorio(tabName) {
  const activeTab = tabName || 'montagem';

  refs.relatorioTabs.forEach((tab) => {
    const isActive = tab.dataset.relatorioTab === activeTab;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  refs.relatorioPaineis.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.relatorioPanel === activeTab);
  });
}

async function abrirModalKits(escopo = 'dia') {
  openModal(refs.kitsModal);
  await carregarResumoKits(escopo);
}

function fecharModalKits() {
  refs.kitsMensagem.className = 'message hidden';
  refs.kitsMensagem.textContent = '';
  closeModal(refs.kitsModal);
}

async function carregarResumoKits(escopo = 'dia') {
  const normalizedScope = escopo === 'geral' ? 'geral' : 'dia';
  kitsResumoContexto.escopo = normalizedScope;
  refs.kitsMensagem.className = 'message hidden';
  refs.kitsMensagem.textContent = '';
  refs.kitsTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Carregando kits...</td></tr>';

  try {
    const resumo = await fetchJson(`${pedidosApiBaseUrl}/kits-resumo?escopo=${normalizedScope}`);
    kitsResumoContexto.data = resumo;
    renderizarResumoKits();
  } catch (error) {
    refs.kitsTbody.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(error.message || 'Nao foi possivel carregar os kits.')}</td></tr>`;
    throw error;
  }
}

function renderizarResumoKits() {
  const resumo = kitsResumoContexto.data || {
    escopo: kitsResumoContexto.escopo,
    total_kits: 0,
    total_requerido: 0,
    total_estoque: 0,
    total_pendente: 0,
    kits: []
  };
  const escopo = resumo.escopo === 'geral' ? 'geral' : 'dia';
  const kits = Array.isArray(resumo.kits) ? resumo.kits : [];

  refs.kitsBtnDia.classList.toggle('btn-secondary', escopo === 'dia');
  refs.kitsBtnDia.classList.toggle('btn-neutral', escopo !== 'dia');
  refs.kitsBtnGeral.classList.toggle('btn-secondary', escopo === 'geral');
  refs.kitsBtnGeral.classList.toggle('btn-neutral', escopo !== 'geral');

  refs.kitsResumo.innerHTML = `
    <span class="selected-tag">Escopo: ${escapeHtml(escopo === 'dia' ? 'Dia' : 'Global')}</span>
    <span class="selected-tag">Modelos: ${formatInteger(resumo.total_kits || 0)}</span>
    <span class="selected-tag">Necessario: ${formatDecimal(resumo.total_requerido || 0)}</span>
    <span class="selected-tag">Em estoque: ${formatDecimal(resumo.total_estoque || 0)}</span>
    <span class="selected-tag">Faltam: ${formatDecimal(resumo.total_pendente || 0)}</span>
  `;

  if (!kits.length) {
    refs.kitsTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum kit pendente para este escopo.</td></tr>';
    return;
  }

  refs.kitsTbody.innerHTML = kits.map((kit) => {
    const valorPadrao = Number(kit.quantidade_pendente || 0) > 0
      ? formatDecimalInput(kit.quantidade_pendente || 0, 2)
      : '';

    return `
      <tr>
        <td class="table-code">${renderizarCodigoKitImagem(kit.codigo, kit.codigos_origem, kit.descricao)}</td>
        <td>${escapeHtml(kit.descricao)}</td>
        <td>${escapeHtml((kit.clientes || []).join(', '))}</td>
        <td>${formatDecimal(kit.quantidade_requerida || 0)}</td>
        <td>${formatDecimal(kit.quantidade_em_estoque || 0)}</td>
        <td><strong>${formatDecimal(kit.quantidade_pendente || 0)}</strong></td>
        <td>
          <input
            class="pedido-kit-quantidade-input"
            type="number"
            min="0"
            step="1"
            value="${escapeHtml(valorPadrao)}"
            data-kit-quantidade="${kit.id_peca}"
            ${Number(kit.quantidade_pendente || 0) <= 0 ? 'disabled' : ''}
          >
        </td>
        <td>
          <button
            class="btn btn-secondary btn-small"
            type="button"
            data-action="montar-kit"
            data-id-peca="${kit.id_peca}"
            ${Number(kit.quantidade_pendente || 0) <= 0 ? 'disabled' : ''}
          >Registrar</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleKitsActions(event) {
  const button = event.target.closest('button[data-action="montar-kit"][data-id-peca]');
  if (!button) {
    return;
  }

  const idPeca = Number.parseInt(button.dataset.idPeca, 10);
  if (!Number.isInteger(idPeca)) {
    return;
  }

  const input = refs.kitsTbody.querySelector(`input[data-kit-quantidade="${idPeca}"]`);
  const quantidade = Number(String(input?.value || '').replace(',', '.'));

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    refs.kitsMensagem.textContent = 'Informe uma quantidade valida para registrar o kit montado.';
    refs.kitsMensagem.className = 'message error';
    refs.kitsMensagem.classList.remove('hidden');
    return;
  }

  const kit = (kitsResumoContexto.data?.kits || []).find((item) => Number(item.id_peca) === idPeca);
  const codigoKit = kit?.codigo || 'kit';

  button.disabled = true;
  button.textContent = 'Registrando...';

  try {
    await fetchJson(`${pedidosApiBaseUrl}/kits/${idPeca}/montar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantidade })
    });

    refs.kitsMensagem.textContent = `${codigoKit} registrado com sucesso na Expedicao.`;
    refs.kitsMensagem.className = 'message success';
    refs.kitsMensagem.classList.remove('hidden');

    await Promise.all([
      carregarResumoKits(kitsResumoContexto.escopo),
      carregarTudo()
    ]);
  } catch (error) {
    refs.kitsMensagem.textContent = error.message || 'Nao foi possivel registrar a montagem do kit.';
    refs.kitsMensagem.className = 'message error';
    refs.kitsMensagem.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = 'Registrar';
  }
}

function construirRelatorioOperacional(pedidos) {
  const montagemMap = new Map();
  const kitsMap = new Map();
  const itensMap = new Map();
  const reparosMap = new Map();

  pedidos.forEach((pedido) => {
    (pedido.itens || []).forEach((item) => {
      const seriaisVinculados = item.seriais_vinculados?.length || 0;
      const quantidadeMontagem = Math.max(0, Number(item.quantidade_seriais_necessarios || 0) - seriaisVinculados);

      if (item.componente_serial && quantidadeMontagem > 0) {
          acumularRelatorio(
            montagemMap,
            item.componente_serial.id_peca,
            item.componente_serial.codigo,
            item.componente_serial.descricao,
            quantidadeMontagem,
            pedido.cliente_nome || pedido.codigo_pedido
          );
        }

      if (item.exige_separacao_manual && !item.separado_avulso) {
        (item.componentes_avulsos || []).forEach((componente) => {
          const quantidadeSeparar = Number(
            (Number(item.quantidade || 0) * Number(componente.quantidade_por_item_venda || 0)).toFixed(2)
          );

          if (quantidadeSeparar <= 0) {
            return;
          }

          let targetMap = itensMap;
          const codigoComponente = String(componente.codigo || '').trim().toUpperCase();

          if (codigoComponente.startsWith('KT-')) {
            targetMap = kitsMap;
          } else if (isCodigoReparoRelatorio(codigoComponente)) {
            targetMap = reparosMap;
          }

          acumularRelatorio(
            targetMap,
            componente.id_peca,
            componente.codigo,
            componente.descricao,
            quantidadeSeparar,
            pedido.cliente_nome || pedido.codigo_pedido
          );
        });
      }
    });
  });

  return {
    totalPedidos: pedidos.length,
    totalMontagem: somarQuantidadesRelatorio(montagemMap),
    totalKits: somarQuantidadesRelatorio(kitsMap),
    totalItens: somarQuantidadesRelatorio(itensMap),
    totalReparos: somarQuantidadesRelatorio(reparosMap),
    montagem: ordenarRelatorio(montagemMap),
    kits: ordenarRelatorio(kitsMap),
    itens: ordenarRelatorio(itensMap),
    reparos: ordenarRelatorio(reparosMap)
  };
}

function isCodigoReparoRelatorio(codigo) {
  return RELATORIO_REPARO_CODES.has(String(codigo || '').trim().toUpperCase());
}

function acumularRelatorio(targetMap, idPeca, codigo, descricao, quantidade, codigoPedido) {
  const key = Number(idPeca);
  const current = targetMap.get(key) || {
    id_peca: key,
    codigo,
    descricao,
    quantidade: 0,
    pedidos: new Set()
  };

  current.quantidade = Number((current.quantidade + Number(quantidade || 0)).toFixed(2));
  current.pedidos.add(codigoPedido);
  targetMap.set(key, current);
}

function ordenarRelatorio(targetMap) {
  return [...targetMap.values()]
    .map((item) => ({
      ...item,
      pedidos: [...item.pedidos]
    }))
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'));
}

function somarQuantidadesRelatorio(targetMap) {
  return [...targetMap.values()].reduce((total, item) => total + Number(item.quantidade || 0), 0);
}

function renderizarTabelaRelatorio(items, emptyText) {
  if (!items.length) {
    return `<tr><td colspan="4" class="empty-state">${escapeHtml(emptyText)}</td></tr>`;
  }

  return items.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td>${escapeHtml(item.descricao)}</td>
      <td>${formatDecimal(item.quantidade)}</td>
      <td>${escapeHtml(item.pedidos.join(', '))}</td>
    </tr>
  `).join('');
}

function imprimirRelatorioAtual() {
  const titulo = refs.relatorioTitulo.textContent || 'Relatorio operacional';
  const resumo = refs.relatorioResumo.innerText || '';
  const montarHtml = refs.relatorioMontagemTbody.closest('.content-card').outerHTML;
  const kitsHtml = refs.relatorioKitsTbody.closest('.content-card').outerHTML;
  const itensHtml = refs.relatorioItensTbody.closest('.content-card').outerHTML;
  const reparosHtml = refs.relatorioReparosTbody.closest('.content-card').outerHTML;
  const printWindow = window.open('', '_blank', 'width=1200,height=900');

  if (!printWindow) {
    mostrarMensagem('Nao foi possivel abrir a impressao do relatorio.', 'error');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(titulo)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1d2a3a; }
        h1 { margin: 0 0 8px; font-size: 24px; }
        .resumo { margin: 0 0 18px; font-size: 13px; color: #506174; }
        .bloco { margin-bottom: 22px; }
        .bloco h3 { margin: 0 0 10px; font-size: 17px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #cfd9e4; padding: 8px 10px; text-align: left; font-size: 13px; vertical-align: top; }
        th { background: #eef4fa; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(titulo)}</h1>
      <p class="resumo">${escapeHtml(resumo)}</p>
      ${montarHtml}
      ${kitsHtml}
      ${itensHtml}
      ${reparosHtml}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function atualizarProgramacaoHojePedido(pedidoId, programadoHoje) {
  const pedido = pedidosCache.find((item) => item.id === Number(pedidoId));
  if (!pedido) {
    return;
  }

  const atualizado = await fetchJson(`${pedidosApiBaseUrl}/${pedidoId}/programacao-hoje`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      programado_hoje: programadoHoje
    })
  });

  atualizarPedidoCache(atualizado);
  renderizarPedidos();
  atualizarIndicadores();
  if (refs.sectorMenu) {
    refs.sectorMenu.open = false;
  }
  notificarAtualizacaoOperacional(['pedidos-expedicao']);
  mostrarMensagem(
    programadoHoje
      ? `Pedido ${pedido.codigo_pedido} adicionado em Sai hoje.`
      : `Pedido ${pedido.codigo_pedido} removido de Sai hoje.`,
    'success'
  );
}

function handlePedidoDragStart(event) {
  const card = event.target.closest('.pedido-prioridade-card[data-id]');
  if (!card) {
    return;
  }

  if (refs.filtroBusca.value.trim()) {
    event.preventDefault();
    mostrarMensagem('Limpe a busca antes de reorganizar a prioridade dos pedidos.', 'warning');
    return;
  }

  draggedPedidoCard = card;
  card.classList.add('is-dragging');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.dataset.id || '');
  }
}

function handlePedidoDragOver(event) {
  const container = event.currentTarget;
  if (!draggedPedidoCard || !container) {
    return;
  }

  event.preventDefault();
  const lane = draggedPedidoCard.dataset.lane || 'base';
  if ((container.id === 'pedidos-hoje-lista' ? 'hoje' : 'base') !== lane) {
    return;
  }

  const cards = [...container.querySelectorAll('.pedido-prioridade-card[data-id]:not(.is-dragging)')];
  const nextCard = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return event.clientY < rect.top + (rect.height / 2);
  });

  if (!nextCard) {
    container.appendChild(draggedPedidoCard);
    return;
  }

  container.insertBefore(draggedPedidoCard, nextCard);
}

async function handlePedidoDrop(event) {
  const container = event.currentTarget;
  if (!draggedPedidoCard || !container) {
    return;
  }

  event.preventDefault();
  try {
    await persistirNovaOrdemPedidos();
  } catch (error) {
    mostrarMensagem(error.message || 'Nao foi possivel salvar a nova prioridade.', 'error');
    await carregarTudo();
  }
}

function handlePedidoDragEnd() {
  limparEstadoDragPedidos();
}

function fecharMenuPedidos() {
  if (refs.sectorMenu) {
    refs.sectorMenu.open = false;
  }
}

function limparEstadoDragPedidos() {
  document.querySelectorAll('.pedido-prioridade-card.is-dragging').forEach((card) => {
    card.classList.remove('is-dragging');
  });
  draggedPedidoCard = null;
}

async function persistirNovaOrdemPedidos() {
  if (refs.filtroBusca.value.trim()) {
    throw new Error('Limpe a busca antes de reorganizar a prioridade dos pedidos.');
  }

  const idsHoje = [...refs.pedidosHojeLista.querySelectorAll('.pedido-prioridade-card[data-id]')]
    .map((card) => Number(card.dataset.id))
    .filter((value) => Number.isInteger(value));
  const idsBase = [...refs.prioridadeLista.querySelectorAll('.pedido-prioridade-card[data-id]')]
    .map((card) => Number(card.dataset.id))
    .filter((value) => Number.isInteger(value));
  const orderIds = [...idsHoje, ...idsBase];

  if (!orderIds.length) {
    limparEstadoDragPedidos();
    return;
  }

  const atualizados = await fetchJson(`${pedidosApiBaseUrl}/prioridades`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_ids: orderIds })
  });

  pedidosCache = Array.isArray(atualizados) ? atualizados : pedidosCache;
  renderizarPedidos();
  atualizarIndicadores();
  limparEstadoDragPedidos();
  notificarAtualizacaoOperacional(['pedidos-expedicao']);
  mostrarMensagem('Prioridade dos pedidos atualizada com sucesso.', 'success');
}

function abrirModalCriacao() {
  refs.criacaoMensagem.className = 'message hidden';
  refs.criacaoMensagem.textContent = '';
  refs.criacaoForm.reset();
  refs.pedidoId.value = '';
  refs.criacaoTitulo.textContent = 'Novo pedido';
  refs.criacaoSubtitulo.textContent = 'Cadastre o pedido e monte a lista de itens que vai acompanhar a expedicao.';
  refs.criacaoSubmit.textContent = 'Criar pedido';
  refs.data.value = getTodayDateInput();
  refs.possuiNf.value = 'sim';
  refs.itemQuantidade.value = '1';
  pedidoItensDraft = [];
  itemDraftSelecionado = null;
  renderizarResumoItemDraft(null);
  renderizarItensDraft();
  openModal(refs.criacaoModal);
}

function abrirEdicaoPedidoSelecionado() {
  const pedido = obterPedidoSelecionado();
  if (!pedido) {
    return;
  }

  fecharModalDetalhe();

  refs.criacaoMensagem.className = 'message hidden';
  refs.criacaoMensagem.textContent = '';
  refs.criacaoForm.reset();
  refs.pedidoId.value = String(pedido.id);
  refs.criacaoTitulo.textContent = 'Editar pedido';
  refs.criacaoSubtitulo.textContent = 'Atualize os dados do pedido. Itens removidos devolvem vinculos ao estoque e itens novos entram no fluxo normal.';
  refs.criacaoSubmit.textContent = 'Salvar pedido';
  refs.pedidoCodigo.value = pedido.codigo_pedido || '';
  refs.cliente.value = pedido.cliente_nome || '';
  refs.cidade.value = pedido.cidade || '';
  refs.data.value = normalizeDateInput(pedido.data_pedido) || getTodayDateInput();
  refs.vendedora.value = pedido.vendedora || '';
  refs.transportadora.value = pedido.transportadora || '';
  refs.possuiNf.value = pedido.possui_nota_fiscal ? 'sim' : 'nao';
  refs.observacao.value = pedido.observacao || '';
  refs.itemQuantidade.value = '1';
  refs.itemBusca.value = '';
  itemDraftSelecionado = null;
  renderizarResumoItemDraft(null);
  pedidoItensDraft = (pedido.itens || []).map((item) => ({
    id_peca: Number(item.id_peca),
    codigo: item.codigo,
    descricao: item.descricao,
    classificacao: item.classificacao,
    quantidade: Number(item.quantidade || 0),
    exige_numero_serie: Boolean(item.exige_numero_serie)
  }));
  renderizarItensDraft();
  openModal(refs.criacaoModal);
}

function fecharModalCriacao() {
  closeModal(refs.criacaoModal);
}

function handleClienteInput() {
  const valor = normalizarBusca(refs.cliente.value.trim());
  if (!valor) {
    return;
  }

  const cliente = clientesCache.find((item) => normalizarBusca(item.cliente_nome) === valor);
  if (!cliente) {
    return;
  }

  if (!refs.cidade.value.trim()) {
    refs.cidade.value = cliente.cidade || '';
  }

  if (!refs.vendedora.value.trim()) {
    refs.vendedora.value = cliente.vendedora || '';
  }
}

function renderizarSugestoesItemPedido(search) {
  const normalized = normalizarBusca(search);
  const itens = normalized
    ? itensCache.filter((item) => (
      normalizarBusca(item.codigo).includes(normalized)
      || normalizarBusca(item.descricao).includes(normalized)
    )).sort((a, b) => compararPorPrioridadeCodigo(a, b, normalized))
    : itensCache.slice(0, 12);

  if (!itens.length) {
    refs.itemSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma peca encontrada.</div>';
    refs.itemSugestoes.classList.remove('hidden');
    return;
  }

  refs.itemSugestoes.innerHTML = itens.slice(0, 12).map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}">
      <strong>${escapeHtml(item.codigo)}</strong>
      <span>${escapeHtml(`${item.descricao} | ${item.classificacao}`)}</span>
    </button>
  `).join('');
  refs.itemSugestoes.classList.remove('hidden');
}

function compararPorPrioridadeCodigo(a, b, termo) {
  const rankA = obterPrioridadeCodigo(a, termo);
  const rankB = obterPrioridadeCodigo(b, termo);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return String(a?.codigo || '').localeCompare(String(b?.codigo || ''), 'pt-BR', { numeric: true })
    || String(a?.descricao || '').localeCompare(String(b?.descricao || ''), 'pt-BR', { numeric: true });
}

function obterPrioridadeCodigo(item, termo) {
  const busca = normalizarBusca(termo);
  if (!busca) {
    return 0;
  }

  const codigo = normalizarBusca(item?.codigo);
  const descricao = normalizarBusca(item?.descricao);

  if (codigo === busca) return 0;
  if (codigo.startsWith(busca)) return 1;
  if (codigo.includes(busca)) return 2;
  if (descricao.includes(busca)) return 3;
  return 4;
}

function handleSugestaoItemPedidoClick(event) {
  const option = event.target.closest('.autocomplete-option[data-id]');
  if (!option) {
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  itemDraftSelecionado = item;
  refs.itemBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoItemDraft(item);
  esconderSugestoesItemPedido();
}

function renderizarResumoItemDraft(item) {
  if (!item) {
    refs.itemResumo.classList.add('empty');
    refs.itemResumo.innerHTML = 'Selecione uma peca para adicionar ao pedido.';
    return;
  }

  const exigeNumeroSerie = isNumeroSerieModel(item);
  refs.itemResumo.classList.remove('empty');
  refs.itemResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.classificacao)}</span>
    <span class="selected-tag">${exigeNumeroSerie ? 'Exige numero de serie' : 'Item avulso'}</span>
  `;
}

function adicionarItemDraft() {
  if (!itemDraftSelecionado) {
    refs.criacaoMensagem.textContent = 'Selecione uma peca valida antes de adicionar.';
    refs.criacaoMensagem.className = 'message error';
    refs.criacaoMensagem.classList.remove('hidden');
    return;
  }

  const quantidade = Number.parseInt(refs.itemQuantidade.value, 10);
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    refs.criacaoMensagem.textContent = 'Informe uma quantidade valida para o item.';
    refs.criacaoMensagem.className = 'message error';
    refs.criacaoMensagem.classList.remove('hidden');
    return;
  }

  const existente = pedidoItensDraft.find((item) => Number(item.id_peca) === Number(itemDraftSelecionado.id));
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    pedidoItensDraft.push({
      id_peca: Number(itemDraftSelecionado.id),
      codigo: itemDraftSelecionado.codigo,
      descricao: itemDraftSelecionado.descricao,
      classificacao: itemDraftSelecionado.classificacao,
      quantidade,
      exige_numero_serie: isNumeroSerieModel(itemDraftSelecionado)
    });
  }

  refs.criacaoMensagem.className = 'message hidden';
  refs.criacaoMensagem.textContent = '';
  refs.itemBusca.value = '';
  refs.itemQuantidade.value = '1';
  itemDraftSelecionado = null;
  renderizarResumoItemDraft(null);
  renderizarItensDraft();
}

function handleItensDraftActions(event) {
  const button = event.target.closest('button[data-index]');
  if (!button) {
    return;
  }

  pedidoItensDraft.splice(Number(button.dataset.index), 1);
  renderizarItensDraft();
}

function renderizarItensDraft() {
  refs.itensTotal.textContent = `${pedidoItensDraft.length} item(ns)`;

  if (!pedidoItensDraft.length) {
    refs.itensTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum item adicionado ao pedido.</td></tr>';
    return;
  }

  refs.itensTbody.innerHTML = pedidoItensDraft.map((item, index) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td>${escapeHtml(item.descricao)}</td>
      <td>${formatInteger(item.quantidade)}</td>
      <td>${item.exige_numero_serie ? 'Numero de serie' : 'Avulso'}</td>
      <td><button class="btn btn-neutral btn-small" type="button" data-index="${index}">Remover</button></td>
    </tr>
  `).join('');
}

async function handleCriarPedido(event) {
  event.preventDefault();

  try {
    const pedidoId = Number.parseInt(refs.pedidoId.value, 10);
    const payload = {
      codigo_pedido: refs.pedidoCodigo.value.trim(),
      cliente_nome: refs.cliente.value.trim(),
      cidade: refs.cidade.value.trim(),
      data_pedido: refs.data.value,
      observacao: refs.observacao.value.trim(),
      possui_nota_fiscal: refs.possuiNf.value === 'sim',
      transportadora: refs.transportadora.value.trim(),
      vendedora: refs.vendedora.value.trim(),
      itens: pedidoItensDraft.map((item) => ({
        id_peca: item.id_peca,
        quantidade: item.quantidade
      }))
    };

    await fetchJson(Number.isInteger(pedidoId) ? `${pedidosApiBaseUrl}/${pedidoId}` : pedidosApiBaseUrl, {
      method: Number.isInteger(pedidoId) ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    fecharModalCriacao();
    notificarAtualizacaoOperacional(['pedidos-expedicao']);
    mostrarMensagem(Number.isInteger(pedidoId) ? 'Pedido atualizado com sucesso.' : 'Pedido criado com sucesso.', 'success');
    await carregarTudo();
    if (Number.isInteger(pedidoId)) {
      await abrirDetalhePedido(pedidoId);
    }
  } catch (error) {
    refs.criacaoMensagem.textContent = error.message || 'Nao foi possivel criar o pedido.';
    refs.criacaoMensagem.className = 'message error';
    refs.criacaoMensagem.classList.remove('hidden');
  }
}

async function abrirDetalhePedido(pedidoId) {
  const pedido = await fetchJson(`${pedidosApiBaseUrl}/${pedidoId}`);
  atualizarPedidoCache(pedido);
  pedidoSelecionadoId = pedido.id;

  refs.detalheMensagem.className = 'message hidden';
  refs.detalheMensagem.textContent = '';
  refs.detalheTitulo.textContent = `${pedido.codigo_pedido} - ${pedido.cliente_nome}`;
  refs.detalheSubtitulo.textContent = `${pedido.cidade || '-'} | ${pedido.transportadora || '-'} | ${formatarDataCurta(pedido.data_pedido)}`;
  if (String(pedido.observacao || '').trim()) {
    refs.detalheObservacao.textContent = `Observacao: ${pedido.observacao}`;
    refs.detalheObservacao.style.color = '#b42318';
    refs.detalheObservacao.style.fontWeight = '800';
    refs.detalheObservacao.style.background = 'rgba(255, 232, 232, 0.92)';
    refs.detalheObservacao.style.display = 'inline-block';
    refs.detalheObservacao.style.padding = '6px 10px';
    refs.detalheObservacao.style.borderRadius = '10px';
    refs.detalheObservacao.style.marginTop = '8px';
    refs.detalheObservacao.classList.remove('hidden');
  } else {
    refs.detalheObservacao.textContent = '';
    refs.detalheObservacao.removeAttribute('style');
    refs.detalheObservacao.classList.add('hidden');
  }
  refs.detalheNf.value = pedido.numero_nota_fiscal || '';
  refs.detalhePesoTotal.value = formatDecimalInput(
    pedido.peso_total_override_kg ?? pedido.massa_total_calculada_kg ?? pedido.massa_total_kg ?? 0,
    3
  );
  refs.detalheVolumes.value = pedido.quantidade_volumes ?? '';
  refs.detalheNf.disabled = !pedido.possui_nota_fiscal || pedido.status === 'PEDIDO COLETADO';
  refs.detalhePesoTotal.disabled = pedido.status === 'PEDIDO COLETADO';
  refs.detalheVolumes.disabled = pedido.status === 'PEDIDO COLETADO';
  refs.detalheSalvarDadosFinais.disabled = pedido.status === 'PEDIDO COLETADO';
  refs.detalheMarcarColetado.disabled = pedido.status === 'PEDIDO COLETADO';
  refs.detalheEditar.disabled = pedido.status === 'PEDIDO COLETADO';
  refs.detalheExcluir.disabled = pedido.status === 'PEDIDO COLETADO';

  refs.detalheResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(pedido.status)}</span>
    <span class="selected-tag">Itens: ${formatInteger(pedido.itens_concluidos || 0)}/${formatInteger(pedido.total_itens || 0)}</span>
    <span class="selected-tag">Massa total: ${formatDecimal(pedido.massa_total_kg || 0)} kg</span>
    <span class="selected-tag">${pedido.possui_nota_fiscal ? 'Com NF' : 'Sem NF'}</span>
    <span class="selected-tag">Seriais vinculados: ${formatInteger(contarSeriaisPedido(pedido))}</span>
  `;

  renderizarItensPedidoDetalhe(pedido);
  openModal(refs.detalheModal);
  inicializarJsPrintManager().catch((error) => {
    console.error('Falha ao preparar JSPrintManager ao abrir pedido:', error);
  });
}

function fecharModalDetalhe() {
  closeModal(refs.detalheModal);
}

function renderizarItensPedidoDetalhe(pedido) {
  if (!pedido.itens.length) {
    refs.detalheItensTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum item no pedido.</td></tr>';
    return;
  }

  refs.detalheItensTbody.innerHTML = pedido.itens.map((item) => {
    const vinculos = item.seriais_vinculados || [];
    const diagnostico = item.diagnostico || {};
    const detalhesSeriais = item.exige_numero_serie
      ? `
        <div class="pedido-item-serial-list">
          ${vinculos.length
            ? vinculos.map((serial) => `
              <span class="selected-tag">
                ${escapeHtml(serial.numero_serie)}
              </span>
            `).join('')
            : '<span class="selected-tag">Nenhum numero vinculado</span>'}
        </div>
      `
      : '';

    const botoes = [];
    if (item.exige_numero_serie) {
      botoes.push(`
        <button
          class="btn btn-neutral btn-small"
          type="button"
          data-action="abrir-seriais"
          data-item-id="${item.id}"
          ${pedido.status === 'PEDIDO COLETADO' ? 'disabled' : ''}
        >
          Vincular servo
        </button>
      `);
    }

    if (item.exige_separacao_manual) {
      botoes.push(`
        <label class="pedido-item-checkbox">
          <input
            type="checkbox"
            data-action="toggle-avulso"
            data-item-id="${item.id}"
            ${item.separado_avulso ? 'checked' : ''}
            ${pedido.status === 'PEDIDO COLETADO' ? 'disabled' : ''}
          >
          <span>OK</span>
        </label>
      `);
    }

    return `
      <tr class="${item.concluido ? 'pedido-item-row-complete' : ''}">
        <td class="table-code">${renderizarCodigoKitImagem(item.codigo)}</td>
        <td>
          <div class="pedido-item-cell">
            <strong>${escapeHtml(item.descricao)}</strong>
            ${detalhesSeriais}
          </div>
        </td>
        <td>${formatInteger(item.quantidade)}</td>
        <td>${formatDecimal(item.massa_total_kg || 0)} kg</td>
        <td>
          <div class="pedido-prioridade-actions">
            <button class="icon-btn pedido-print-btn" type="button" title="Imprimir item" aria-label="Imprimir item" data-action="imprimir-item" data-item-id="${item.id}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7 8V4h10v4"></path>
                <rect x="6" y="14" width="12" height="6" rx="1"></rect>
                <path d="M6 10H5a2 2 0 0 0-2 2v4h3"></path>
                <path d="M18 16h3v-4a2 2 0 0 0-2-2h-1"></path>
                <path d="M8 12h8"></path>
                <circle cx="17.5" cy="11.5" r=".5" fill="currentColor" stroke="none"></circle>
              </svg>
            </button>
            ${botoes.join('')}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleDetalheItemActions(event) {
  const serialButton = event.target.closest('[data-action="abrir-seriais"][data-item-id]');
  if (serialButton) {
    await abrirModalSeriaisPedido(Number(serialButton.dataset.itemId));
    return;
  }

  const printButton = event.target.closest('[data-action="imprimir-item"][data-item-id]');
  if (printButton) {
    await abrirFluxoImpressaoItem(Number(printButton.dataset.itemId), printButton);
    return;
  }

}

async function handleDetalheItemChanges(event) {
  const toggle = event.target.closest('[data-action="toggle-avulso"][data-item-id]');
  if (!toggle) {
    return;
  }

  try {
    const pedido = await fetchJson(`${pedidosApiBaseUrl}/itens/${toggle.dataset.itemId}/separado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        separado: toggle.checked
      })
    });

    atualizarPedidoCache(pedido);
    renderizarItensPedidoDetalhe(pedido);
    atualizarIndicadores();
    renderizarPedidos();
    notificarAtualizacaoOperacional(['pedidos-expedicao', 'estoque']);
    refs.detalheResumo.innerHTML = `
      <span class="selected-tag">${escapeHtml(pedido.status)}</span>
      <span class="selected-tag">Itens: ${formatInteger(pedido.itens_concluidos || 0)}/${formatInteger(pedido.total_itens || 0)}</span>
      <span class="selected-tag">Massa total: ${formatDecimal(pedido.massa_total_kg || 0)} kg</span>
      <span class="selected-tag">${pedido.possui_nota_fiscal ? 'Com NF' : 'Sem NF'}</span>
      <span class="selected-tag">Seriais vinculados: ${formatInteger(contarSeriaisPedido(pedido))}</span>
    `;
  } catch (error) {
    mostrarMensagemDetalhe(error.message, 'error');
    toggle.checked = !toggle.checked;
  }
}

async function abrirModalSeriaisPedido(itemId) {
  const result = await fetchJson(`${pedidosApiBaseUrl}/itens/${itemId}/seriais`);
  pedidoItemSerialSelecionadoId = itemId;
  serialDisponiveisContexto = result;

  refs.seriaisMensagem.className = 'message hidden';
  refs.seriaisMensagem.textContent = '';
  refs.seriaisTitulo.textContent = `${result.item.codigo} - vincular servo`;
  refs.seriaisSubtitulo.textContent = `Modelo serial: ${formatarCodigoVisual(result.item.modelo_serial_codigo)} | Necessario: ${formatInteger(result.item.quantidade_seriais_necessarios || result.item.quantidade)} | Vinculados: ${formatInteger(result.vinculados.length)}`;
  refs.seriaisResumo.innerHTML = `
    <span class="selected-tag">Pedido: ${escapeHtml((obterPedidoSelecionado() || {}).codigo_pedido || '-')}</span>
    <span class="selected-tag">Item: ${escapeHtml(result.item.codigo)}</span>
    <span class="selected-tag">Serial: ${escapeHtml(formatarCodigoVisual(result.item.modelo_serial_codigo || '-'))}</span>
    <span class="selected-tag">Disponiveis: ${formatInteger(result.disponiveis.length)}</span>
  `;
  if (refs.seriaisAutoSelecionar) {
    refs.seriaisAutoSelecionar.disabled = !result.disponiveis.length;
  }

  refs.seriaisVinculados.classList.remove('empty');
  refs.seriaisVinculados.innerHTML = result.vinculados.length
    ? result.vinculados.map((serial) => `
      <span class="selected-tag">
        ${escapeHtml(serial.numero_serie)}
        ${serial.data_saida
          ? '<span class="tag-inline-label">Coletado</span>'
          : `<button type="button" class="tag-inline-action is-neutral" data-action="desvincular-serial-modal" data-binding-id="${serial.id}">Remover</button>`}
      </span>
    `).join('')
    : 'Nenhum servo vinculado ainda.';

  if (!result.vinculados.length) {
    refs.seriaisVinculados.classList.add('empty');
  }

  if (!result.disponiveis.length) {
    refs.seriaisTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum numero de serie disponivel para este modelo.</td></tr>';
  } else {
    refs.seriaisTbody.innerHTML = result.disponiveis.map((serial) => `
      <tr class="pedido-serial-row" data-serial-row="${serial.id}">
        <td><input type="checkbox" class="pedido-serial-checkbox" value="${serial.id}"></td>
        <td class="table-code">${escapeHtml(serial.numero_serie)}</td>
        <td>${escapeHtml(`${serial.modelo_servo_codigo} - ${serial.modelo_servo_descricao}`)}</td>
        <td>${formatDate(serial.data_montagem)}</td>
      </tr>
    `).join('');
  }

  openModal(refs.seriaisModal);
}

function fecharModalSeriais() {
  closeModal(refs.seriaisModal);
}

function handleSeriaisModalClick(event) {
  const row = event.target.closest('tr[data-serial-row]');
  if (!row || event.target.closest('input, button, a, label')) {
    return;
  }

  const checkbox = row.querySelector('.pedido-serial-checkbox');
  if (!checkbox) {
    return;
  }

  checkbox.checked = !checkbox.checked;
  atualizarEstadoLinhaSerial(row, checkbox.checked);
}

function handleSeriaisModalChange(event) {
  const checkbox = event.target.closest('.pedido-serial-checkbox');
  if (!checkbox) {
    return;
  }

  const row = checkbox.closest('tr[data-serial-row]');
  if (row) {
    atualizarEstadoLinhaSerial(row, checkbox.checked);
  }
}

function atualizarEstadoLinhaSerial(row, checked) {
  row.classList.toggle('is-selected', Boolean(checked));
}

function selecionarAutomaticamenteSeriais() {
  if (!serialDisponiveisContexto?.item) {
    return;
  }

  const quantidadeNecessaria = Number(serialDisponiveisContexto.item.quantidade_seriais_necessarios || serialDisponiveisContexto.item.quantidade || 0);
  const quantidadeJaVinculada = Array.isArray(serialDisponiveisContexto.vinculados) ? serialDisponiveisContexto.vinculados.length : 0;
  const quantidadeFaltante = Math.max(0, quantidadeNecessaria - quantidadeJaVinculada);

  if (!quantidadeFaltante) {
    refs.seriaisMensagem.textContent = 'Este item ja tem todos os numeros de serie necessarios vinculados.';
    refs.seriaisMensagem.className = 'message info';
    refs.seriaisMensagem.classList.remove('hidden');
    return;
  }

  const checkboxes = [...refs.seriaisTbody.querySelectorAll('.pedido-serial-checkbox')];
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
    const row = checkbox.closest('tr[data-serial-row]');
    if (row) {
      atualizarEstadoLinhaSerial(row, false);
    }
  });

  const selecionados = checkboxes.slice(0, quantidadeFaltante);
  selecionados.forEach((checkbox) => {
    checkbox.checked = true;
    const row = checkbox.closest('tr[data-serial-row]');
    if (row) {
      atualizarEstadoLinhaSerial(row, true);
    }
  });

  if (!selecionados.length) {
    refs.seriaisMensagem.textContent = 'Nao ha numeros de serie disponiveis para selecionar automaticamente.';
    refs.seriaisMensagem.className = 'message error';
    refs.seriaisMensagem.classList.remove('hidden');
    return;
  }

  const mensagem = selecionados.length < quantidadeFaltante
    ? `Foram selecionados ${formatInteger(selecionados.length)} numero(s) de serie automaticamente, mas ainda faltam ${formatInteger(quantidadeFaltante - selecionados.length)}.`
    : `Selecionados automaticamente ${formatInteger(selecionados.length)} numero(s) de serie.`;

  refs.seriaisMensagem.textContent = mensagem;
  refs.seriaisMensagem.className = selecionados.length < quantidadeFaltante ? 'message warning' : 'message success';
  refs.seriaisMensagem.classList.remove('hidden');
}

async function handleSeriaisVinculadosActions(event) {
  const button = event.target.closest('[data-action="desvincular-serial-modal"][data-binding-id]');
  if (!button) {
    return;
  }

  await desvincularSerialPedido(Number(button.dataset.bindingId), { keepSerialModalOpen: true });
}

async function vincularSeriaisSelecionados() {
  if (!pedidoItemSerialSelecionadoId) {
    return;
  }

  const selecionados = [...refs.seriaisTbody.querySelectorAll('.pedido-serial-checkbox:checked')]
    .map((input) => Number(input.value));

  if (!selecionados.length) {
    refs.seriaisMensagem.textContent = 'Selecione ao menos um numero de serie.';
    refs.seriaisMensagem.className = 'message error';
    refs.seriaisMensagem.classList.remove('hidden');
    return;
  }

  try {
    const pedido = await fetchJson(`${pedidosApiBaseUrl}/itens/${pedidoItemSerialSelecionadoId}/seriais`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serial_ids: selecionados
      })
    });

    atualizarPedidoCache(pedido);
    fecharModalSeriais();
    renderizarPedidos();
    atualizarIndicadores();
    notificarAtualizacaoOperacional(['pedidos-expedicao', 'submontagem-seriais', 'estoque']);

    if (pedidoSelecionadoId === pedido.id) {
      renderizarItensPedidoDetalhe(pedido);
      refs.detalheResumo.innerHTML = `
        <span class="selected-tag">${escapeHtml(pedido.status)}</span>
        <span class="selected-tag">Itens: ${formatInteger(pedido.itens_concluidos || 0)}/${formatInteger(pedido.total_itens || 0)}</span>
        <span class="selected-tag">Massa total: ${formatDecimal(pedido.massa_total_kg || 0)} kg</span>
        <span class="selected-tag">${pedido.possui_nota_fiscal ? 'Com NF' : 'Sem NF'}</span>
        <span class="selected-tag">Seriais vinculados: ${formatInteger(contarSeriaisPedido(pedido))}</span>
      `;
    }
  } catch (error) {
    refs.seriaisMensagem.textContent = error.message || 'Nao foi possivel vincular os numeros de serie.';
    refs.seriaisMensagem.className = 'message error';
    refs.seriaisMensagem.classList.remove('hidden');
  }
}

async function desvincularSerialPedido(bindingId, options = {}) {
  try {
    const pedido = await fetchJson(`${pedidosApiBaseUrl}/seriais/${bindingId}`, {
      method: 'DELETE'
    });

    atualizarPedidoCache(pedido);
    renderizarPedidos();
    atualizarIndicadores();
    notificarAtualizacaoOperacional(['pedidos-expedicao', 'submontagem-seriais', 'estoque']);

    if (pedidoSelecionadoId === pedido.id) {
      renderizarItensPedidoDetalhe(pedido);
      refs.detalheResumo.innerHTML = `
        <span class="selected-tag">${escapeHtml(pedido.status)}</span>
        <span class="selected-tag">Itens: ${formatInteger(pedido.itens_concluidos || 0)}/${formatInteger(pedido.total_itens || 0)}</span>
        <span class="selected-tag">Massa total: ${formatDecimal(pedido.massa_total_kg || 0)} kg</span>
        <span class="selected-tag">${pedido.possui_nota_fiscal ? 'Com NF' : 'Sem NF'}</span>
        <span class="selected-tag">Seriais vinculados: ${formatInteger(contarSeriaisPedido(pedido))}</span>
      `;
    }

    if (options.keepSerialModalOpen && pedidoItemSerialSelecionadoId) {
      await abrirModalSeriaisPedido(pedidoItemSerialSelecionadoId);
    }
  } catch (error) {
    if (options.keepSerialModalOpen) {
      refs.seriaisMensagem.textContent = error.message || 'Nao foi possivel remover o servo vinculado.';
      refs.seriaisMensagem.className = 'message error';
      refs.seriaisMensagem.classList.remove('hidden');
      return;
    }

    mostrarMensagemDetalhe(error.message, 'error');
  }
}

async function salvarDadosFinaisPedido() {
  const pedido = obterPedidoSelecionado();
  if (!pedido) {
    return;
  }

  try {
    const atualizado = await fetchJson(`${pedidosApiBaseUrl}/${pedido.id}/dados-finais`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero_nota_fiscal: refs.detalheNf.disabled ? undefined : refs.detalheNf.value.trim(),
        peso_total_override_kg: refs.detalhePesoTotal.value,
        quantidade_volumes: refs.detalheVolumes.value
      })
    });

    atualizarPedidoCache(atualizado);
    renderizarPedidos();
    atualizarIndicadores();
    notificarAtualizacaoOperacional(['pedidos-expedicao']);
    mostrarMensagemDetalhe('Dados finais do pedido salvos com sucesso.', 'success');
    await abrirDetalhePedido(atualizado.id);
  } catch (error) {
    mostrarMensagemDetalhe(error.message, 'error');
  }
}

function abrirConfirmacaoColetaPedido() {
  refs.coletaConfirmMensagem.className = 'message hidden';
  refs.coletaConfirmMensagem.textContent = '';
  refs.coletaConfirmCheckbox.checked = false;
  refs.coletaConfirmar.disabled = true;
  openModal(refs.coletaConfirmModal);
}

function fecharConfirmacaoColetaPedido() {
  closeModal(refs.coletaConfirmModal);
}

async function marcarPedidoColetado() {
  const pedido = obterPedidoSelecionado();
  if (!pedido) {
    return;
  }

  if (!refs.coletaConfirmCheckbox.checked) {
    refs.coletaConfirmMensagem.textContent = 'Confirme a leitura antes de finalizar a coleta.';
    refs.coletaConfirmMensagem.className = 'message error';
    refs.coletaConfirmMensagem.classList.remove('hidden');
    return;
  }

  try {
    await fetchJson(`${pedidosApiBaseUrl}/${pedido.id}/dados-finais`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero_nota_fiscal: refs.detalheNf.disabled ? undefined : refs.detalheNf.value.trim(),
        peso_total_override_kg: refs.detalhePesoTotal.value,
        quantidade_volumes: refs.detalheVolumes.value
      })
    });

    const atualizado = await fetchJson(`${pedidosApiBaseUrl}/${pedido.id}/coletar`, {
      method: 'POST'
    });

    atualizarPedidoCache(atualizado);
    renderizarPedidos();
    atualizarIndicadores();
    notificarAtualizacaoOperacional(['pedidos-expedicao', 'submontagem-seriais', 'estoque']);
    mostrarMensagem('Pedido coletado com sucesso.', 'success');
    fecharConfirmacaoColetaPedido();
    await abrirDetalhePedido(atualizado.id);
  } catch (error) {
    refs.coletaConfirmMensagem.textContent = error.message || 'Nao foi possivel finalizar a coleta do pedido.';
    refs.coletaConfirmMensagem.className = 'message error';
    refs.coletaConfirmMensagem.classList.remove('hidden');
  }
}

async function excluirPedidoSelecionado() {
  const pedido = obterPedidoSelecionado();
  if (!pedido) {
    return;
  }

  const confirmado = window.confirm(`Excluir o pedido ${pedido.codigo_pedido}? Tudo que estiver vinculado volta para o estoque.`);
  if (!confirmado) {
    return;
  }

  try {
    await fetchJson(`${pedidosApiBaseUrl}/${pedido.id}`, {
      method: 'DELETE'
    });

    pedidosCache = pedidosCache.filter((entry) => Number(entry.id) !== Number(pedido.id));
    fecharModalDetalhe();
    renderizarPedidos();
    atualizarIndicadores();
    notificarAtualizacaoOperacional(['pedidos-expedicao', 'submontagem-seriais', 'estoque']);
    mostrarMensagem('Pedido excluido com sucesso.', 'success');
  } catch (error) {
    mostrarMensagemDetalhe(error.message || 'Nao foi possivel excluir o pedido.', 'error');
  }
}

async function imprimirEtiquetasItem(itemId, triggerButton = null, options = {}) {
  const button = triggerButton || refs.detalheItensTbody.querySelector(`[data-action="imprimir-item"][data-item-id="${itemId}"]`);
  if (button) {
    button.classList.add('is-printing');
    button.setAttribute('aria-busy', 'true');
  }

  try {
    const job = await fetchJson(`${pedidosApiBaseUrl}/itens/${itemId}/etiquetas-impressao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        binding_ids: Array.isArray(options.bindingIds) ? options.bindingIds : undefined
      })
    });

    const zplAgrupado = agruparZplLabels(job.labels || []);
    if (!zplAgrupado) {
      throw new Error('Nenhuma etiqueta foi gerada para este item.');
    }

    const impressoraNome = await enviarZplParaImpressoraPadrao(zplAgrupado);
    await registrarHistoricoImpressao(
      (job.labels || []).map((label) => label.history).filter(Boolean),
      impressoraNome
    );

    mostrarMensagemDetalhe(
      `${formatInteger(job.quantidade_etiquetas || 0)} etiqueta(s) do item ${job.codigo_item} enviada(s) para ${impressoraNome.toLowerCase()}.`,
      'success'
    );
    if (refs.impressaoSeriaisModal && !refs.impressaoSeriaisModal.classList.contains('hidden')) {
      refs.impressaoSeriaisMensagem.className = 'message hidden';
      refs.impressaoSeriaisMensagem.textContent = '';
    }
  } catch (error) {
    const mensagem = error.message || 'Nao foi possivel imprimir a etiqueta do item.';
    mostrarMensagemDetalhe(mensagem, 'error');
    if (refs.impressaoSeriaisModal && !refs.impressaoSeriaisModal.classList.contains('hidden')) {
      refs.impressaoSeriaisMensagem.textContent = mensagem;
      refs.impressaoSeriaisMensagem.className = 'message error';
      refs.impressaoSeriaisMensagem.classList.remove('hidden');
    }
  } finally {
    if (button) {
      button.classList.remove('is-printing');
      button.removeAttribute('aria-busy');
    }
  }
}

async function abrirFluxoImpressaoItem(itemId, triggerButton = null) {
  const pedido = obterPedidoSelecionado();
  const item = (pedido?.itens || []).find((entry) => Number(entry.id) === Number(itemId));
  if (!item) {
    mostrarMensagemDetalhe('Nao foi possivel localizar o item selecionado para impressao.', 'error');
    return;
  }

  if (!item.exige_numero_serie) {
    await imprimirEtiquetasItem(itemId, triggerButton);
    return;
  }

  abrirModalImpressaoSeriais(item);
}

function abrirModalImpressaoSeriais(item) {
  const vinculos = Array.isArray(item?.seriais_vinculados) ? item.seriais_vinculados : [];
  if (!vinculos.length) {
    mostrarMensagemDetalhe('Vincule ao menos um numero de serie antes de imprimir a etiqueta deste item.', 'error');
    return;
  }

  impressaoSeriaisContexto = {
    itemId: Number(item.id),
    itemCodigo: item.codigo,
    itemDescricao: item.descricao,
    vinculos
  };

  refs.impressaoSeriaisMensagem.className = 'message hidden';
  refs.impressaoSeriaisMensagem.textContent = '';
  refs.impressaoSeriaisTitulo.textContent = `${item.codigo} - escolher seriais para imprimir`;
  refs.impressaoSeriaisSubtitulo.textContent = 'Todos os numeros ja vem selecionados. Desmarque apenas o que nao quiser imprimir agora.';
  refs.impressaoSeriaisResumo.innerHTML = `
    <span class="selected-tag">Item: ${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">Descricao: ${escapeHtml(item.descricao || '-')}</span>
    <span class="selected-tag">Vinculados: ${formatInteger(vinculos.length)}</span>
  `;

  refs.impressaoSeriaisTbody.innerHTML = vinculos.map((serial) => `
    <tr class="pedido-serial-row is-selected" data-print-serial-row="${serial.id}">
      <td><input type="checkbox" class="pedido-print-serial-checkbox" value="${serial.id}" checked></td>
      <td class="table-code">${escapeHtml(serial.numero_serie)}</td>
      <td>${escapeHtml(`${serial.modelo_servo_codigo || ''} - ${serial.modelo_servo_descricao || ''}`.replace(/^ - /, ''))}</td>
      <td>${formatDate(serial.data_montagem)}</td>
    </tr>
  `).join('');

  openModal(refs.impressaoSeriaisModal);
}

function fecharModalImpressaoSeriais() {
  impressaoSeriaisContexto = null;
  refs.impressaoSeriaisMensagem.className = 'message hidden';
  refs.impressaoSeriaisMensagem.textContent = '';
  closeModal(refs.impressaoSeriaisModal);
}

function handleImpressaoSeriaisModalClick(event) {
  const row = event.target.closest('tr[data-print-serial-row]');
  if (!row || event.target.closest('input, button, a, label')) {
    return;
  }

  const checkbox = row.querySelector('.pedido-print-serial-checkbox');
  if (!checkbox) {
    return;
  }

  checkbox.checked = !checkbox.checked;
  atualizarEstadoLinhaSerial(row, checkbox.checked);
}

function handleImpressaoSeriaisModalChange(event) {
  const checkbox = event.target.closest('.pedido-print-serial-checkbox');
  if (!checkbox) {
    return;
  }

  const row = checkbox.closest('tr[data-print-serial-row]');
  if (row) {
    atualizarEstadoLinhaSerial(row, checkbox.checked);
  }
}

function marcarTodosSeriaisImpressao(marcar) {
  [...refs.impressaoSeriaisTbody.querySelectorAll('.pedido-print-serial-checkbox')].forEach((checkbox) => {
    checkbox.checked = Boolean(marcar);
    const row = checkbox.closest('tr[data-print-serial-row]');
    if (row) {
      atualizarEstadoLinhaSerial(row, checkbox.checked);
    }
  });
}

async function confirmarImpressaoSeriaisSelecionados() {
  if (!impressaoSeriaisContexto?.itemId) {
    return;
  }

  const selecionados = [...refs.impressaoSeriaisTbody.querySelectorAll('.pedido-print-serial-checkbox:checked')]
    .map((input) => Number(input.value))
    .filter((value) => Number.isInteger(value));

  if (!selecionados.length) {
    refs.impressaoSeriaisMensagem.textContent = 'Selecione ao menos um numero de serie para imprimir.';
    refs.impressaoSeriaisMensagem.className = 'message error';
    refs.impressaoSeriaisMensagem.classList.remove('hidden');
    return;
  }

  const triggerButton = refs.detalheItensTbody.querySelector(`[data-action="imprimir-item"][data-item-id="${impressaoSeriaisContexto.itemId}"]`);
  await imprimirEtiquetasItem(impressaoSeriaisContexto.itemId, triggerButton, { bindingIds: selecionados });

  if (!refs.impressaoSeriaisMensagem.classList.contains('error')) {
    fecharModalImpressaoSeriais();
  }
}

async function imprimirEtiquetasCaixaPedidoSelecionado() {
  const pedido = obterPedidoSelecionado();
  if (!pedido) {
    return;
  }

  refs.detalheImprimirCaixas.classList.add('is-printing');
  refs.detalheImprimirCaixas.setAttribute('aria-busy', 'true');

  try {
    const pedidoComDadosFinais = await fetchJson(`${pedidosApiBaseUrl}/${pedido.id}/dados-finais`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero_nota_fiscal: refs.detalheNf.disabled ? undefined : refs.detalheNf.value.trim(),
        peso_total_override_kg: refs.detalhePesoTotal.value,
        quantidade_volumes: refs.detalheVolumes.value
      })
    });
    atualizarPedidoCache(pedidoComDadosFinais);

    const job = await fetchJson(`${pedidosApiBaseUrl}/${pedido.id}/caixas-impressao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const zplAgrupado = agruparZplLabels(job.labels || []);
    if (!zplAgrupado) {
      throw new Error('Nenhuma etiqueta de caixa foi gerada para este pedido.');
    }

    const impressoraNome = await enviarZplParaImpressoraPadrao(zplAgrupado);
    await registrarHistoricoImpressao(
      (job.labels || []).map((label) => label.history).filter(Boolean),
      impressoraNome
    );

    mostrarMensagemDetalhe(
      `${formatInteger(job.quantidade_etiquetas || 0)} etiqueta(s) de caixa enviada(s) para ${impressoraNome.toLowerCase()}.`,
      'success'
    );
  } catch (error) {
    mostrarMensagemDetalhe(error.message || 'Nao foi possivel imprimir as etiquetas da caixa.', 'error');
  } finally {
    refs.detalheImprimirCaixas.classList.remove('is-printing');
    refs.detalheImprimirCaixas.removeAttribute('aria-busy');
  }
}

function abrirModalFaltasPedido(pedidoId) {
  const pedido = pedidosCache.find((entry) => entry.id === Number(pedidoId));
  if (!pedido) {
    return;
  }

  refs.faltasTitulo.textContent = `Faltam no ${pedido.codigo_pedido}`;
  refs.faltasSubtitulo.textContent = `${pedido.cliente_nome} | ${pedido.cidade || '-'} | ${pedido.status}`;

  if (!pedido.faltantes || !pedido.faltantes.length) {
    refs.faltasTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma falta encontrada para este pedido agora.</td></tr>';
  } else {
    refs.faltasTbody.innerHTML = pedido.faltantes.map((item) => `
      <tr>
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td>${escapeHtml(item.descricao)}</td>
        <td>${escapeHtml(item.tipo === 'NUMERO_SERIE' ? 'Numero de serie' : 'Avulso')}</td>
        <td>${formatInteger(item.quantidade_disponivel || 0)}</td>
        <td>${formatInteger(item.quantidade_faltante || 0)}</td>
        <td>${escapeHtml(item.mensagem || '-')}</td>
      </tr>
    `).join('');
  }

  openModal(refs.faltasModal);
}

function fecharModalFaltas() {
  closeModal(refs.faltasModal);
}

function abrirModalKitImagem(codigo, imageUrl) {
  refs.kitImagemTitulo.textContent = `${codigo} - imagem do kit`;
  refs.kitImagemSubtitulo.textContent = 'Referencia visual do codigo selecionado.';
  refs.kitImagemPreview.src = imageUrl;
  refs.kitImagemPreview.alt = `Imagem do kit ${codigo}`;
  openModal(refs.kitImagemModal);
}

function fecharModalKitImagem() {
  refs.kitImagemPreview.src = '';
  refs.kitImagemPreview.alt = 'Imagem do kit';
  closeModal(refs.kitImagemModal);
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemDetalhe(texto, tipo) {
  refs.detalheMensagem.textContent = texto;
  refs.detalheMensagem.className = `message ${tipo}`;
  refs.detalheMensagem.classList.remove('hidden');
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');

  const algumModalAberto = [
    refs.criacaoModal,
    refs.detalheModal,
    refs.seriaisModal,
    refs.impressaoSeriaisModal,
    refs.faltasModal,
    refs.historicoModal,
    refs.relatorioModal,
    refs.kitsModal,
    refs.kitImagemModal,
    refs.coletaConfirmModal
  ].some((item) => !item.classList.contains('hidden'));

  document.body.classList.toggle('has-modal', algumModalAberto);
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'pedido-criacao') fecharModalCriacao();
  if (event.target.dataset.closeModal === 'pedido-detalhe') fecharModalDetalhe();
  if (event.target.dataset.closeModal === 'pedido-seriais') fecharModalSeriais();
  if (event.target.dataset.closeModal === 'pedido-impressao-seriais') fecharModalImpressaoSeriais();
  if (event.target.dataset.closeModal === 'pedido-faltas') fecharModalFaltas();
  if (event.target.dataset.closeModal === 'pedido-historico') fecharModalHistoricoPedidos();
  if (event.target.dataset.closeModal === 'pedido-relatorio') fecharModalRelatorio();
  if (event.target.dataset.closeModal === 'pedido-kits') fecharModalKits();
  if (event.target.dataset.closeModal === 'pedido-kit-imagem') fecharModalKitImagem();
  if (event.target.dataset.closeModal === 'pedido-coleta-confirm') fecharConfirmacaoColetaPedido();
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  esconderSugestoesItemPedido();

  if (!refs.seriaisModal.classList.contains('hidden')) {
    fecharModalSeriais();
    return;
  }

  if (!refs.impressaoSeriaisModal.classList.contains('hidden')) {
    fecharModalImpressaoSeriais();
    return;
  }

  if (!refs.faltasModal.classList.contains('hidden')) {
    fecharModalFaltas();
    return;
  }

  if (!refs.kitsModal.classList.contains('hidden')) {
    fecharModalKits();
    return;
  }

  if (!refs.historicoModal.classList.contains('hidden')) {
    fecharModalHistoricoPedidos();
    return;
  }

  if (!refs.relatorioModal.classList.contains('hidden')) {
    fecharModalRelatorio();
    return;
  }

  if (!refs.kitImagemModal.classList.contains('hidden')) {
    fecharModalKitImagem();
    return;
  }

  if (!refs.coletaConfirmModal.classList.contains('hidden')) {
    fecharConfirmacaoColetaPedido();
    return;
  }

  if (!refs.detalheModal.classList.contains('hidden')) {
    fecharModalDetalhe();
    return;
  }

  if (!refs.criacaoModal.classList.contains('hidden')) {
    fecharModalCriacao();
  }
}

function isPedidoProgramadoHoje(pedido) {
  return normalizeDateInput(pedido?.data_programacao_saida) === getTodayDateInput();
}

function esconderSugestoesItemPedido() {
  refs.itemSugestoes.classList.add('hidden');
  refs.itemSugestoes.innerHTML = '';
}

function obterPedidoSelecionado() {
  return pedidosCache.find((pedido) => pedido.id === Number(pedidoSelecionadoId)) || null;
}

function atualizarPedidoCache(pedidoAtualizado) {
  const index = pedidosCache.findIndex((pedido) => pedido.id === Number(pedidoAtualizado.id));
  if (index >= 0) {
    pedidosCache[index] = pedidoAtualizado;
  } else {
    pedidosCache.push(pedidoAtualizado);
  }
}

function iniciarAtualizacaoAutomatica() {
  if (autoRefreshHandle) {
    window.clearInterval(autoRefreshHandle);
  }

  autoRefreshHandle = window.setInterval(async () => {
    if (document.hidden) {
      return;
    }

    try {
      await carregarTudo();
    } catch (_) {
      // Atualizacao silenciosa para nao ficar poluindo a tela.
    }
  }, AUTO_REFRESH_MS);
}

function normalizeDateInput(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatarCodigoVisual(codigo) {
  return String(codigo || '');
}

function isNumeroSerieModel(item) {
  const codigo = String(item?.codigo || '').toUpperCase();
  if (['600', '550', '401RB', '401', '500', '450', '400', '350', '300', '250', '150', '100', '001'].includes(codigo)) {
    return true;
  }

  if (!codigo || codigo.includes('/')) {
    return false;
  }

  return ['VF', 'MC', 'AL', 'BR', 'SAF', 'CJ', 'MBF'].some((keyword) => codigo.includes(keyword));
}

function obterKitImageUrl(codigo) {
  const normalized = String(codigo || '').trim().toUpperCase();
  if (!normalized) {
    return '';
  }

  if (normalized === 'VF-040') {
    return '/kits/vf-040.png';
  }

  if (!/^[0-9]+[A-Z]+$/.test(normalized)) {
    return '';
  }

  return `/kits/${normalized}.jpg`;
}

function renderizarCodigoKitImagem(codigo, codigosAlternativos = [], textoReferencia = '') {
  const codigoImagem = resolverCodigoImagemKit(codigo, codigosAlternativos, textoReferencia);
  const kitImageUrl = obterKitImageUrl(codigoImagem);
  if (!kitImageUrl) {
    return escapeHtml(codigo || '-');
  }

  return `
    <a
      class="pedido-kit-link"
      href="${escapeHtml(kitImageUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      style="padding:0;border:0;background:none;color:#14528b;font:inherit;font-weight:800;text-decoration:underline;cursor:pointer;"
      title="${escapeHtml(codigoImagem === codigo ? 'Abrir imagem do kit em nova aba' : `Abrir imagem de referencia ${codigoImagem}`)}"
    >
      ${escapeHtml(codigo)}
    </a>
  `;
}

function resolverCodigoImagemKit(codigo, codigosAlternativos = [], textoReferencia = '') {
  if (obterKitImageUrl(codigo)) {
    return codigo;
  }

  const alternativas = [
    ...(Array.isArray(codigosAlternativos) ? codigosAlternativos : []),
    ...extrairCodigosImagemKit(textoReferencia)
  ];

  return alternativas.find((codigoAlternativo) => obterKitImageUrl(codigoAlternativo)) || codigo;
}

function extrairCodigosImagemKit(texto) {
  const encontrados = String(texto || '').toUpperCase().match(/\b(?:VF-040|\d+[A-Z]+)\b/g) || [];
  return [...new Set(encontrados)];
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel concluir a operacao.');
  }

  return result;
}

function normalizarBusca(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function formatDecimalInput(value, decimals = 3) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(decimals) : '';
}

function formatDateOnlyText(value) {
  const normalized = normalizeDateInput(value);
  if (!normalized) {
    return '-';
  }

  const [year, month, day] = normalized.split('-');
  if (!year || !month || !day) {
    return '-';
  }

  return `${day}/${month}/${year}`;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return formatDateOnlyText(value);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
}

function formatarDataCurta(value) {
  if (!value) {
    return '-';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return formatDateOnlyText(value);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function abrirPedidoViaQueryString() {
  const params = new URLSearchParams(window.location.search);
  const codigoPedido = params.get('pedido');
  if (!codigoPedido) {
    return;
  }

  const pedido = pedidosCache.find((item) => String(item.codigo_pedido || '').trim() === String(codigoPedido).trim());
  if (!pedido) {
    return;
  }

  await abrirDetalhePedido(pedido.id);
}

function renderStatusPedido(status) {
  const className = status === 'PEDIDO COLETADO' || status === 'COLETADO'
    ? 'status-chip is-success'
    : (status === 'AGUARDANDO NF' ? 'status-chip is-warning' : 'status-chip');

  return `<span class="${className}">${escapeHtml(status)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
