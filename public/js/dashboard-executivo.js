const painelApiBaseUrl = '/api/painel/resumo';
const estoqueApiBaseUrl = '/api/estoque/saldos';
const estoquePrioridadesApiBaseUrl = '/api/estoque/prioridades';
const estoqueMateriaPrimaApiBaseUrl = '/api/estoque-materias-primas/saldos';
const submontagensApiBaseUrl = '/api/submontagens';
const fornecedoresApiBaseUrl = '/api/fornecedores';
const pedidosExpedicaoApiBaseUrl = '/api/pedidos-expedicao';
const gerenciamentoServosApiBaseUrl = '/api/gerenciamento-servos/matriz';
const submontagemSeriaisApiBaseUrl = '/api/submontagem-seriais';
const AUTO_REFRESH_MS = 15000;
const HISTORICO_SERIAIS_LIMIT = 1000;

let painelCache = null;
let estoquesDetalhadosCache = [];
let estoquesPrioridadesCache = [];
let alertasAlmoxCache = [];
let materiasPrimasCache = [];
let submontagensCache = [];
let fornecedoresCache = [];
let pedidosDashboardCache = [];
let historicoPedidosDashboardCache = [];
let servosDashboardMatriz = null;
let servosDashboardEscopo = 'global';
let historicoSeriaisDashboardCache = [];
let autoRefreshHandle = null;
let historicoSeriaisFiltroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('dashboard-mensagem'),
  cardAndamento: document.getElementById('dashboard-card-andamento'),
  cardFinalizadasHoje: document.getElementById('dashboard-card-finalizadas-hoje'),
  cardCriticos: document.getElementById('dashboard-card-criticos'),
  cardTratamento: document.getElementById('dashboard-card-tratamento'),
  cardTratamentoCodigos: document.getElementById('dashboard-card-tratamento-codigos'),
  producaoTotal: document.getElementById('dashboard-producao-total'),
  producaoTbody: document.getElementById('dashboard-producao-tbody'),
  estoquesModal: document.getElementById('dashboard-estoques-modal'),
  mpModal: document.getElementById('dashboard-mp-modal'),
  fornecedoresModal: document.getElementById('dashboard-fornecedores-modal'),
  estoquesFiltroForm: document.getElementById('dashboard-estoques-filtro-form'),
  estoquesFiltroEstoque: document.getElementById('dashboard-estoques-filtro-estoque'),
  estoquesFiltroCodigo: document.getElementById('dashboard-estoques-filtro-codigo'),
  estoquesFiltroDescricao: document.getElementById('dashboard-estoques-filtro-descricao'),
  estoquesFiltroClassificacao: document.getElementById('dashboard-estoques-filtro-classificacao'),
  estoquesFiltroFornecedor: document.getElementById('dashboard-estoques-filtro-fornecedor'),
  estoquesFiltroEstado: document.getElementById('dashboard-estoques-filtro-estado'),
  estoquesFiltroOrdem: document.getElementById('dashboard-estoques-filtro-ordem'),
  estoquesTbody: document.getElementById('dashboard-estoques-tbody'),
  mpFiltroForm: document.getElementById('dashboard-mp-filtro-form'),
  mpFiltroCodigo: document.getElementById('dashboard-mp-filtro-codigo'),
  mpFiltroNome: document.getElementById('dashboard-mp-filtro-nome'),
  mpFiltroCategoria: document.getElementById('dashboard-mp-filtro-categoria'),
  mpFiltroGeometria: document.getElementById('dashboard-mp-filtro-geometria'),
  mpFiltroOrdem: document.getElementById('dashboard-mp-filtro-ordem'),
  mpTbody: document.getElementById('dashboard-mp-tbody'),
  fornecedoresMensagem: document.getElementById('dashboard-fornecedores-mensagem'),
  fornecedoresTotal: document.getElementById('dashboard-fornecedores-total'),
  fornecedoresFiltroForm: document.getElementById('dashboard-fornecedores-filtro-form'),
  fornecedoresFiltroNome: document.getElementById('dashboard-fornecedores-filtro-nome'),
  fornecedoresFiltroPeca: document.getElementById('dashboard-fornecedores-filtro-peca'),
  fornecedoresFiltroContato: document.getElementById('dashboard-fornecedores-filtro-contato'),
  fornecedoresFiltroCidade: document.getElementById('dashboard-fornecedores-filtro-cidade'),
  fornecedoresTbody: document.getElementById('dashboard-fornecedores-tbody'),
  estoquesTotalItens: document.getElementById('dashboard-estoques-total-itens'),
  estoquesTotalQuantidade: document.getElementById('dashboard-estoques-total-quantidade'),
  estoquesTotalDepositos: document.getElementById('dashboard-estoques-total-depositos'),
  estoquesTotalSubmontagens: document.getElementById('dashboard-estoques-total-submontagens'),
  mpTotalItens: document.getElementById('dashboard-mp-total-itens'),
  mpTotalQuantidade: document.getElementById('dashboard-mp-total-quantidade'),
  mpTotalTrefilados: document.getElementById('dashboard-mp-total-trefilados'),
  mpTotalFundidos: document.getElementById('dashboard-mp-total-fundidos'),
  simulacaoModal: document.getElementById('dashboard-simulacao-modal'),
  simulacaoMensagem: document.getElementById('dashboard-simulacao-mensagem'),
  simulacaoForm: document.getElementById('dashboard-simulacao-form'),
  simulacaoSubmontagemId: document.getElementById('dashboard-simulacao-submontagem-id'),
  simulacaoSubmontagemBusca: document.getElementById('dashboard-simulacao-submontagem-busca'),
  simulacaoSugestoes: document.getElementById('dashboard-simulacao-submontagem-sugestoes'),
  simulacaoQuantidade: document.getElementById('dashboard-simulacao-quantidade'),
  simulacaoCardPronto: document.getElementById('dashboard-simulacao-card-pronto'),
  simulacaoCardCapacidade: document.getElementById('dashboard-simulacao-card-capacidade'),
  simulacaoCardStatus: document.getElementById('dashboard-simulacao-card-status'),
  simulacaoTitulo: document.getElementById('dashboard-simulacao-titulo'),
  simulacaoSubtitulo: document.getElementById('dashboard-simulacao-subtitulo'),
  simulacaoResumo: document.getElementById('dashboard-simulacao-resumo'),
  simulacaoTbody: document.getElementById('dashboard-simulacao-tbody'),
  indicadoresModal: document.getElementById('dashboard-indicadores-modal'),
  saidasTbody: document.getElementById('dashboard-saidas-tbody'),
  maquinasTbody: document.getElementById('dashboard-maquinas-tbody'),
  destaquesTbody: document.getElementById('dashboard-destaques-tbody'),
  indicadorProduzido: document.getElementById('dashboard-indicador-produzido'),
  indicadorRefugo: document.getElementById('dashboard-indicador-refugo'),
  indicadorProduzidoHoje: document.getElementById('dashboard-indicador-produzido-hoje'),
  indicadorRefugoHoje: document.getElementById('dashboard-indicador-refugo-hoje'),
  pedidosModal: document.getElementById('dashboard-pedidos-modal'),
  pedidosTotal: document.getElementById('dashboard-pedidos-total'),
  pedidosFiltroForm: document.getElementById('dashboard-pedidos-filtro-form'),
  pedidosFiltroBusca: document.getElementById('dashboard-pedidos-filtro-busca'),
  pedidosFiltroStatus: document.getElementById('dashboard-pedidos-filtro-status'),
  pedidosTbody: document.getElementById('dashboard-pedidos-tbody'),
  pedidosCardAtivos: document.getElementById('dashboard-pedidos-card-ativos'),
  pedidosCardHoje: document.getElementById('dashboard-pedidos-card-hoje'),
  pedidosCardNf: document.getElementById('dashboard-pedidos-card-nf'),
  pedidosCardTransporte: document.getElementById('dashboard-pedidos-card-transporte'),
  historicoPedidosModal: document.getElementById('dashboard-historico-pedidos-modal'),
  historicoPedidosTotal: document.getElementById('dashboard-historico-pedidos-total'),
  historicoPedidosFiltroForm: document.getElementById('dashboard-historico-pedidos-filtro-form'),
  historicoPedidosFiltroBusca: document.getElementById('dashboard-historico-pedidos-filtro-busca'),
  historicoPedidosFiltroTransportadora: document.getElementById('dashboard-historico-pedidos-filtro-transportadora'),
  historicoPedidosFiltroData: document.getElementById('dashboard-historico-pedidos-filtro-data'),
  historicoPedidosTbody: document.getElementById('dashboard-historico-pedidos-tbody'),
  historicoPedidosCardColetados: document.getElementById('dashboard-historico-pedidos-card-coletados'),
  historicoPedidosCardHoje: document.getElementById('dashboard-historico-pedidos-card-hoje'),
  historicoPedidosCardItens: document.getElementById('dashboard-historico-pedidos-card-itens'),
  historicoPedidosCardSeriais: document.getElementById('dashboard-historico-pedidos-card-seriais'),
  pedidoDetalheModal: document.getElementById('dashboard-pedido-detalhe-modal'),
  pedidoDetalheTitulo: document.getElementById('dashboard-pedido-detalhe-titulo'),
  pedidoDetalheSubtitulo: document.getElementById('dashboard-pedido-detalhe-subtitulo'),
  pedidoDetalheResumo: document.getElementById('dashboard-pedido-detalhe-resumo'),
  pedidoDetalheObservacao: document.getElementById('dashboard-pedido-detalhe-observacao'),
  pedidoDetalheItensTbody: document.getElementById('dashboard-pedido-detalhe-itens-tbody'),
  servosModal: document.getElementById('dashboard-servos-modal'),
  servosTitulo: document.getElementById('dashboard-servos-titulo'),
  servosSubtitulo: document.getElementById('dashboard-servos-subtitulo'),
  servosResumo: document.getElementById('dashboard-servos-resumo'),
  servosThead: document.getElementById('dashboard-servos-thead'),
  servosTbody: document.getElementById('dashboard-servos-tbody'),
  servosBtnDia: document.getElementById('dashboard-servos-btn-dia'),
  servosBtnGlobal: document.getElementById('dashboard-servos-btn-global'),
  historicoSeriaisModal: document.getElementById('dashboard-historico-seriais-modal'),
  historicoSeriaisTotal: document.getElementById('dashboard-historico-seriais-total'),
  historicoSeriaisFiltroForm: document.getElementById('dashboard-historico-seriais-filtro-form'),
  historicoSeriaisFiltroNumero: document.getElementById('dashboard-historico-seriais-filtro-numero'),
  historicoSeriaisFiltroModelo: document.getElementById('dashboard-historico-seriais-filtro-modelo'),
  historicoSeriaisFiltroMontador: document.getElementById('dashboard-historico-seriais-filtro-montador'),
  historicoSeriaisFiltroClientePedido: document.getElementById('dashboard-historico-seriais-filtro-cliente-pedido'),
  historicoSeriaisFiltroData: document.getElementById('dashboard-historico-seriais-filtro-data'),
  historicoSeriaisFiltroSituacao: document.getElementById('dashboard-historico-seriais-filtro-situacao'),
  historicoSeriaisTbody: document.getElementById('dashboard-historico-seriais-tbody'),
  historicoSeriaisCardRegistros: document.getElementById('dashboard-historico-seriais-card-registros'),
  historicoSeriaisCardDisponiveis: document.getElementById('dashboard-historico-seriais-card-disponiveis'),
  historicoSeriaisCardSaidas: document.getElementById('dashboard-historico-seriais-card-saidas')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  configurarAtualizacaoOperacional();

  try {
    await Promise.all([
      carregarDashboard(),
      carregarEstoquesDetalhados(),
      carregarAlertasAlmox(),
      carregarMateriasPrimas(),
      carregarSubmontagens()
    ]);
    iniciarAtualizacaoAutomatica();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
});

function configurarAtualizacaoOperacional() {
  if (!window.SafisaSync?.subscribe) {
    return;
  }

  const recarregarServosSeAberto = () => {
    if (refs.servosModal.classList.contains('hidden')) {
      return;
    }

    carregarServosDashboard().catch((error) => {
      refs.servosTbody.innerHTML = `<tr><td colspan="2" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
    });
  };

  ['pedidos-expedicao', 'submontagem-seriais'].forEach((topic) => {
    window.SafisaSync.subscribe(topic, recarregarServosSeAberto);
  });
}

function bindEvents() {
  document.getElementById('btn-dashboard-estoques').addEventListener('click', () => openModal(refs.estoquesModal));
  document.getElementById('btn-dashboard-mp').addEventListener('click', () => openModal(refs.mpModal));
  document.getElementById('btn-dashboard-fornecedores').addEventListener('click', abrirModalFornecedores);
  document.getElementById('btn-dashboard-simulacao').addEventListener('click', () => openModal(refs.simulacaoModal));
  document.getElementById('btn-dashboard-indicadores').addEventListener('click', () => openModal(refs.indicadoresModal));
  document.getElementById('btn-dashboard-pedidos').addEventListener('click', abrirModalPedidosDashboard);
  document.getElementById('btn-dashboard-historico-pedidos').addEventListener('click', abrirModalHistoricoPedidosDashboard);
  document.getElementById('btn-dashboard-servos').addEventListener('click', abrirModalServosDashboard);
  document.getElementById('btn-dashboard-historico-seriais').addEventListener('click', abrirModalHistoricoSeriaisDashboard);

  document.getElementById('btn-fechar-modal-dashboard-estoques').addEventListener('click', () => closeModal(refs.estoquesModal));
  document.getElementById('btn-fechar-modal-dashboard-mp').addEventListener('click', () => closeModal(refs.mpModal));
  document.getElementById('btn-fechar-modal-dashboard-fornecedores').addEventListener('click', fecharModalFornecedores);
  document.getElementById('btn-fechar-modal-dashboard-simulacao').addEventListener('click', () => closeModal(refs.simulacaoModal));
  document.getElementById('btn-fechar-modal-dashboard-indicadores').addEventListener('click', () => closeModal(refs.indicadoresModal));
  document.getElementById('btn-fechar-modal-dashboard-pedidos').addEventListener('click', () => closeModal(refs.pedidosModal));
  document.getElementById('btn-fechar-modal-dashboard-historico-pedidos').addEventListener('click', () => closeModal(refs.historicoPedidosModal));
  document.getElementById('btn-fechar-modal-dashboard-pedido-detalhe').addEventListener('click', () => closeModal(refs.pedidoDetalheModal));
  document.getElementById('btn-fechar-modal-dashboard-servos').addEventListener('click', () => closeModal(refs.servosModal));
  document.getElementById('btn-fechar-modal-dashboard-historico-seriais').addEventListener('click', () => closeModal(refs.historicoSeriaisModal));
  document.getElementById('btn-limpar-modal-dashboard-estoques').addEventListener('click', limparFiltrosEstoque);
  document.getElementById('btn-limpar-modal-dashboard-mp').addEventListener('click', limparFiltrosMp);
  document.getElementById('btn-limpar-modal-dashboard-fornecedores').addEventListener('click', limparFiltrosFornecedores);
  document.getElementById('btn-dashboard-pedidos-limpar').addEventListener('click', limparFiltrosPedidosDashboard);
  document.getElementById('btn-dashboard-historico-pedidos-limpar').addEventListener('click', limparFiltrosHistoricoPedidosDashboard);
  document.getElementById('btn-dashboard-historico-seriais-limpar').addEventListener('click', limparFiltrosHistoricoSeriaisDashboard);

  refs.estoquesFiltroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', renderizarTabelaEstoquesDetalhados);
    field.addEventListener('change', renderizarTabelaEstoquesDetalhados);
  });

  refs.mpFiltroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', renderizarTabelaMateriaPrima);
    field.addEventListener('change', renderizarTabelaMateriaPrima);
  });

  refs.fornecedoresFiltroForm.querySelectorAll('input').forEach((field) => {
    field.addEventListener('input', renderizarFornecedores);
  });

  refs.pedidosFiltroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', renderizarPedidosDashboard);
    field.addEventListener('change', renderizarPedidosDashboard);
  });
  refs.pedidosTbody.addEventListener('click', handlePedidosDashboardClick);
  refs.historicoPedidosFiltroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', renderizarHistoricoPedidosDashboard);
    field.addEventListener('change', renderizarHistoricoPedidosDashboard);
  });
  refs.historicoPedidosTbody.addEventListener('click', handleHistoricoPedidosDashboardClick);

  refs.servosBtnDia.addEventListener('click', () => alternarEscopoServosDashboard('dia'));
  refs.servosBtnGlobal.addEventListener('click', () => alternarEscopoServosDashboard('global'));
  refs.historicoSeriaisFiltroNumero.addEventListener('input', agendarCarregamentoHistoricoSeriaisDashboard);
  refs.historicoSeriaisFiltroNumero.addEventListener('change', agendarCarregamentoHistoricoSeriaisDashboard);
  [
    refs.historicoSeriaisFiltroModelo,
    refs.historicoSeriaisFiltroMontador,
    refs.historicoSeriaisFiltroClientePedido,
    refs.historicoSeriaisFiltroData,
    refs.historicoSeriaisFiltroSituacao
  ].forEach((field) => {
    field.addEventListener('input', renderizarHistoricoSeriaisDashboard);
    field.addEventListener('change', renderizarHistoricoSeriaisDashboard);
  });

  refs.simulacaoForm.addEventListener('submit', handleSimulacaoSubmit);
  refs.simulacaoSubmontagemBusca.addEventListener('input', () => {
    refs.simulacaoSubmontagemId.value = '';
    renderizarSugestoesSubmontagem(refs.simulacaoSubmontagemBusca.value.trim());
  });
  refs.simulacaoSubmontagemBusca.addEventListener('focus', () => renderizarSugestoesSubmontagem(refs.simulacaoSubmontagemBusca.value.trim()));
  refs.simulacaoSugestoes.addEventListener('click', handleSugestaoSubmontagemClick);

  [refs.estoquesModal, refs.mpModal, refs.fornecedoresModal, refs.simulacaoModal, refs.indicadoresModal, refs.pedidosModal, refs.historicoPedidosModal, refs.pedidoDetalheModal, refs.servosModal, refs.historicoSeriaisModal].forEach((modal) => {
    modal.addEventListener('click', handleBackdrop);
  });

  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarDashboard() {
  const response = await fetch(painelApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o dashboard.');
  }

  painelCache = result;
  renderizarPainel();
}

async function carregarEstoquesDetalhados() {
  const response = await fetch(estoqueApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os estoques detalhados.');
  }

  estoquesDetalhadosCache = Array.isArray(result) ? result : [];
  preencherFiltroEstoques();
  renderizarTabelaEstoquesDetalhados();
  if (painelCache) {
    renderizarPainel();
  }
}

async function carregarAlertasAlmox() {
  const response = await fetch(`${estoquePrioridadesApiBaseUrl}?modo=todos`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as prioridades de estoque.');
  }

  estoquesPrioridadesCache = Array.isArray(result) ? result : [];
  alertasAlmoxCache = estoquesPrioridadesCache.filter((item) => normalizarBusca(item.estoque_nome).includes('almox'));
  preencherFiltroEstoques();
  renderizarTabelaEstoquesDetalhados();
  if (painelCache) {
    renderizarPainel();
  }
}

async function carregarMateriasPrimas() {
  const response = await fetch(estoqueMateriaPrimaApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o estoque de materia-prima.');
  }

  materiasPrimasCache = Array.isArray(result) ? result : [];
  renderizarTabelaMateriaPrima();
  if (painelCache) {
    renderizarPainel();
  }
}

async function carregarFornecedores() {
  if (fornecedoresCache.length) {
    return;
  }

  const response = await fetch(fornecedoresApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os fornecedores.');
  }

  fornecedoresCache = Array.isArray(result) ? result : [];
}

async function carregarPedidosDashboard() {
  const response = await fetch(`${pedidosExpedicaoApiBaseUrl}?ativos=true`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os pedidos ativos.');
  }

  pedidosDashboardCache = Array.isArray(result) ? result : [];
  renderizarPedidosDashboard();
}

async function carregarHistoricoPedidosDashboard() {
  const response = await fetch(`${pedidosExpedicaoApiBaseUrl}?ativos=false`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o historico de pedidos.');
  }

  historicoPedidosDashboardCache = Array.isArray(result) ? result : [];
  renderizarHistoricoPedidosDashboard();
}

async function carregarServosDashboard() {
  refs.servosTbody.innerHTML = '<tr><td colspan="2" class="empty-state">Carregando matriz de servos...</td></tr>';

  const response = await fetch(`${gerenciamentoServosApiBaseUrl}?escopo=${encodeURIComponent(servosDashboardEscopo)}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar a matriz de servos.');
  }

  servosDashboardMatriz = result;
  renderizarServosDashboard();
}

async function carregarHistoricoSeriaisDashboard() {
  const params = new URLSearchParams({ limit: String(HISTORICO_SERIAIS_LIMIT) });
  const numeroSerie = refs.historicoSeriaisFiltroNumero.value.trim();

  if (numeroSerie) {
    params.set('numero_serie', numeroSerie);
  }

  const response = await fetch(`${submontagemSeriaisApiBaseUrl}?${params.toString()}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o historico de numeros de serie.');
  }

  historicoSeriaisDashboardCache = Array.isArray(result) ? result : [];
  renderizarHistoricoSeriaisDashboard();
}

function agendarCarregamentoHistoricoSeriaisDashboard() {
  window.clearTimeout(historicoSeriaisFiltroDebounceTimer);
  historicoSeriaisFiltroDebounceTimer = window.setTimeout(() => {
    carregarHistoricoSeriaisDashboard().catch((error) => {
      refs.historicoSeriaisTbody.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
    });
  }, 250);
}

async function carregarSubmontagens() {
  const response = await fetch(submontagensApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as submontagens.');
  }

  submontagensCache = Array.isArray(result) ? result : [];
}

function renderizarPainel() {
  const producaoEmAndamento = Array.isArray(painelCache?.producao_em_andamento) ? painelCache.producao_em_andamento : [];
  const estoquePorDeposito = Array.isArray(painelCache?.estoque_por_deposito) ? painelCache.estoque_por_deposito : [];
  const estoqueMaiores = Array.isArray(painelCache?.estoque_maiores) ? painelCache.estoque_maiores : [];
  const estoqueMenores = Array.isArray(painelCache?.estoque_menores) ? painelCache.estoque_menores : [];
  const saidasTop = Array.isArray(painelCache?.saidas_top) ? painelCache.saidas_top : [];
  const producaoPorMaquina = Array.isArray(painelCache?.producao_por_maquina) ? painelCache.producao_por_maquina : [];
  const tratamentoPendentes = Array.isArray(painelCache?.tratamento_pendentes) ? painelCache.tratamento_pendentes : [];

  refs.cardAndamento.textContent = formatInteger(producaoEmAndamento.length);
  refs.cardFinalizadasHoje.textContent = formatInteger(painelCache?.indicadores?.producao_hoje?.ordens_finalizadas_hoje || 0);
  refs.cardCriticos.textContent = formatInteger(obterAlertasAlmoxOperacionais().length);
  renderizarCardTratamento(tratamentoPendentes);

  refs.producaoTotal.textContent = `${formatInteger(producaoEmAndamento.length)} ordem(ns) em andamento`;
  renderizarTabelaProducao(producaoEmAndamento);

  const depositosMonitorados = new Set(estoquesDetalhadosCache.map((item) => String(item.estoque_nome || '').trim()).filter(Boolean)).size;
  const submontagensComSaldo = estoquesDetalhadosCache.filter((item) => String(item.classificacao || '').toUpperCase() === 'SUBMONTAGEM').length;
  const materiasPrimasTrefiladas = materiasPrimasCache.filter((item) => String(item.categoria || '').toUpperCase() === 'TREFILADO').length;
  const materiasPrimasFundidas = materiasPrimasCache.filter((item) => String(item.categoria || '').toUpperCase() === 'FUNDIDO').length;

  refs.estoquesTotalItens.textContent = formatInteger(painelCache?.indicadores?.estoque?.registros || 0);
  refs.estoquesTotalQuantidade.textContent = formatInteger(painelCache?.indicadores?.estoque?.quantidade_total || 0);
  refs.estoquesTotalDepositos.textContent = formatInteger(depositosMonitorados);
  refs.estoquesTotalSubmontagens.textContent = formatInteger(submontagensComSaldo);
  refs.mpTotalItens.textContent = formatInteger(painelCache?.indicadores?.materia_prima?.registros || 0);
  refs.mpTotalQuantidade.textContent = formatInteger(painelCache?.indicadores?.materia_prima?.quantidade_total || 0);
  refs.mpTotalTrefilados.textContent = formatInteger(materiasPrimasTrefiladas);
  refs.mpTotalFundidos.textContent = formatInteger(materiasPrimasFundidas);
  renderizarTabelaEstoquesDetalhados();
  renderizarTabelaMateriaPrima();

  refs.indicadorProduzido.textContent = formatInteger(painelCache?.indicadores?.producao?.total_produzido || 0);
  refs.indicadorRefugo.textContent = formatInteger(painelCache?.indicadores?.producao?.total_refugo || 0);
  refs.indicadorProduzidoHoje.textContent = formatInteger(painelCache?.indicadores?.producao_hoje?.total_produzido_hoje || 0);
  refs.indicadorRefugoHoje.textContent = formatInteger(painelCache?.indicadores?.producao_hoje?.total_refugo_hoje || 0);
  renderizarTabelaSaidas(saidasTop);
  renderizarTabelaMaquinas(producaoPorMaquina);
  renderizarTabelaDestaques(estoqueMaiores, estoqueMenores);
}

function renderizarCardTratamento(items) {
  const quantidadeTotal = items.reduce((total, item) => total + Number(item.quantidade_pendente || 0), 0);
  refs.cardTratamento.textContent = formatDecimal(quantidadeTotal);

  if (!items.length) {
    refs.cardTratamentoCodigos.textContent = 'Nenhum codigo pendente';
    return;
  }

  const codigosUnicos = Array.from(new Set(items.map((item) => String(item.codigo || '').trim()).filter(Boolean)));
  const codigos = codigosUnicos.slice(0, 8);
  const complemento = codigosUnicos.length > 8 ? ` +${codigosUnicos.length - 8}` : '';
  refs.cardTratamentoCodigos.textContent = `${codigos.join(', ')}${complemento}`;
}

function renderizarTabelaProducao(items) {
  if (!items.length) {
    refs.producaoTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma ordem em andamento.</td></tr>';
    return;
  }

  refs.producaoTbody.innerHTML = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.maquina_nome || '-')}</td>
      <td class="table-description">${escapeHtml(`${item.peca_codigo || '-'} - ${item.peca_descricao || '-'}`)}</td>
      <td>${escapeHtml(item.materia_prima_codigo && item.materia_prima_codigo !== '-' ? `${item.materia_prima_codigo} - ${item.materia_prima_nome}` : 'Sem materia-prima')}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_planejada)}</td>
      <td>${formatarDataHora(item.data_inicio)}</td>
    </tr>
  `).join('');
}

function preencherFiltroEstoques() {
  const base = obterRegistrosDetalhadosDashboard();
  const options = Array.from(new Set(base.map((item) => String(item.estoque_nome || '').trim()).filter(Boolean)));
  const valorSelecionado = String(refs.estoquesFiltroEstoque.value || '').trim();
  refs.estoquesFiltroEstoque.innerHTML = `
    <option value="">Todos</option>
    ${options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}
  `;

  if (valorSelecionado && options.includes(valorSelecionado)) {
    refs.estoquesFiltroEstoque.value = valorSelecionado;
    return;
  }

  refs.estoquesFiltroEstoque.value = '';
}

function renderizarTabelaEstoquesDetalhados() {
  const items = obterEstoquesDetalhadosFiltrados();

  if (!items.length) {
    refs.estoquesTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhum item encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.estoquesTbody.innerHTML = items.map((item) => `
    <tr class="${item.aplica_prioridade && item.estado_necessidade === 'CRITICO' ? 'table-row-attention' : ''}">
      <td>${escapeHtml(item.estoque_nome)}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-compact-text">${escapeHtml(obterFornecedorLabelCompacto(item))}</td>
      <td>${escapeHtml(item.classificacao)}</td>
      <td class="table-quantity">${formatDecimal(item.quantidade)}</td>
      <td class="table-quantity">${item.aplica_prioridade ? formatDecimal(item.quantidade_saida_mes) : '-'}</td>
      <td>${escapeHtml(formatarDuracaoPrioridade(item))}</td>
      <td>${renderizarEstadoNecessidade(item.estado_necessidade, item.aplica_prioridade)}</td>
    </tr>
  `).join('');
}

function renderizarTabelaMateriaPrima() {
  const items = obterMateriasPrimasFiltradas();

  if (!items.length) {
    refs.mpTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma materia-prima encontrada com os filtros informados.</td></tr>';
    return;
  }

  refs.mpTbody.innerHTML = items.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.nome)}</td>
      <td>${renderizarCategoriaGeometria(item)}</td>
      <td>${escapeHtml(buildBitolaLabel(item))}</td>
      <td class="table-quantity">${formatMpQuantity(item.quantidade, item.unidade_controle)}</td>
    </tr>
  `).join('');
}

function obterFornecedoresFiltrados() {
  const filtroNome = normalizarBusca(refs.fornecedoresFiltroNome.value.trim());
  const filtroPeca = normalizarBusca(refs.fornecedoresFiltroPeca.value.trim());
  const filtroContato = normalizarBusca(refs.fornecedoresFiltroContato.value.trim());
  const filtroCidade = normalizarBusca(refs.fornecedoresFiltroCidade.value.trim());

  return fornecedoresCache.filter((item) => {
    if (filtroNome && !normalizarBusca(item.nome).includes(filtroNome)) {
      return false;
    }

    if (filtroPeca && !normalizarBusca(`${item.pecas_codigos || ''} ${item.pecas_vinculadas || ''}`).includes(filtroPeca)) {
      return false;
    }

    if (filtroContato && !normalizarBusca(item.contato).includes(filtroContato)) {
      return false;
    }

    if (filtroCidade && !normalizarBusca(item.cidade).includes(filtroCidade)) {
      return false;
    }

    return true;
  });
}

function renderizarFornecedores() {
  const fornecedores = obterFornecedoresFiltrados();
  refs.fornecedoresTotal.textContent = `${fornecedores.length} fornecedor(es) encontrado(s)`;

  if (!fornecedores.length) {
    refs.fornecedoresTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum fornecedor encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.fornecedoresTbody.innerHTML = fornecedores.map((item) => `
    <tr>
      <td class="table-description">${escapeHtml(item.nome || '-')}</td>
      <td class="table-description">${escapeHtml(item.pecas_codigos || item.pecas_vinculadas || '-')}</td>
      <td>${escapeHtml(item.contato || '-')}</td>
      <td>${escapeHtml(item.telefone || '-')}</td>
      <td>${escapeHtml(item.cidade || '-')}</td>
      <td>${escapeHtml(item.email || '-')}</td>
    </tr>
  `).join('');
}

function renderizarPedidosDashboard() {
  const pedidos = obterPedidosDashboardFiltrados();
  const ativos = pedidosDashboardCache.filter((pedido) => pedido.status !== 'PEDIDO COLETADO');
  const programadosHoje = ativos.filter((pedido) => isPedidoProgramadoHoje(pedido)).length;
  const aguardandoNf = ativos.filter((pedido) => pedido.status === 'AGUARDANDO NF').length;
  const aguardandoTransporte = ativos.filter((pedido) => pedido.status === 'AGUARDANDO TRANSPORTADORA').length;

  refs.pedidosTotal.textContent = `${formatInteger(pedidos.length)} pedido(s) em exibicao`;
  refs.pedidosCardAtivos.textContent = formatInteger(ativos.length);
  refs.pedidosCardHoje.textContent = formatInteger(programadosHoje);
  refs.pedidosCardNf.textContent = formatInteger(aguardandoNf);
  refs.pedidosCardTransporte.textContent = formatInteger(aguardandoTransporte);

  if (!pedidos.length) {
    refs.pedidosTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhum pedido ativo encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.pedidosTbody.innerHTML = pedidos.map((pedido) => {
    const faltas = Array.isArray(pedido.faltantes) ? pedido.faltantes.length : 0;
    const progresso = `${formatInteger(pedido.itens_concluidos || 0)}/${formatInteger(pedido.total_itens || 0)}`;

    return `
      <tr>
        <td>${isPedidoProgramadoHoje(pedido) ? '<span class="status-chip is-info">Hoje</span>' : formatarDataCurta(pedido.data_programacao_saida)}</td>
        <td class="table-code">${escapeHtml(pedido.codigo_pedido || '-')}</td>
        <td class="table-description">${escapeHtml(pedido.cliente_nome || '-')}</td>
        <td>${escapeHtml(pedido.cidade || '-')}</td>
        <td>${renderizarStatusPedidoDashboard(pedido)}</td>
        <td class="table-quantity">${escapeHtml(progresso)}</td>
        <td class="table-quantity">${formatInteger(faltas)}</td>
        <td>${escapeHtml(pedido.transportadora || '-')}</td>
        <td>
          <button class="btn btn-neutral btn-small" type="button" data-dashboard-pedido-id="${pedido.id}">Ver</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarHistoricoPedidosDashboard() {
  const pedidos = obterHistoricoPedidosDashboardFiltrados();
  const coletadosHoje = historicoPedidosDashboardCache.filter((pedido) => normalizeDateInput(pedido.data_coleta) === normalizeDateInput(new Date())).length;
  const totalItens = historicoPedidosDashboardCache.reduce((sum, pedido) => sum + obterTotalItensPedidoDashboard(pedido), 0);
  const totalSeriais = historicoPedidosDashboardCache.reduce((sum, pedido) => (
    sum + (Array.isArray(pedido.itens)
      ? pedido.itens.reduce((itemSum, item) => itemSum + (Array.isArray(item.seriais_vinculados) ? item.seriais_vinculados.length : 0), 0)
      : 0)
  ), 0);

  refs.historicoPedidosTotal.textContent = `${formatInteger(pedidos.length)} pedido(s) em exibicao`;
  refs.historicoPedidosCardColetados.textContent = formatInteger(historicoPedidosDashboardCache.length);
  refs.historicoPedidosCardHoje.textContent = formatInteger(coletadosHoje);
  refs.historicoPedidosCardItens.textContent = formatInteger(totalItens);
  refs.historicoPedidosCardSeriais.textContent = formatInteger(totalSeriais);

  if (!historicoPedidosDashboardCache.length) {
    refs.historicoPedidosTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum pedido coletado encontrado.</td></tr>';
    return;
  }

  if (!pedidos.length) {
    refs.historicoPedidosTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum pedido encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.historicoPedidosTbody.innerHTML = pedidos.map((pedido) => {
    const seriais = Array.isArray(pedido.itens)
      ? pedido.itens.reduce((sum, item) => sum + (Array.isArray(item.seriais_vinculados) ? item.seriais_vinculados.length : 0), 0)
      : 0;

    return `
      <tr>
        <td>${formatarDataHora(pedido.data_coleta)}</td>
        <td class="table-code">${escapeHtml(pedido.codigo_pedido || '-')}</td>
        <td class="table-description">${escapeHtml(pedido.cliente_nome || '-')}</td>
        <td>${escapeHtml(pedido.cidade || '-')}</td>
        <td class="table-quantity">${formatInteger(obterTotalItensPedidoDashboard(pedido))}</td>
        <td class="table-quantity">${formatInteger(seriais)}</td>
        <td>${escapeHtml(pedido.transportadora || '-')}</td>
        <td>
          <button class="btn btn-neutral btn-small" type="button" data-dashboard-historico-pedido-id="${pedido.id}">Ver</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarDetalhePedidoDashboard(pedido) {
  refs.pedidoDetalheTitulo.textContent = pedido.codigo_pedido
    ? `Pedido ${pedido.codigo_pedido}`
    : `Pedido #${pedido.id}`;
  refs.pedidoDetalheSubtitulo.textContent = `${pedido.cliente_nome || '-'} | ${pedido.cidade || '-'}`;

  const faltas = Array.isArray(pedido.faltantes) ? pedido.faltantes.length : 0;
  refs.pedidoDetalheResumo.innerHTML = `
    <div class="view-card">
      <span>Status</span>
      <strong>${escapeHtml(obterTextoStatusPedidoDashboard(pedido))}</strong>
    </div>
    <div class="view-card">
      <span>Saida</span>
      <strong>${escapeHtml(isPedidoProgramadoHoje(pedido) ? 'Hoje' : formatarDataCurta(pedido.data_programacao_saida))}</strong>
    </div>
    <div class="view-card">
      <span>Itens</span>
      <strong>${formatInteger(pedido.itens_concluidos || 0)}/${formatInteger(pedido.total_itens || 0)}</strong>
    </div>
    <div class="view-card">
      <span>Faltas</span>
      <strong>${formatInteger(faltas)}</strong>
    </div>
    <div class="view-card">
      <span>Transportadora</span>
      <strong>${escapeHtml(pedido.transportadora || '-')}</strong>
    </div>
    <div class="view-card">
      <span>Vendedora</span>
      <strong>${escapeHtml(pedido.vendedora || '-')}</strong>
    </div>
  `;

  const observacao = String(pedido.observacao || '').trim();
  refs.pedidoDetalheObservacao.className = observacao ? 'message warning' : 'message hidden';
  refs.pedidoDetalheObservacao.textContent = observacao ? `Observacao: ${observacao}` : '';

  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  if (!itens.length) {
    refs.pedidoDetalheItensTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Pedido sem itens cadastrados.</td></tr>';
    return;
  }

  refs.pedidoDetalheItensTbody.innerHTML = itens.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo || '-')}</td>
      <td class="table-description">${escapeHtml(item.descricao || '-')}</td>
      <td class="table-quantity">${formatInteger(item.quantidade || 0)}</td>
      <td>${renderizarStatusItemPedidoDashboard(item)}</td>
      <td>${escapeHtml(formatarSeriaisItemPedidoDashboard(item))}</td>
      <td class="table-description">${renderizarComponentesItemPedidoDashboard(item)}</td>
    </tr>
  `).join('');
}

function renderizarServosDashboard() {
  const pedidos = servosDashboardMatriz?.pedidos || [];
  const rows = servosDashboardMatriz?.rows || [];
  const resumo = servosDashboardMatriz?.resumo || {};
  const data = servosDashboardMatriz?.data_referencia || '-';

  refs.servosTitulo.textContent = `Consulta de servos - ${servosDashboardEscopo === 'dia' ? 'Pedidos do dia' : 'Visao global'}`;
  refs.servosSubtitulo.textContent = `Referencia ${data}. Matriz em modo leitura para acompanhamento.`;
  refs.servosBtnDia.classList.toggle('is-active', servosDashboardEscopo === 'dia');
  refs.servosBtnGlobal.classList.toggle('is-active', servosDashboardEscopo === 'global');

  refs.servosResumo.innerHTML = [
    ['Escopo', resumo.escopo === 'dia' ? 'Dia' : 'Global'],
    ['Pedidos', resumo.pedidos || 0],
    ['Modelos', resumo.modelos || 0],
    ['Demanda', formatServoNumber(resumo.demanda_total)],
    ['Estoque', formatServoNumber(resumo.estoque_total)],
    ['Corpos', formatServoNumber(resumo.corpos_total)],
    ['Zinco', formatServoNumber(resumo.zinco_total)],
    ['Usinagem', formatServoNumber(resumo.usinagem_total)]
  ].map(([label, value]) => `
    <span class="summary-chip">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `).join('');

  refs.servosThead.innerHTML = `
    <tr>
      <th class="sticky-col servo-sheet-model-col">
        <div class="servo-sheet-model-head">
          <span>MODELO</span>
          <strong>${escapeHtml(data)}</strong>
        </div>
      </th>
      <th class="servo-sheet-total-col servo-sheet-head-accent">TOTAL</th>
      ${pedidos.map((pedido) => `
        <th class="servo-sheet-vertical-col" title="${escapeHtml(`${pedido.cliente_nome} | ${pedido.codigo_pedido}`)}">
          <strong>${escapeHtml(pedido.cliente_nome)}</strong>
        </th>
      `).join('')}
      <th class="servo-sheet-resource-col servo-sheet-divider-left"><span>ESTOQUE</span></th>
      <th class="servo-sheet-resource-col"><span>CORPOS</span></th>
      <th class="servo-sheet-resource-col"><span>ZINCO</span></th>
      <th class="servo-sheet-resource-col"><span>USINAGEM</span></th>
      <th class="servo-sheet-resource-col"><span>MAT-PRIMA</span></th>
    </tr>
  `;

  if (!rows.length) {
    refs.servosTbody.innerHTML = `<tr><td colspan="${2 + pedidos.length + 5}" class="empty-state">Nenhum modelo encontrado para este escopo.</td></tr>`;
    return;
  }

  const totalPedidos = Object.fromEntries(pedidos.map((pedido) => [String(pedido.id), 0]));
  rows.forEach((row) => {
    pedidos.forEach((pedido) => {
      totalPedidos[String(pedido.id)] += Number(row.pedidos[String(pedido.id)] || 0);
    });
  });

  refs.servosTbody.innerHTML = `
    ${rows.map((row) => `
      <tr class="servo-sheet-row">
        <th class="sticky-col servo-sheet-model-cell">
          <div class="servo-sheet-model-title">${escapeHtml(row.label)}${row.corpo_compartilhado ? '<span class="servo-sheet-body-marker" title="Corpo compartilhado">*</span>' : ''}</div>
        </th>
        ${renderServoMetricCell(row.total, 'servo-sheet-total-cell')}
        ${pedidos.map((pedido) => renderServoMetricCell(row.pedidos[String(pedido.id)] || 0)).join('')}
        ${renderServoMetricCell(row.estoque, 'servo-sheet-divider-left')}
        ${renderServoMetricCell(row.corpos)}
        ${renderServoMetricCell(row.zinco)}
        ${renderServoMetricCell(row.usinagem)}
        ${renderServoMateriaPrimaCell(row.materia_prima)}
      </tr>
    `).join('')}
    <tr class="servo-sheet-total-row">
      <th class="sticky-col servo-sheet-model-cell">TOTAL GERAL</th>
      <td class="servo-sheet-total-cell">${formatServoNumberOrEmpty(rows.reduce((sum, row) => sum + Number(row.total || 0), 0))}</td>
      ${pedidos.map((pedido) => `<td class="servo-sheet-cell servo-sheet-total-inline">${formatServoNumberOrEmpty(totalPedidos[String(pedido.id)] || 0)}</td>`).join('')}
      <td class="servo-sheet-cell servo-sheet-divider-left servo-sheet-total-muted">-</td>
      <td class="servo-sheet-cell servo-sheet-total-muted">-</td>
      <td class="servo-sheet-cell servo-sheet-total-muted">-</td>
      <td class="servo-sheet-cell servo-sheet-total-muted">-</td>
      <td class="servo-sheet-cell servo-sheet-total-muted">-</td>
    </tr>
  `;
}

function renderizarHistoricoSeriaisDashboard() {
  const registros = obterHistoricoSeriaisDashboardFiltrado();
  const disponiveis = historicoSeriaisDashboardCache.filter((registro) => !registro.data_saida).length;
  const comSaida = historicoSeriaisDashboardCache.filter((registro) => registro.data_saida).length;

  refs.historicoSeriaisTotal.textContent = `${formatInteger(registros.length)} registro(s) encontrado(s)`;
  refs.historicoSeriaisCardRegistros.textContent = formatInteger(historicoSeriaisDashboardCache.length);
  refs.historicoSeriaisCardDisponiveis.textContent = formatInteger(disponiveis);
  refs.historicoSeriaisCardSaidas.textContent = formatInteger(comSaida);

  if (!historicoSeriaisDashboardCache.length) {
    refs.historicoSeriaisTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum numero de serie registrado ainda.</td></tr>';
    return;
  }

  if (!registros.length) {
    refs.historicoSeriaisTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum registro encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.historicoSeriaisTbody.innerHTML = registros.map((registro) => `
    <tr>
      <td class="table-code">${escapeHtml(registro.numero_serie || '-')}</td>
      <td class="table-description">
        ${escapeHtml(registro.modelo_servo_descricao || '-')}
        ${registro.modelo_servo_codigo ? `<div class="table-subtext">${escapeHtml(registro.modelo_servo_codigo)}</div>` : ''}
      </td>
      <td>${formatarDataHora(registro.data_montagem)}</td>
      <td>${escapeHtml(registro.montador_nome || '-')}</td>
      <td>${renderizarPedidoHistoricoSerialDashboard(registro)}</td>
      <td>${formatarDataHora(registro.data_saida)}</td>
    </tr>
  `).join('');
}

function renderizarTabelaSaidas(items) {
  if (!items.length) {
    refs.saidasTbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhuma saida registrada.</td></tr>';
    return;
  }

  refs.saidasTbody.innerHTML = items.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_saida)}</td>
    </tr>
  `).join('');
}

function renderizarTabelaMaquinas(items) {
  if (!items.length) {
    refs.maquinasTbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum historico de producao finalizada.</td></tr>';
    return;
  }

  refs.maquinasTbody.innerHTML = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.maquina_nome)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_produzida)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_refugo)}</td>
    </tr>
  `).join('');
}

function renderizarTabelaDestaques(maiores, menores) {
  const linhas = [];

  maiores.slice(0, 5).forEach((item) => {
    linhas.push(`
      <tr>
        <td>Maior</td>
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(`${item.descricao} | ${item.estoque_nome}`)}</td>
        <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      </tr>
    `);
  });

  menores.slice(0, 5).forEach((item) => {
    linhas.push(`
      <tr>
        <td>Menor</td>
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(`${item.descricao} | ${item.estoque_nome}`)}</td>
        <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      </tr>
    `);
  });

  refs.destaquesTbody.innerHTML = linhas.length
    ? linhas.join('')
    : '<tr><td colspan="4" class="empty-state">Nenhum destaque de estoque encontrado.</td></tr>';
}

function renderizarSugestoesSubmontagem(termo) {
  const filtro = normalizarBusca(termo);
  const itens = submontagensCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao}`).includes(filtro);
  }).sort((a, b) => compararPorPrioridadeCodigo(a, b, filtro)).slice(0, 8);

  if (!itens.length) {
    refs.simulacaoSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma submontagem encontrada.</div>';
    refs.simulacaoSugestoes.classList.remove('hidden');
    return;
  }

  refs.simulacaoSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`Componentes: ${item.total_componentes || 0} | Massa: ${formatDecimal(item.massa_kg)} kg`)}</span>
    </button>
  `).join('');
  refs.simulacaoSugestoes.classList.remove('hidden');
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

function handleSugestaoSubmontagemClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = submontagensCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.simulacaoSubmontagemId.value = String(item.id);
  refs.simulacaoSubmontagemBusca.value = `${item.codigo} - ${item.descricao}`;
  esconderSugestoesSubmontagem();
}

async function handleSimulacaoSubmit(event) {
  event.preventDefault();

  if (!refs.simulacaoSubmontagemId.value) {
    mostrarMensagemSimulacao('Selecione uma submontagem valida.', 'error');
    return;
  }

  try {
    const quantidade = Math.max(1, Number.parseInt(refs.simulacaoQuantidade.value, 10) || 1);
    const response = await fetch(`${submontagensApiBaseUrl}/${refs.simulacaoSubmontagemId.value}/simulacao?quantidade=${quantidade}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel gerar a simulacao.');
    }

    renderizarResultadoSimulacao(result);
    mostrarMensagemSimulacao('Simulacao atualizada.', 'success');
  } catch (error) {
    mostrarMensagemSimulacao(error.message, 'error');
  }
}

function renderizarResultadoSimulacao(result) {
  refs.simulacaoCardPronto.textContent = formatInteger(result.saldo_pronto_total);
  refs.simulacaoCardCapacidade.textContent = formatInteger(result.capacidade_total);
  refs.simulacaoCardStatus.textContent = result.pode_montar_quantidade_desejada ? 'Sim' : 'Nao';
  refs.simulacaoTitulo.textContent = `${result.submontagem.codigo} - ${result.submontagem.descricao}`;
  refs.simulacaoSubtitulo.textContent = `Quantidade desejada: ${formatInteger(result.quantidade_desejada)} | Massa: ${formatDecimal(result.submontagem.massa_kg)} kg`;

  refs.simulacaoResumo.classList.remove('empty');
  refs.simulacaoResumo.classList.add('selected-tags');
  refs.simulacaoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`Saldo pronto: ${formatInteger(result.saldo_pronto_total)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Capacidade total: ${formatInteger(result.capacidade_total)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Consegue montar: ${result.pode_montar_quantidade_desejada ? 'SIM' : 'NAO'}`)}</span>
    <span class="selected-tag">${escapeHtml(buildLimitanteLabel(result.componente_limitante))}</span>
  `;

  if (!result.componentes.length) {
    refs.simulacaoTbody.innerHTML = '<tr><td colspan="9" class="empty-state">A submontagem nao possui componentes.</td></tr>';
    return;
  }

  refs.simulacaoTbody.innerHTML = result.componentes.map((item) => {
    const almox = getStockQuantity(item, 'almox');
    const montagem = getStockQuantity(item, 'mont');
    const expedicao = getStockQuantity(item, 'exped');

    return `
      <tr class="${item.pode_atender_quantidade_desejada ? '' : 'table-row-attention'}">
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(item.descricao)}</td>
        <td class="table-quantity">${formatInteger(item.quantidade_estrutura)}</td>
        <td class="table-quantity">${formatInteger(item.quantidade_necessaria)}</td>
        <td class="table-quantity">${formatInteger(almox)}</td>
        <td class="table-quantity">${formatInteger(montagem)}</td>
        <td class="table-quantity">${formatInteger(expedicao)}</td>
        <td class="table-quantity">${formatInteger(item.total_disponivel)}</td>
        <td class="table-quantity">${formatInteger(item.capacidade_total)}</td>
      </tr>
    `;
  }).join('');
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
      await Promise.all([
        carregarDashboard(),
        carregarEstoquesDetalhados(),
        carregarAlertasAlmox(),
        carregarMateriasPrimas()
      ]);
      if (!refs.pedidosModal.classList.contains('hidden')) {
        await carregarPedidosDashboard();
      }
      if (!refs.historicoPedidosModal.classList.contains('hidden')) {
        await carregarHistoricoPedidosDashboard();
      }
      if (!refs.servosModal.classList.contains('hidden')) {
        await carregarServosDashboard();
      }
      if (!refs.historicoSeriaisModal.classList.contains('hidden')) {
        await carregarHistoricoSeriaisDashboard();
      }
    } catch (error) {
      console.error('Falha ao atualizar o dashboard:', error);
    }
  }, AUTO_REFRESH_MS);
}

function handleBackdrop(event) {
  const modalName = event.target.dataset.closeModal;
  if (modalName === 'dashboard-estoques') {
    closeModal(refs.estoquesModal);
  }
  if (modalName === 'dashboard-mp') {
    closeModal(refs.mpModal);
  }
  if (modalName === 'dashboard-fornecedores') {
    closeModal(refs.fornecedoresModal);
  }
  if (modalName === 'dashboard-simulacao') {
    closeModal(refs.simulacaoModal);
  }
  if (modalName === 'dashboard-indicadores') {
    closeModal(refs.indicadoresModal);
  }
  if (modalName === 'dashboard-pedidos') {
    closeModal(refs.pedidosModal);
  }
  if (modalName === 'dashboard-historico-pedidos') {
    closeModal(refs.historicoPedidosModal);
  }
  if (modalName === 'dashboard-pedido-detalhe') {
    closeModal(refs.pedidoDetalheModal);
  }
  if (modalName === 'dashboard-servos') {
    closeModal(refs.servosModal);
  }
  if (modalName === 'dashboard-historico-seriais') {
    closeModal(refs.historicoSeriaisModal);
  }
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  if (!refs.indicadoresModal.classList.contains('hidden')) {
    closeModal(refs.indicadoresModal);
    return;
  }

  if (!refs.servosModal.classList.contains('hidden')) {
    closeModal(refs.servosModal);
    return;
  }

  if (!refs.historicoSeriaisModal.classList.contains('hidden')) {
    closeModal(refs.historicoSeriaisModal);
    return;
  }

  if (!refs.pedidoDetalheModal.classList.contains('hidden')) {
    closeModal(refs.pedidoDetalheModal);
    return;
  }

  if (!refs.historicoPedidosModal.classList.contains('hidden')) {
    closeModal(refs.historicoPedidosModal);
    return;
  }

  if (!refs.pedidosModal.classList.contains('hidden')) {
    closeModal(refs.pedidosModal);
    return;
  }

  if (!refs.simulacaoModal.classList.contains('hidden')) {
    closeModal(refs.simulacaoModal);
    return;
  }

  if (!refs.mpModal.classList.contains('hidden')) {
    closeModal(refs.mpModal);
    return;
  }

  if (!refs.fornecedoresModal.classList.contains('hidden')) {
    closeModal(refs.fornecedoresModal);
    return;
  }

  if (!refs.estoquesModal.classList.contains('hidden')) {
    closeModal(refs.estoquesModal);
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
  const hasModal = [refs.estoquesModal, refs.mpModal, refs.fornecedoresModal, refs.simulacaoModal, refs.indicadoresModal, refs.pedidosModal, refs.historicoPedidosModal, refs.pedidoDetalheModal, refs.servosModal, refs.historicoSeriaisModal]
    .some((entry) => !entry.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

async function abrirModalFornecedores() {
  try {
    await carregarFornecedores();
    refs.fornecedoresMensagem.className = 'message hidden';
    refs.fornecedoresMensagem.textContent = '';
    renderizarFornecedores();
    openModal(refs.fornecedoresModal);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function fecharModalFornecedores() {
  closeModal(refs.fornecedoresModal);
}

async function abrirModalPedidosDashboard() {
  try {
    refs.pedidosTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Carregando pedidos ativos...</td></tr>';
    openModal(refs.pedidosModal);
    await carregarPedidosDashboard();
  } catch (error) {
    refs.pedidosTbody.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function abrirModalHistoricoPedidosDashboard() {
  try {
    refs.historicoPedidosTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Carregando historico de pedidos...</td></tr>';
    openModal(refs.historicoPedidosModal);
    await carregarHistoricoPedidosDashboard();
  } catch (error) {
    refs.historicoPedidosTbody.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function abrirModalServosDashboard() {
  try {
    openModal(refs.servosModal);
    await carregarServosDashboard();
  } catch (error) {
    refs.servosTbody.innerHTML = `<tr><td colspan="2" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function abrirModalHistoricoSeriaisDashboard() {
  try {
    refs.historicoSeriaisTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Carregando historico de numeros...</td></tr>';
    openModal(refs.historicoSeriaisModal);
    await carregarHistoricoSeriaisDashboard();
  } catch (error) {
    refs.historicoSeriaisTbody.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

function handlePedidosDashboardClick(event) {
  const trigger = event.target.closest('[data-dashboard-pedido-id]');
  if (!trigger) {
    return;
  }

  const pedidoId = Number(trigger.dataset.dashboardPedidoId);
  const pedido = pedidosDashboardCache.find((item) => Number(item.id) === pedidoId);
  if (!pedido) {
    mostrarMensagem('Pedido nao encontrado na consulta atual.', 'error');
    return;
  }

  renderizarDetalhePedidoDashboard(pedido);
  openModal(refs.pedidoDetalheModal);
}

function handleHistoricoPedidosDashboardClick(event) {
  const trigger = event.target.closest('[data-dashboard-historico-pedido-id]');
  if (!trigger) {
    return;
  }

  const pedidoId = Number(trigger.dataset.dashboardHistoricoPedidoId);
  const pedido = historicoPedidosDashboardCache.find((item) => Number(item.id) === pedidoId);
  if (!pedido) {
    mostrarMensagem('Pedido nao encontrado no historico atual.', 'error');
    return;
  }

  renderizarDetalhePedidoDashboard(pedido);
  openModal(refs.pedidoDetalheModal);
}

async function alternarEscopoServosDashboard(escopo) {
  if (servosDashboardEscopo === escopo) {
    return;
  }

  servosDashboardEscopo = escopo;
  refs.servosBtnDia.classList.toggle('is-active', servosDashboardEscopo === 'dia');
  refs.servosBtnGlobal.classList.toggle('is-active', servosDashboardEscopo === 'global');
  await carregarServosDashboard();
}

function handleGlobalClick(event) {
  if (!event.target.closest('.autocomplete')) {
    esconderSugestoesSubmontagem();
  }
}

function obterEstoquesDetalhadosFiltrados() {
  const filtroEstoque = normalizarBusca(refs.estoquesFiltroEstoque.value.trim());
  const filtroCodigo = normalizarBusca(refs.estoquesFiltroCodigo.value.trim());
  const filtroDescricao = normalizarBusca(refs.estoquesFiltroDescricao.value.trim());
  const filtroClassificacao = String(refs.estoquesFiltroClassificacao.value || '').trim().toUpperCase();
  const filtroFornecedor = normalizarBusca(refs.estoquesFiltroFornecedor.value.trim());
  const filtroEstado = String(refs.estoquesFiltroEstado.value || '').trim().toUpperCase();
  const ordem = refs.estoquesFiltroOrdem.value;

  const registros = obterRegistrosDetalhadosDashboard().filter((item) => {
    if (filtroEstoque && normalizarBusca(item.estoque_nome) !== filtroEstoque) {
      return false;
    }

    if (filtroCodigo && !normalizarBusca(item.codigo).includes(filtroCodigo)) {
      return false;
    }

    if (filtroDescricao && !normalizarBusca(item.descricao).includes(filtroDescricao)) {
      return false;
    }

    if (filtroClassificacao && String(item.classificacao || '').toUpperCase() !== filtroClassificacao) {
      return false;
    }

    if (filtroFornecedor && !normalizarBusca(obterFornecedorLabel(item)).includes(filtroFornecedor)) {
      return false;
    }

    if (filtroEstado && !item.aplica_prioridade) {
      return false;
    }

    if (filtroEstado && String(item.estado_necessidade || '').toUpperCase() !== filtroEstado) {
      return false;
    }

    return true;
  });

  if (ordem === 'asc') {
    registros.sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));
  } else if (ordem === 'desc') {
    registros.sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0));
  }

  return registros;
}

function obterRegistrosDetalhadosDashboard() {
  const registros = [];
  const idsExistentes = new Set();
  const prioridadesPorChave = new Map(
    alertasAlmoxCache.map((item) => [`${normalizarBusca(item.estoque_nome)}:${Number(item.id_peca)}`, item])
  );

  estoquesDetalhadosCache.forEach((item) => {
    const aplicaPrioridade = normalizarBusca(item.estoque_nome).includes('almox');
    const prioridade = aplicaPrioridade
      ? prioridadesPorChave.get(`${normalizarBusca(item.estoque_nome)}:${Number(item.id_peca)}`) || null
      : null;

    registros.push({
      ...item,
      quantidade: Number(prioridade?.quantidade ?? item.quantidade ?? 0),
      quantidade_saida_mes: aplicaPrioridade ? Number(prioridade?.quantidade_saida_mes ?? item.consumo_mensal ?? 0) : null,
      dias_cobertura: aplicaPrioridade ? prioridade?.dias_cobertura ?? null : null,
      data_prevista_ruptura: aplicaPrioridade ? prioridade?.data_prevista_ruptura ?? null : null,
      estado_necessidade: aplicaPrioridade ? String(prioridade?.estado_necessidade || 'NORMAL').toUpperCase() : '',
      aplica_prioridade: aplicaPrioridade
    });

    idsExistentes.add(`${normalizarBusca(item.estoque_nome)}:${Number(item.id_peca)}`);
  });

  obterAlertasAlmoxOperacionais().forEach((item) => {
    const key = `${normalizarBusca(item.estoque_nome)}:${Number(item.id_peca)}`;
    if (idsExistentes.has(key)) {
      return;
    }

    registros.push({
      ...item,
      quantidade: Number(item.quantidade || 0),
      quantidade_saida_mes: Number(item.quantidade_saida_mes || 0),
      dias_cobertura: item.dias_cobertura ?? null,
      data_prevista_ruptura: item.data_prevista_ruptura ?? null,
      estado_necessidade: String(item.estado_necessidade || 'NORMAL').toUpperCase(),
      aplica_prioridade: true
    });
  });

  return registros;
}

function obterMateriasPrimasFiltradas() {
  const filtroCodigo = normalizarBusca(refs.mpFiltroCodigo.value.trim());
  const filtroNome = normalizarBusca(refs.mpFiltroNome.value.trim());
  const filtroCategoria = String(refs.mpFiltroCategoria.value || '').trim().toUpperCase();
  const filtroGeometria = normalizarBusca(refs.mpFiltroGeometria.value.trim());
  const ordem = refs.mpFiltroOrdem.value;

  const registros = materiasPrimasCache.filter((item) => {
    if (filtroCodigo && !normalizarBusca(item.codigo).includes(filtroCodigo)) {
      return false;
    }

    if (filtroNome && !normalizarBusca(item.nome).includes(filtroNome)) {
      return false;
    }

    if (filtroCategoria && String(item.categoria || '').toUpperCase() !== filtroCategoria) {
      return false;
    }

    if (filtroGeometria && !normalizarBusca(item.geometria).includes(filtroGeometria)) {
      return false;
    }

    return true;
  });

  if (ordem === 'asc') {
    registros.sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));
  } else if (ordem === 'desc') {
    registros.sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0));
  }

  return registros;
}

function renderizarEstadoNecessidade(estado, aplicaPrioridade = true) {
  if (!aplicaPrioridade) {
    return '-';
  }

  const normalized = String(estado || '').toUpperCase();
  let cssClass = 'status-chip';

  if (normalized === 'CRITICO') {
    cssClass += ' is-danger';
  } else if (normalized === 'ATENCAO') {
    cssClass += ' is-warning';
  } else if (normalized === 'OBSERVAR') {
    cssClass += ' is-info';
  } else if (normalized === 'NORMAL') {
    cssClass += ' is-success';
  }

  return `<span class="${cssClass}">${escapeHtml(normalized || '-')}</span>`;
}

function formatarDataCurta(value) {
  if (!value) {
    return '-';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return formatDateOnlyText(value);
  }

  const data = new Date(value);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleDateString('pt-BR');
}

function formatarDuracaoPrioridade(item) {
  if (!item?.aplica_prioridade) {
    return '-';
  }

  const dias = Number(item.dias_cobertura);
  const dataPrevista = formatarDataCurta(item.data_prevista_ruptura);

  if (!Number.isFinite(dias) && dataPrevista === '-') {
    return 'Sem prev.';
  }

  if (!Number.isFinite(dias)) {
    return dataPrevista;
  }

  return `${formatRoundedDays(dias)}d | ${dataPrevista}`;
}

function formatRoundedDays(value) {
  return String(Math.max(0, Math.round(Number(value) || 0)));
}

function getStockQuantity(item, key) {
  const row = item.saldos_por_estoque.find((entry) => normalizarBusca(entry.estoque_nome).includes(key));
  return row ? Number(row.quantidade || 0) : 0;
}

function buildLimitanteLabel(limitante) {
  if (!limitante) {
    return 'Limitante: nao identificado';
  }

  return `Limitante: ${limitante.codigo} | Capacidade ${formatInteger(limitante.capacidade_total)}`;
}

function esconderSugestoesSubmontagem() {
  refs.simulacaoSugestoes.classList.add('hidden');
  refs.simulacaoSugestoes.innerHTML = '';
}

function limparFiltrosEstoque() {
  refs.estoquesFiltroForm.reset();
  renderizarTabelaEstoquesDetalhados();
}

function limparFiltrosMp() {
  refs.mpFiltroForm.reset();
  renderizarTabelaMateriaPrima();
}

function limparFiltrosFornecedores() {
  refs.fornecedoresFiltroForm.reset();
  renderizarFornecedores();
}

function limparFiltrosPedidosDashboard() {
  refs.pedidosFiltroForm.reset();
  renderizarPedidosDashboard();
}

function limparFiltrosHistoricoPedidosDashboard() {
  refs.historicoPedidosFiltroForm.reset();
  renderizarHistoricoPedidosDashboard();
}

function limparFiltrosHistoricoSeriaisDashboard() {
  refs.historicoSeriaisFiltroForm.reset();
  carregarHistoricoSeriaisDashboard().catch((error) => {
    refs.historicoSeriaisTbody.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  });
}

function obterPedidosDashboardFiltrados() {
  const busca = normalizarBusca(refs.pedidosFiltroBusca.value.trim());
  const status = String(refs.pedidosFiltroStatus.value || '').trim().toUpperCase();

  return pedidosDashboardCache
    .filter((pedido) => pedido.status !== 'PEDIDO COLETADO')
    .filter((pedido) => {
      if (status && String(pedido.status || '').toUpperCase() !== status) {
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
    })
    .sort((a, b) => {
      const aHoje = isPedidoProgramadoHoje(a);
      const bHoje = isPedidoProgramadoHoje(b);
      if (aHoje !== bHoje) {
        return aHoje ? -1 : 1;
      }

      return Number(a.prioridade_ordem || 0) - Number(b.prioridade_ordem || 0)
        || Number(a.id || 0) - Number(b.id || 0);
    });
}

function obterHistoricoPedidosDashboardFiltrados() {
  const busca = normalizarBusca(refs.historicoPedidosFiltroBusca.value.trim());
  const transportadora = normalizarBusca(refs.historicoPedidosFiltroTransportadora.value.trim());
  const data = String(refs.historicoPedidosFiltroData.value || '').trim();

  return historicoPedidosDashboardCache
    .filter((pedido) => {
      if (transportadora && !normalizarBusca(pedido.transportadora).includes(transportadora)) {
        return false;
      }

      if (data && normalizeDateInput(pedido.data_coleta || pedido.data_pedido) !== data) {
        return false;
      }

      if (!busca) {
        return true;
      }

      return [
        pedido.codigo_pedido,
        pedido.cliente_nome,
        pedido.cidade,
        pedido.vendedora
      ].some((value) => normalizarBusca(value).includes(busca));
    })
    .sort((a, b) => {
      const dataA = new Date(a.data_coleta || a.data_pedido || 0).getTime();
      const dataB = new Date(b.data_coleta || b.data_pedido || 0).getTime();
      return dataB - dataA || Number(b.id || 0) - Number(a.id || 0);
    });
}

function obterHistoricoSeriaisDashboardFiltrado() {
  const numero = normalizarBusca(refs.historicoSeriaisFiltroNumero.value.trim());
  const modelo = normalizarBusca(refs.historicoSeriaisFiltroModelo.value.trim());
  const montador = normalizarBusca(refs.historicoSeriaisFiltroMontador.value.trim());
  const clientePedido = normalizarBusca(refs.historicoSeriaisFiltroClientePedido.value.trim());
  const data = String(refs.historicoSeriaisFiltroData.value || '').trim();
  const situacao = String(refs.historicoSeriaisFiltroSituacao.value || '').trim();

  return historicoSeriaisDashboardCache.filter((registro) => {
    if (numero && !normalizarBusca(registro.numero_serie).includes(numero)) {
      return false;
    }

    if (modelo && !normalizarBusca(`${registro.modelo_servo_codigo} ${registro.modelo_servo_descricao}`).includes(modelo)) {
      return false;
    }

    if (montador && !normalizarBusca(registro.montador_nome).includes(montador)) {
      return false;
    }

    if (clientePedido && !normalizarBusca(`${registro.cliente_nome} ${registro.numero_pedido}`).includes(clientePedido)) {
      return false;
    }

    if (data && normalizeDateInput(registro.data_montagem) !== data) {
      return false;
    }

    if (situacao === 'disponivel' && registro.data_saida) {
      return false;
    }

    if (situacao === 'com_saida' && !registro.data_saida) {
      return false;
    }

    return true;
  });
}

function isPedidoProgramadoHoje(pedido) {
  return normalizeDateInput(pedido?.data_programacao_saida) === normalizeDateInput(new Date());
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

  const data = new Date(text);
  return Number.isNaN(data.getTime()) ? '' : data.toISOString().slice(0, 10);
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

function renderizarStatusPedidoDashboard(pedido) {
  const texto = obterTextoStatusPedidoDashboard(pedido);
  let cssClass = 'status-chip';

  if (texto === 'Faltam itens') {
    cssClass += ' is-danger';
  } else if (texto === 'AGUARDANDO NF') {
    cssClass += ' is-warning';
  } else if (texto === 'AGUARDANDO TRANSPORTADORA') {
    cssClass += ' is-success';
  } else if (texto === 'EM MONTAGEM') {
    cssClass += ' is-info';
  }

  return `<span class="${cssClass}">${escapeHtml(texto)}</span>`;
}

function obterTextoStatusPedidoDashboard(pedido) {
  if (!pedido?.pode_atender && ['AGUARDANDO MONTAGEM', 'EM MONTAGEM'].includes(pedido?.status)) {
    return 'Faltam itens';
  }

  return pedido?.status || 'AGUARDANDO MONTAGEM';
}

function renderizarStatusItemPedidoDashboard(item) {
  const texto = item.concluido ? 'Concluido' : item.pode_atender ? 'Disponivel' : 'Pendente';
  let cssClass = 'status-chip';

  if (texto === 'Concluido') {
    cssClass += ' is-success';
  } else if (texto === 'Disponivel') {
    cssClass += ' is-info';
  } else {
    cssClass += ' is-warning';
  }

  return `<span class="${cssClass}">${escapeHtml(texto)}</span>`;
}

function formatarSeriaisItemPedidoDashboard(item) {
  if (!item.exige_numero_serie) {
    return '-';
  }

  const vinculados = Array.isArray(item.seriais_vinculados) ? item.seriais_vinculados.length : 0;
  const necessarios = Number(item.quantidade_seriais_necessarios || item.quantidade || 0);
  return `${formatInteger(vinculados)}/${formatInteger(necessarios)}`;
}

function renderizarComponentesItemPedidoDashboard(item) {
  const componentes = [];

  if (item.componente_serial) {
    componentes.push(`${item.componente_serial.codigo || '-'} x ${formatDecimal(item.quantidade_seriais_necessarios || 0)}`);
  }

  (item.componentes_avulsos || []).forEach((componente) => {
    const quantidade = Number(item.quantidade || 0) * Number(componente.quantidade_por_item_venda || 0);
    componentes.push(`${componente.codigo || '-'} x ${formatDecimal(quantidade)}`);
  });

  if (!componentes.length) {
    return '-';
  }

  return componentes
    .slice(0, 4)
    .map((componente) => `<span class="dashboard-detail-chip">${escapeHtml(componente)}</span>`)
    .join('') + (componentes.length > 4 ? `<span class="dashboard-detail-chip">+${componentes.length - 4}</span>` : '');
}

function renderServoMetricCell(value, extraClass = '') {
  const number = Number(value || 0);
  const isZero = number === 0;
  return `<td class="servo-sheet-cell ${extraClass} ${isZero ? 'is-zero' : 'is-valued'}">${formatServoNumberOrEmpty(number)}</td>`;
}

function renderServoMateriaPrimaCell(materiaPrima) {
  const quantidade = Number(materiaPrima?.quantidade || 0);
  if (!quantidade) {
    return `<td class="servo-sheet-cell is-dash" title="${escapeHtml(materiaPrima?.codigo || '-')}">-</td>`;
  }

  return `
    <td class="servo-sheet-cell is-valued" title="${escapeHtml(`${materiaPrima.codigo || '-'} ${materiaPrima.unidade || ''}`.trim())}">
      ${formatServoNumber(quantidade)}
    </td>
  `;
}

function renderizarPedidoHistoricoSerialDashboard(registro) {
  if (!registro.numero_pedido) {
    return '-';
  }

  return `
    <span class="table-description">${escapeHtml(registro.cliente_nome || 'Sem cliente')}</span>
    <div class="table-subtext">${escapeHtml(registro.numero_pedido)}</div>
  `;
}

function obterTotalItensPedidoDashboard(pedido) {
  if (Number(pedido?.total_itens || 0) > 0) {
    return Number(pedido.total_itens || 0);
  }

  return Array.isArray(pedido?.itens)
    ? pedido.itens.reduce((sum, item) => sum + Number(item.quantidade || 0), 0)
    : 0;
}

function formatServoNumber(value) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) {
    return String(number);
  }

  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatServoNumberOrEmpty(value) {
  const number = Number(value || 0);
  return number === 0 ? '' : formatServoNumber(number);
}

function obterAlertasAlmoxOperacionais() {
  return alertasAlmoxCache.filter((item) => String(item.estado_necessidade || '').toUpperCase() !== 'NORMAL');
}

function obterFornecedorLabel(item) {
  return String(item?.fornecedores_nomes || item?.fornecedor_nome || '-').trim() || '-';
}

function obterFornecedorLabelCompacto(item) {
  const fornecedores = obterFornecedorLabel(item)
    .split(',')
    .map((nome) => nome.trim())
    .filter(Boolean)
    .filter((nome) => !normalizarBusca(nome).includes('california'));

  if (!fornecedores.length) {
    return '-';
  }

  return fornecedores.join(', ');
}

function buildBitolaLabel(item) {
  const polegada = String(item.bitola || '').trim();
  const mm = Number(item.bitola_mm || 0);

  if (polegada && mm > 0) {
    return `${polegada} | ${mm.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} mm`;
  }

  if (polegada) {
    return polegada;
  }

  if (mm > 0) {
    return `${mm.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} mm`;
  }

  return '-';
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

function formatMpQuantity(value, unidadeControle) {
  return `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })} ${escapeHtml(String(unidadeControle || '').toLowerCase() === 'barra' ? 'barras' : (unidadeControle || ''))}`.trim();
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function mostrarMensagemSimulacao(texto, tipo) {
  refs.simulacaoMensagem.textContent = texto;
  refs.simulacaoMensagem.className = `message ${tipo}`;
  refs.simulacaoMensagem.classList.remove('hidden');
}

function normalizarBusca(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatarDataHora(value) {
  if (!value) {
    return '-';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return formatDateOnlyText(value);
  }

  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? '-' : data.toLocaleString('pt-BR');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
