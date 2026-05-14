const estoquesApiBaseUrl = '/api/estoques';
const estoqueItensApiBaseUrl = '/api/estoque/itens';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const estoquePrioridadesApiBaseUrl = '/api/estoque/prioridades';
const estoqueMovimentacoesApiBaseUrl = '/api/estoque/movimentacoes';
const estoqueEntradaApiBaseUrl = '/api/estoque/entrada-inicial';
const estoqueTransferenciaApiBaseUrl = '/api/estoque/transferencia';
const estoqueConsumoInternoApiBaseUrl = '/api/estoque/consumo-interno';
const fornecedoresApiBaseUrl = '/api/fornecedores';
const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';
const terceirizacaoApiBaseUrl = '/api/terceirizacao';
const estoqueMateriaPrimaApiBaseUrl = '/api/estoque-materias-primas';
const materiasPrimasAutocompleteApiBaseUrl = '/api/materias-primas-autocomplete';
const producaoApiBaseUrl = '/api/producao';
const AUTO_REFRESH_MS = 15000;
const RECEBIMENTO_DESTINO_ESTOQUE_MP = 'ESTOQUE_MP';

let estoquesCache = [];
let saldosAlmoxCache = [];
let prioridadesAlmoxCache = [];
let solicitacoesCache = [];
let tratamentoCache = [];
let historicoCache = [];
let producaoCache = [];
let materiasPrimasCache = [];
let itensEstoqueCache = [];
let fornecedoresCache = [];
let autoRefreshHandle = null;
const ACTIVE_REQUEST_STATUSES = ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'];
const CLOSED_REQUEST_STATUSES = ['ATENDIDA', 'CANCELADA'];

// Alerta visual na aba quando entrar pedido novo (Expedicao/Montagem) para o Almoxarifado.
let lastActiveRequestKeyset = new Set();
let tabFlashHandle = null;
let tabFlashOriginalTitle = document.title;
let tabFlashToggle = false;
let lastDingAt = 0;
const DING_COOLDOWN_MS = 8000;
let beepHandle = null;
const BEEP_INTERVAL_MS = 2000;

const refs = {
  mensagem: document.getElementById('almox-mensagem'),
  estoqueTbody: document.getElementById('almox-estoque-tbody'),
  estoqueTotal: document.getElementById('almox-estoque-total'),
  filtroCodigo: document.getElementById('almox-filtro-codigo'),
  filtroDescricao: document.getElementById('almox-filtro-descricao'),
  filtroFornecedor: document.getElementById('almox-filtro-fornecedor'),
  filtroClassificacao: document.getElementById('almox-filtro-classificacao'),
  filtroEstado: document.getElementById('almox-filtro-estado'),
  filtroQuantidade: document.getElementById('almox-filtro-quantidade'),
  badgePedidos: document.getElementById('almox-badge-pedidos'),
  badgeTratamento: document.getElementById('almox-badge-tratamento'),
  badgeProducao: document.getElementById('almox-badge-producao'),
  fornecedoresModal: document.getElementById('almox-fornecedores-modal'),
  fornecedoresMensagem: document.getElementById('almox-fornecedores-mensagem'),
  fornecedoresTotal: document.getElementById('almox-fornecedores-total'),
  fornecedoresFiltroForm: document.getElementById('almox-fornecedores-filtro-form'),
  fornecedoresFiltroNome: document.getElementById('almox-fornecedores-filtro-nome'),
  fornecedoresFiltroPeca: document.getElementById('almox-fornecedores-filtro-peca'),
  fornecedoresFiltroContato: document.getElementById('almox-fornecedores-filtro-contato'),
  fornecedoresFiltroCidade: document.getElementById('almox-fornecedores-filtro-cidade'),
  fornecedoresTbody: document.getElementById('almox-fornecedores-tbody'),
  entradaManualModal: document.getElementById('almox-entrada-manual-modal'),
  entradaManualMensagem: document.getElementById('almox-entrada-manual-mensagem'),
  entradaManualBusca: document.getElementById('almox-entrada-manual-busca'),
  entradaManualSugestoes: document.getElementById('almox-entrada-manual-sugestoes'),
  entradaManualIdItem: document.getElementById('almox-entrada-manual-id-item'),
  entradaManualResumo: document.getElementById('almox-entrada-manual-resumo'),
  entradaManualQuantidade: document.getElementById('almox-entrada-manual-quantidade'),
  entradaManualObservacao: document.getElementById('almox-entrada-manual-observacao'),
  transferenciaModal: document.getElementById('almox-transferencia-modal'),
  transferenciaMensagem: document.getElementById('almox-transferencia-mensagem'),
  transferenciaBusca: document.getElementById('almox-transferencia-busca'),
  transferenciaSugestoes: document.getElementById('almox-transferencia-sugestoes'),
  transferenciaIdItem: document.getElementById('almox-transferencia-id-item'),
  transferenciaResumo: document.getElementById('almox-transferencia-resumo'),
  transferenciaOrigem: document.getElementById('almox-transferencia-origem'),
  transferenciaDestino: document.getElementById('almox-transferencia-destino'),
  transferenciaQuantidade: document.getElementById('almox-transferencia-quantidade'),
  transferenciaObservacao: document.getElementById('almox-transferencia-observacao'),
  consumoInternoModal: document.getElementById('almox-consumo-interno-modal'),
  consumoInternoMensagem: document.getElementById('almox-consumo-interno-mensagem'),
  consumoInternoBusca: document.getElementById('almox-consumo-interno-busca'),
  consumoInternoSugestoes: document.getElementById('almox-consumo-interno-sugestoes'),
  consumoInternoIdItem: document.getElementById('almox-consumo-interno-id-item'),
  consumoInternoResumo: document.getElementById('almox-consumo-interno-resumo'),
  consumoInternoQuantidade: document.getElementById('almox-consumo-interno-quantidade'),
  consumoInternoResponsavel: document.getElementById('almox-consumo-interno-responsavel'),
  consumoInternoObservacao: document.getElementById('almox-consumo-interno-observacao'),
  pedidosModal: document.getElementById('almox-pedidos-modal'),
  pedidosTotal: document.getElementById('almox-pedidos-total'),
  pedidosTbody: document.getElementById('almox-pedidos-tbody'),
  pedidosFiltroSituacao: document.getElementById('almox-pedidos-filtro-situacao'),
  pedidosFiltroQ: document.getElementById('almox-pedidos-filtro-q'),
  pedidosFiltroStatus: document.getElementById('almox-pedidos-filtro-status'),
  atendimentoModal: document.getElementById('almox-atendimento-modal'),
  atendimentoMensagem: document.getElementById('almox-atendimento-mensagem'),
  atendimentoId: document.getElementById('almox-atendimento-id'),
  atendimentoResumo: document.getElementById('almox-atendimento-resumo'),
  atendimentoQuantidade: document.getElementById('almox-atendimento-quantidade'),
  atendimentoObservacao: document.getElementById('almox-atendimento-observacao'),
  tratamentoModal: document.getElementById('almox-tratamento-modal'),
  tratamentoTotal: document.getElementById('almox-tratamento-total'),
  tratamentoTbody: document.getElementById('almox-tratamento-tbody'),
  tratamentoFiltroCodigo: document.getElementById('almox-tratamento-filtro-codigo'),
  tratamentoFiltroDescricao: document.getElementById('almox-tratamento-filtro-descricao'),
  recebimentoModal: document.getElementById('almox-recebimento-modal'),
  recebimentoMensagem: document.getElementById('almox-recebimento-mensagem'),
  recebimentoResumo: document.getElementById('almox-recebimento-resumo'),
  recebimentoIdPeca: document.getElementById('almox-recebimento-id-item'),
  recebimentoQuantidade: document.getElementById('almox-recebimento-quantidade'),
  recebimentoDestino: document.getElementById('almox-recebimento-destino'),
  recebimentoObservacao: document.getElementById('almox-recebimento-observacao'),
  mpModal: document.getElementById('almox-mp-modal'),
  mpMensagem: document.getElementById('almox-mp-mensagem'),
  mpBusca: document.getElementById('almox-mp-busca'),
  mpSugestoes: document.getElementById('almox-mp-sugestoes'),
  mpId: document.getElementById('almox-mp-id'),
  mpResumo: document.getElementById('almox-mp-resumo'),
  mpQuantidade: document.getElementById('almox-mp-quantidade'),
  mpObservacao: document.getElementById('almox-mp-observacao'),
  historicoModal: document.getElementById('almox-historico-modal'),
  historicoTotal: document.getElementById('almox-historico-total'),
  historicoTbody: document.getElementById('almox-historico-tbody'),
  producaoModal: document.getElementById('almox-producao-modal'),
  producaoMensagem: document.getElementById('almox-producao-mensagem'),
  producaoTbody: document.getElementById('almox-producao-tbody')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();

  try {
    await carregarTudoInicial();
    iniciarAtualizacaoAutomatica();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
});

function bindEvents() {
  refs.filtroCodigo.addEventListener('input', renderizarEstoque);
  refs.filtroDescricao.addEventListener('input', renderizarEstoque);
  refs.filtroFornecedor.addEventListener('input', renderizarEstoque);
  refs.filtroClassificacao.addEventListener('change', renderizarEstoque);
  refs.filtroEstado.addEventListener('change', renderizarEstoque);
  refs.filtroQuantidade.addEventListener('change', renderizarEstoque);
  document.getElementById('almox-btn-limpar-filtros').addEventListener('click', limparFiltrosEstoque);

  document.getElementById('almox-btn-pedidos').addEventListener('click', abrirModalPedidos);
  document.getElementById('almox-btn-entrada-manual').addEventListener('click', abrirModalEntradaManual);
  document.getElementById('almox-btn-transferencia').addEventListener('click', abrirModalTransferencia);
  document.getElementById('almox-btn-consumo-interno').addEventListener('click', abrirModalConsumoInterno);
  document.getElementById('almox-btn-tratamento').addEventListener('click', abrirModalTratamento);
  document.getElementById('almox-btn-mp').addEventListener('click', abrirModalMateriaPrima);
  document.getElementById('almox-btn-fornecedores').addEventListener('click', abrirModalFornecedores);
  document.getElementById('almox-btn-historico').addEventListener('click', abrirModalHistorico);
  document.getElementById('almox-btn-producao').addEventListener('click', abrirModalProducao);

  document.getElementById('btn-fechar-modal-almox-fornecedores').addEventListener('click', fecharModalFornecedores);
  document.getElementById('almox-btn-limpar-fornecedores').addEventListener('click', limparFiltrosFornecedores);
  refs.fornecedoresFiltroForm.querySelectorAll('input').forEach((field) => {
    field.addEventListener('input', renderizarFornecedores);
  });

  document.getElementById('btn-fechar-modal-almox-entrada-manual').addEventListener('click', fecharModalEntradaManual);
  document.getElementById('btn-cancelar-modal-almox-entrada-manual').addEventListener('click', fecharModalEntradaManual);
  document.getElementById('almox-entrada-manual-form').addEventListener('submit', handleSalvarEntradaManual);
  refs.entradaManualBusca.addEventListener('input', () => {
    refs.entradaManualIdItem.value = '';
    renderizarResumoEntradaManual(null);
    renderizarSugestoesItemEstoque('entradaManual', refs.entradaManualBusca.value.trim());
  });
  refs.entradaManualBusca.addEventListener('focus', () => renderizarSugestoesItemEstoque('entradaManual', refs.entradaManualBusca.value.trim()));
  refs.entradaManualSugestoes.addEventListener('click', handleSugestaoItemEstoqueClick);

  document.getElementById('btn-fechar-modal-almox-transferencia').addEventListener('click', fecharModalTransferencia);
  document.getElementById('btn-cancelar-modal-almox-transferencia').addEventListener('click', fecharModalTransferencia);
  document.getElementById('almox-transferencia-form').addEventListener('submit', handleSalvarTransferencia);
  refs.transferenciaBusca.addEventListener('input', () => {
    refs.transferenciaIdItem.value = '';
    renderizarResumoTransferencia(null);
    renderizarSugestoesItemEstoque('transferencia', refs.transferenciaBusca.value.trim());
  });
  refs.transferenciaBusca.addEventListener('focus', () => renderizarSugestoesItemEstoque('transferencia', refs.transferenciaBusca.value.trim()));
  refs.transferenciaSugestoes.addEventListener('click', handleSugestaoItemEstoqueClick);

  document.getElementById('btn-fechar-modal-almox-consumo-interno').addEventListener('click', fecharModalConsumoInterno);
  document.getElementById('btn-cancelar-modal-almox-consumo-interno').addEventListener('click', fecharModalConsumoInterno);
  document.getElementById('almox-consumo-interno-form').addEventListener('submit', handleSalvarConsumoInterno);
  refs.consumoInternoBusca.addEventListener('input', () => {
    refs.consumoInternoIdItem.value = '';
    renderizarResumoConsumoInterno(null);
    renderizarSugestoesItemEstoque('consumoInterno', refs.consumoInternoBusca.value.trim());
  });
  refs.consumoInternoBusca.addEventListener('focus', () => renderizarSugestoesItemEstoque('consumoInterno', refs.consumoInternoBusca.value.trim()));
  refs.consumoInternoSugestoes.addEventListener('click', handleSugestaoItemEstoqueClick);

  refs.pedidosFiltroQ.addEventListener('input', renderizarPedidos);
  refs.pedidosFiltroStatus.addEventListener('change', renderizarPedidos);
  refs.pedidosFiltroSituacao.addEventListener('change', renderizarPedidos);
  document.getElementById('almox-btn-limpar-pedidos').addEventListener('click', limparFiltrosPedidos);
  document.getElementById('almox-btn-marcar-pronto-todos').addEventListener('click', marcarProntoTodosPedidos);
  refs.pedidosTbody.addEventListener('click', handlePedidosActions);

  document.getElementById('btn-fechar-modal-almox-pedidos').addEventListener('click', fecharModalPedidos);
  document.getElementById('btn-fechar-modal-almox-atendimento').addEventListener('click', fecharModalAtendimento);
  document.getElementById('btn-cancelar-modal-almox-atendimento').addEventListener('click', fecharModalAtendimento);
  document.getElementById('almox-atendimento-form').addEventListener('submit', handleAtenderSolicitacao);

  refs.tratamentoFiltroCodigo.addEventListener('input', renderizarTratamento);
  refs.tratamentoFiltroDescricao.addEventListener('input', renderizarTratamento);
  document.getElementById('almox-btn-limpar-tratamento').addEventListener('click', limparFiltrosTratamento);
  refs.tratamentoTbody.addEventListener('click', handleTratamentoActions);
  document.getElementById('btn-fechar-modal-almox-tratamento').addEventListener('click', fecharModalTratamento);

  document.getElementById('btn-fechar-modal-almox-recebimento').addEventListener('click', fecharModalRecebimento);
  document.getElementById('btn-cancelar-modal-almox-recebimento').addEventListener('click', fecharModalRecebimento);
  document.getElementById('almox-recebimento-form').addEventListener('submit', handleReceberTratamento);

  document.getElementById('btn-fechar-modal-almox-mp').addEventListener('click', fecharModalMateriaPrima);
  document.getElementById('btn-cancelar-modal-almox-mp').addEventListener('click', fecharModalMateriaPrima);
  document.getElementById('almox-mp-form').addEventListener('submit', handleSalvarEntradaMp);
  refs.mpBusca.addEventListener('input', () => {
    refs.mpId.value = '';
    renderizarResumoMateriaPrima(null);
    renderizarSugestoesMateriaPrima(refs.mpBusca.value.trim());
  });
  refs.mpBusca.addEventListener('focus', () => renderizarSugestoesMateriaPrima(refs.mpBusca.value.trim()));
  refs.mpSugestoes.addEventListener('click', handleSugestaoMateriaPrimaClick);

  document.getElementById('btn-fechar-modal-almox-historico').addEventListener('click', fecharModalHistorico);
  document.getElementById('btn-fechar-modal-almox-producao').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-almox-producao-rodape').addEventListener('click', fecharModalProducao);

  [
    refs.fornecedoresModal,
    refs.entradaManualModal,
    refs.transferenciaModal,
    refs.consumoInternoModal,
    refs.pedidosModal,
    refs.atendimentoModal,
    refs.tratamentoModal,
    refs.recebimentoModal,
    refs.mpModal,
    refs.historicoModal,
    refs.producaoModal
  ].forEach((modal) => modal.addEventListener('click', handleModalBackdrop));

  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
  window.addEventListener('focus', stopTabFlash);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      stopTabFlash();
    }
  });
}

async function carregarTudoInicial() {
  await carregarEstoques();
  await Promise.all([
    carregarEstoqueAlmox(),
    carregarPrioridadesAlmox(),
    carregarSolicitacoes(),
    carregarTratamento(),
    carregarProducaoEmAndamento()
  ]);
}

async function carregarEstoques() {
  const response = await fetch(estoquesApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os estoques.');
  }

  estoquesCache = result;
  preencherEstoquesDestino();
}

async function carregarEstoqueAlmox() {
  const almox = obterEstoqueAlmoxarifado();
  if (!almox) {
    throw new Error('Estoque do Almoxarifado nao encontrado.');
  }

  const response = await fetch(`${estoqueSaldosApiBaseUrl}?estoque=${almox.id}&modo=TODOS`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o estoque do Almoxarifado.');
  }

  saldosAlmoxCache = result;
  renderizarEstoque();
  atualizarIndicadores();
}

async function carregarPrioridadesAlmox() {
  const almox = obterEstoqueAlmoxarifado();
  if (!almox) {
    throw new Error('Estoque do Almoxarifado nao encontrado.');
  }

  const response = await fetch(`${estoquePrioridadesApiBaseUrl}?estoque=${almox.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as prioridades do Almoxarifado.');
  }

  prioridadesAlmoxCache = Array.isArray(result) ? result : [];
  renderizarEstoque();
  atualizarIndicadores();
}

async function carregarSolicitacoes() {
  const response = await fetch(`${solicitacoesApiBaseUrl}?origem_atendimento=ALMOXARIFADO`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as solicitacoes.');
  }

  // Detecta novos pedidos "ativos" (pendentes / em separacao / atendida parcial).
  detectarPedidosNovos(Array.isArray(result) ? result : []);

  solicitacoesCache = result;
  renderizarPedidos();
  atualizarIndicadores();
  atualizarBadgesMenu();
}

function detectarPedidosNovos(novaLista) {
  const ativos = novaLista.filter((item) => ACTIVE_REQUEST_STATUSES.includes(String(item.status || '').toUpperCase()));
  const keyset = new Set(ativos.map((item) => buildRequestKey(item)));

  // Primeira carga: so inicializa (nao alerta).
  if (lastActiveRequestKeyset.size === 0) {
    lastActiveRequestKeyset = keyset;
    return;
  }

  const houveNovo = [...keyset].some((key) => !lastActiveRequestKeyset.has(key));
  lastActiveRequestKeyset = keyset;

  if (!houveNovo) {
    return;
  }

  // Se a aba/janela estiver fora de foco, chama atencao.
  if (document.hidden || !document.hasFocus()) {
    startTabFlash(ativos.length);
    startBeepLoop();
  }
}

function buildRequestKey(item) {
  // id + status + pendente tende a ser o suficiente para diferenciar entradas novas/alteradas.
  const id = Number(item.id || 0);
  const status = String(item.status || '').toUpperCase();
  const pendente = Number(item.quantidade_pendente || item.pendente || 0);
  return `${id}:${status}:${pendente}`;
}

function startTabFlash(pendentes) {
  if (tabFlashHandle) {
    return;
  }

  tabFlashOriginalTitle = document.title || tabFlashOriginalTitle;
  tabFlashToggle = false;

  tabFlashHandle = window.setInterval(() => {
    tabFlashToggle = !tabFlashToggle;
    if (tabFlashToggle) {
      document.title = `(!) ${pendentes} pedido(s) | ${tabFlashOriginalTitle}`;
    } else {
      document.title = tabFlashOriginalTitle;
    }
  }, 900);
}

function stopTabFlash() {
  if (!tabFlashHandle) {
    stopBeepLoop();
    return;
  }

  window.clearInterval(tabFlashHandle);
  tabFlashHandle = null;
  document.title = tabFlashOriginalTitle;
  stopBeepLoop();
}

function startBeepLoop() {
  if (beepHandle) {
    return;
  }

  // Primeiro beep imediato, depois intervalo constante.
  playBeep();
  beepHandle = window.setInterval(() => {
    if (!document.hidden && document.hasFocus()) {
      stopBeepLoop();
      return;
    }
    playBeep();
  }, BEEP_INTERVAL_MS);
}

function stopBeepLoop() {
  if (!beepHandle) {
    return;
  }
  window.clearInterval(beepHandle);
  beepHandle = null;
}

function playBeep() {
  const now = Date.now();
  // Mantem um guard pra nao criar audio contexts em excesso caso o browser dispare eventos demais.
  if (now - lastDingAt < 300) {
    return;
  }
  lastDingAt = now;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();

    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.1;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const t0 = ctx.currentTime;
    osc.start(t0);
    gain.gain.setValueAtTime(0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.stop(t0 + 0.28);

    osc.onended = () => {
      try { ctx.close(); } catch (_) { /* ignore */ }
    };
  } catch (_) {
    // Se o navegador bloquear audio (por falta de interacao), apenas ignora.
  }
}

async function carregarTratamento() {
  const response = await fetch(`${terceirizacaoApiBaseUrl}/retornos-pendentes`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os retornos pendentes da terceirizacao.');
  }

  tratamentoCache = result;
  renderizarTratamento();
  atualizarBadgesMenu();
}

async function carregarHistoricoAlmox() {
  const almox = obterEstoqueAlmoxarifado();
  if (!almox) {
    throw new Error('Estoque do Almoxarifado nao encontrado.');
  }

  const response = await fetch(`${estoqueMovimentacoesApiBaseUrl}?estoque=${almox.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o historico do Almoxarifado.');
  }

  historicoCache = result;
  renderizarHistorico();
}

async function carregarProducaoEmAndamento() {
  const response = await fetch(`${producaoApiBaseUrl}?status=EM_ANDAMENTO`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar a producao em andamento.');
  }

  producaoCache = result;
  renderizarProducao();
  atualizarBadgesMenu();
}

async function carregarMateriasPrimas() {
  if (materiasPrimasCache.length) {
    return;
  }

  const response = await fetch(materiasPrimasAutocompleteApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as materias-primas.');
  }

  materiasPrimasCache = result;
}

async function carregarItensEstoque() {
  if (itensEstoqueCache.length) {
    return;
  }

  const response = await fetch(estoqueItensApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os itens do estoque.');
  }

  itensEstoqueCache = Array.isArray(result) ? result : [];
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

function getItemEstoqueAutocompleteConfig(tipo) {
  if (tipo === 'entradaManual') {
    return {
      input: refs.entradaManualBusca,
      panel: refs.entradaManualSugestoes
    };
  }

  if (tipo === 'consumoInterno') {
    return {
      input: refs.consumoInternoBusca,
      panel: refs.consumoInternoSugestoes
    };
  }

  return {
    input: refs.transferenciaBusca,
    panel: refs.transferenciaSugestoes
  };
}

function renderizarSugestoesItemEstoque(tipo, termo) {
  const config = getItemEstoqueAutocompleteConfig(tipo);
  const filtro = normalizarBusca(termo);
  const itens = itensEstoqueCache.filter((item) => {
    if (tipo === 'consumoInterno' && obterSaldoAlmoxarifadoItem(item.id) <= 0) {
      return false;
    }

    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.tipo || ''} ${item.classificacao || ''}`).includes(filtro);
  }).slice(0, 10);

  if (!itens.length) {
    config.panel.innerHTML = '<div class="autocomplete-empty">Nenhum item encontrado.</div>';
    config.panel.classList.remove('hidden');
    return;
  }

  config.panel.innerHTML = itens.map((item) => {
    const saldoAlmox = obterSaldoAlmoxarifadoItem(item.id);
    const subtitulo = tipo === 'consumoInterno'
      ? `${item.classificacao} | ${item.tipo} | Disponivel Almox: ${formatDecimal(saldoAlmox)}`
      : `${item.classificacao} | ${item.tipo}`;

    return `
      <button type="button" class="autocomplete-option" data-item-tipo="${escapeHtml(tipo)}" data-item-id="${item.id}">
        <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
        <span>${escapeHtml(subtitulo)}</span>
      </button>
    `;
  }).join('');
  config.panel.classList.remove('hidden');
}

function handleSugestaoItemEstoqueClick(event) {
  const option = event.target.closest('button[data-item-id][data-item-tipo]');
  if (!option) {
    return;
  }

  selecionarItemEstoquePorId(option.dataset.itemTipo, option.dataset.itemId);
}

function selecionarItemEstoquePorId(tipo, id) {
  const item = itensEstoqueCache.find((entry) => Number(entry.id) === Number(id));
  if (!item) {
    return;
  }

  if (tipo === 'entradaManual') {
    refs.entradaManualIdItem.value = String(item.id);
    refs.entradaManualBusca.value = `${item.codigo} - ${item.descricao}`;
    renderizarResumoEntradaManual(item);
  } else if (tipo === 'consumoInterno') {
    refs.consumoInternoIdItem.value = String(item.id);
    refs.consumoInternoBusca.value = `${item.codigo} - ${item.descricao}`;
    renderizarResumoConsumoInterno(item);
  } else {
    refs.transferenciaIdItem.value = String(item.id);
    refs.transferenciaBusca.value = `${item.codigo} - ${item.descricao}`;
    renderizarResumoTransferencia(item);
  }

  esconderSugestoesItemEstoque();
}

function obterSaldoAlmoxarifadoItem(idPeca) {
  const saldo = saldosAlmoxCache.find((item) => Number(item.id_peca) === Number(idPeca));
  return saldo ? Number(saldo.quantidade || 0) : 0;
}

function renderizarResumoEntradaManual(item) {
  if (!item) {
    refs.entradaManualResumo.classList.add('selected-tags', 'empty');
    refs.entradaManualResumo.textContent = 'Selecione um item para continuar.';
    return;
  }

  refs.entradaManualResumo.classList.remove('empty');
  refs.entradaManualResumo.classList.add('selected-tags');
  refs.entradaManualResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Tipo: ${item.tipo}`)}</span>
    <span class="selected-tag">Destino: Almoxarifado</span>
  `;
}

function renderizarResumoTransferencia(item) {
  if (!item) {
    refs.transferenciaResumo.classList.add('selected-tags', 'empty');
    refs.transferenciaResumo.textContent = 'Selecione um item para continuar.';
    return;
  }

  refs.transferenciaResumo.classList.remove('empty');
  refs.transferenciaResumo.classList.add('selected-tags');
  refs.transferenciaResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Tipo: ${item.tipo}`)}</span>
  `;
}

function renderizarResumoConsumoInterno(item) {
  if (!item) {
    refs.consumoInternoResumo.classList.add('selected-tags', 'empty');
    refs.consumoInternoResumo.textContent = 'Selecione um item com saldo no Almoxarifado.';
    return;
  }

  refs.consumoInternoResumo.classList.remove('empty');
  refs.consumoInternoResumo.classList.add('selected-tags');
  refs.consumoInternoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo Almox: ${formatDecimal(obterSaldoAlmoxarifadoItem(item.id))}`)}</span>
  `;
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

function renderizarEstoque() {
  const registrosEstoque = obterRegistrosEstoqueAlmox();
  const saldosFiltrados = obterSaldosFiltrados();
  refs.estoqueTotal.textContent = `${saldosFiltrados.length} registro(s) encontrado(s)`;

  if (!registrosEstoque.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhum item monitorado no Almoxarifado.</td></tr>';
    return;
  }

  if (!saldosFiltrados.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhum item encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.estoqueTbody.innerHTML = saldosFiltrados.map((item) => `
    <tr class="${obterClasseLinhaPrioridade(item)}">
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.tipo)}</td>
      <td>${escapeHtml(item.classificacao)}</td>
      <td class="table-quantity">${formatDecimal(item.quantidade)}</td>
      <td class="table-description">${escapeHtml(formatarFornecedorEstoque(item))}</td>
      <td class="table-quantity">${formatDecimal(item.quantidade_saida_mes)}</td>
      <td>${escapeHtml(formatarDuracaoPrioridade(item))}</td>
      <td>${renderizarEstadoNecessidade(item.estado_necessidade)}</td>
    </tr>
  `).join('');
}

function renderizarPedidos() {
  const pedidosFiltrados = obterPedidosFiltrados();
  refs.pedidosTotal.textContent = `${pedidosFiltrados.length} registro(s) encontrado(s)`;

  if (!solicitacoesCache.length) {
    refs.pedidosTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma solicitacao encontrada.</td></tr>';
    return;
  }

  if (!pedidosFiltrados.length) {
    refs.pedidosTbody.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(obterMensagemSolicitacaoVazia(refs.pedidosFiltroSituacao.value))}</td></tr>`;
    return;
  }

  refs.pedidosTbody.innerHTML = pedidosFiltrados.map((item) => `
    <tr>
      <td>${escapeHtml(item.destino_nome)}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatPackage(item.quantidade_pacote)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_solicitada)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente)}</td>
      <td class="table-quantity">${formatInteger(item.saldo_almoxarifado)}</td>
      <td>${renderizarStatus(item.status)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            ${['PENDENTE', 'ATENDIDA_PARCIAL'].includes(item.status)
              ? `<button type="button" class="row-menu-item" data-action="iniciar" data-id="${item.id}">Marcar pronto</button>`
              : ''}
            ${['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(item.status)
              ? `<button type="button" class="row-menu-item" data-action="atender" data-id="${item.id}">Ja retirou</button>`
              : '<span class="row-menu-item">Sem acoes</span>'}
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function renderizarTratamento() {
  const registrosFiltrados = obterTratamentoFiltrado();
  refs.tratamentoTotal.textContent = `${registrosFiltrados.length} registro(s) encontrado(s)`;

  if (!tratamentoCache.length) {
    refs.tratamentoTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma peca aguardando retorno do tratamento externo.</td></tr>';
    return;
  }

  if (!registrosFiltrados.length) {
    refs.tratamentoTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma peca encontrada com os filtros informados.</td></tr>';
    return;
  }

  refs.tratamentoTbody.innerHTML = registrosFiltrados.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.nome_empresa || '-')}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente)}</td>
      <td>${escapeHtml(item.numero_nf || '-')}</td>
      <td>${formatarDataHora(item.data_envio)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="receber" data-id="${item.id_item}">Receber no estoque</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function renderizarHistorico() {
  refs.historicoTotal.textContent = `${historicoCache.length} movimentacao(oes)`;

  if (!historicoCache.length) {
    refs.historicoTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma movimentacao registrada.</td></tr>';
    return;
  }

  refs.historicoTbody.innerHTML = historicoCache.slice(0, 40).map((item) => `
    <tr>
      <td>${formatarDataHora(item.data_movimentacao)}</td>
      <td>${escapeHtml(item.tipo_movimentacao)}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td>${escapeHtml(item.estoque_origem_nome || '-')}</td>
      <td>${escapeHtml(item.estoque_destino_nome || '-')}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
    </tr>
  `).join('');
}

function renderizarProducao() {
  if (!producaoCache.length) {
    refs.producaoTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma ordem em andamento.</td></tr>';
    return;
  }

  refs.producaoTbody.innerHTML = producaoCache.map((producao) => `
    <tr>
      <td>${escapeHtml(`OP #${producao.id}`)}</td>
      <td>${escapeHtml(producao.maquina_nome || '-')}</td>
      <td class="table-code">${escapeHtml(producao.peca_codigo || '-')}</td>
      <td class="table-description">${escapeHtml(producao.peca_descricao || '-')}</td>
      <td class="table-quantity">${formatInteger(producao.quantidade_planejada)}</td>
      <td>${escapeHtml(
        producao.materia_prima_codigo
          ? `${producao.materia_prima_codigo} - ${producao.materia_prima_nome}`
          : 'Sem materia-prima'
      )}</td>
      <td>${formatarDataHora(producao.data_inicio)}</td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  document.getElementById('almox-card-itens').textContent = String(saldosAlmoxCache.length);
  document.getElementById('almox-card-quantidade').textContent = formatInteger(
    saldosAlmoxCache.reduce((total, item) => total + Number(item.quantidade || 0), 0)
  );
  document.getElementById('almox-card-alertas').textContent = formatInteger(obterPrioridadesOperacionaisAlmox().length);
  document.getElementById('almox-card-pedidos').textContent = String(
    solicitacoesCache.filter((item) => ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(item.status)).length
  );
  atualizarBadgesMenu();
}

function iniciarAtualizacaoAutomatica() {
  if (autoRefreshHandle) {
    window.clearInterval(autoRefreshHandle);
  }

  autoRefreshHandle = window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    atualizarPainelAutomaticamente();
  }, AUTO_REFRESH_MS);
}

async function atualizarPainelAutomaticamente() {
  try {
    await Promise.all([
      carregarEstoqueAlmox(),
      carregarPrioridadesAlmox(),
      carregarSolicitacoes(),
      carregarTratamento(),
      carregarProducaoEmAndamento()
    ]);
  } catch (error) {
    console.error('Falha ao atualizar badges do Almoxarifado:', error);
  }
}

function atualizarBadgesMenu() {
  setBadge(refs.badgePedidos, contarPedidosAbertos(solicitacoesCache));
  setBadge(refs.badgeTratamento, tratamentoCache.length);
  setBadge(refs.badgeProducao, producaoCache.length);
}

function contarPedidosAbertos(items) {
  return items.filter((item) => ACTIVE_REQUEST_STATUSES.includes(String(item.status || '').toUpperCase())).length;
}

function setBadge(element, count) {
  if (!element) {
    return;
  }

  const safeCount = Number(count || 0);
  element.textContent = formatInteger(safeCount);
  element.classList.toggle('hidden', safeCount <= 0);
}

function filtrarPorTimeline(status, filtro, ativos, encerrados) {
  const normalized = String(status || '').toUpperCase();

  if (filtro === 'encerradas') {
    return encerrados.includes(normalized);
  }

  if (filtro === 'todas') {
    return true;
  }

  return ativos.includes(normalized);
}

function obterMensagemSolicitacaoVazia(filtro) {
  if (filtro === 'encerradas') {
    return 'Nenhuma solicitacao encerrada encontrada.';
  }

  if (filtro === 'todas') {
    return 'Nenhuma solicitacao encontrada com os filtros informados.';
  }

  return 'Nenhuma solicitacao ativa encontrada.';
}

function obterSaldosFiltrados() {
  const filtroCodigo = normalizarBusca(refs.filtroCodigo.value.trim());
  const filtroDescricao = normalizarBusca(refs.filtroDescricao.value.trim());
  const filtroFornecedor = normalizarBusca(refs.filtroFornecedor.value.trim());
  const filtroClassificacao = refs.filtroClassificacao.value.trim().toUpperCase();
  const filtroEstado = refs.filtroEstado.value.trim().toUpperCase();
  const ordenacaoQuantidade = refs.filtroQuantidade.value;

  const registros = obterRegistrosEstoqueAlmox().filter((item) => {
    if (filtroCodigo && !normalizarBusca(item.codigo).includes(filtroCodigo)) {
      return false;
    }

    if (filtroDescricao && !normalizarBusca(item.descricao).includes(filtroDescricao)) {
      return false;
    }

    if (filtroFornecedor && !normalizarBusca(formatarFornecedorEstoque(item)).includes(filtroFornecedor)) {
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

    return true;
  });

  if (ordenacaoQuantidade === 'asc') {
    registros.sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));
  } else if (ordenacaoQuantidade === 'desc') {
    registros.sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0));
  }

  return registros;
}

function obterPedidosFiltrados() {
  const filtroSituacao = refs.pedidosFiltroSituacao.value;
  const filtroQ = normalizarBusca(refs.pedidosFiltroQ.value.trim());
  const filtroStatus = refs.pedidosFiltroStatus.value.trim().toUpperCase();

  return solicitacoesCache.filter((item) => {
    if (!filtrarPorTimeline(item.status, filtroSituacao, ACTIVE_REQUEST_STATUSES, CLOSED_REQUEST_STATUSES)) {
      return false;
    }

    if (filtroStatus && String(item.status || '').toUpperCase() !== filtroStatus) {
      return false;
    }

    if (!filtroQ) {
      return true;
    }

    return normalizarBusca([
      item.codigo,
      item.descricao,
      item.observacao,
      item.destino_nome
    ].join(' ')).includes(filtroQ);
  });
}

function obterTratamentoFiltrado() {
  const filtroCodigo = normalizarBusca(refs.tratamentoFiltroCodigo.value.trim());
  const filtroDescricao = normalizarBusca(refs.tratamentoFiltroDescricao.value.trim());

  return tratamentoCache.filter((item) => {
    if (filtroCodigo && !normalizarBusca(item.codigo).includes(filtroCodigo)) {
      return false;
    }

    if (filtroDescricao && !normalizarBusca(item.descricao).includes(filtroDescricao)) {
      return false;
    }

    return true;
  });
}

async function abrirModalEntradaManual() {
  try {
    await carregarItensEstoque();
    resetModalEntradaManual();
    openModal(refs.entradaManualModal);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
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

function fecharModalEntradaManual() {
  resetModalEntradaManual();
  closeModal(refs.entradaManualModal);
}

function resetModalEntradaManual() {
  document.getElementById('almox-entrada-manual-form').reset();
  refs.entradaManualIdItem.value = '';
  refs.entradaManualResumo.classList.add('selected-tags', 'empty');
  refs.entradaManualResumo.textContent = 'Selecione um item para continuar.';
  refs.entradaManualMensagem.className = 'message hidden';
  refs.entradaManualMensagem.textContent = '';
  refs.entradaManualSugestoes.classList.add('hidden');
  refs.entradaManualSugestoes.innerHTML = '';
}

async function handleSalvarEntradaManual(event) {
  event.preventDefault();

  try {
    const almox = obterEstoqueAlmoxarifado();
    if (!almox) {
      throw new Error('Estoque do Almoxarifado nao encontrado.');
    }

    const response = await fetch(estoqueEntradaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: refs.entradaManualIdItem.value,
        id_estoque_destino: almox.id,
        quantidade: refs.entradaManualQuantidade.value,
        observacao: refs.entradaManualObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalEntradaManual();
    mostrarMensagem('Entrada manual registrada com sucesso.', 'success');
    await Promise.all([carregarEstoqueAlmox(), carregarHistoricoSeAberto()]);
  } catch (error) {
    refs.entradaManualMensagem.textContent = error.message;
    refs.entradaManualMensagem.className = 'message error';
    refs.entradaManualMensagem.classList.remove('hidden');
  }
}

async function abrirModalTransferencia() {
  try {
    await carregarItensEstoque();
    resetModalTransferencia();
    openModal(refs.transferenciaModal);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function fecharModalTransferencia() {
  resetModalTransferencia();
  closeModal(refs.transferenciaModal);
}

function resetModalTransferencia() {
  document.getElementById('almox-transferencia-form').reset();
  refs.transferenciaIdItem.value = '';
  refs.transferenciaResumo.classList.add('selected-tags', 'empty');
  refs.transferenciaResumo.textContent = 'Selecione um item para continuar.';
  refs.transferenciaMensagem.className = 'message hidden';
  refs.transferenciaMensagem.textContent = '';
  refs.transferenciaSugestoes.classList.add('hidden');
  refs.transferenciaSugestoes.innerHTML = '';

  const almox = obterEstoqueAlmoxarifado();
  refs.transferenciaOrigem.value = almox ? String(almox.id) : '';
  refs.transferenciaDestino.value = '';
}

async function handleSalvarTransferencia(event) {
  event.preventDefault();

  try {
    const response = await fetch(estoqueTransferenciaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: refs.transferenciaIdItem.value,
        id_estoque_origem: refs.transferenciaOrigem.value,
        id_estoque_destino: refs.transferenciaDestino.value,
        quantidade: refs.transferenciaQuantidade.value,
        observacao: refs.transferenciaObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalTransferencia();
    mostrarMensagem('Transferencia registrada com sucesso.', 'success');
    await Promise.all([carregarEstoqueAlmox(), carregarHistoricoSeAberto()]);
  } catch (error) {
    refs.transferenciaMensagem.textContent = error.message;
    refs.transferenciaMensagem.className = 'message error';
    refs.transferenciaMensagem.classList.remove('hidden');
  }
}

async function abrirModalConsumoInterno() {
  try {
    await carregarItensEstoque();
    resetModalConsumoInterno();
    openModal(refs.consumoInternoModal);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function fecharModalConsumoInterno() {
  resetModalConsumoInterno();
  closeModal(refs.consumoInternoModal);
}

function resetModalConsumoInterno() {
  document.getElementById('almox-consumo-interno-form').reset();
  refs.consumoInternoIdItem.value = '';
  refs.consumoInternoResponsavel.value = 'Producao';
  refs.consumoInternoQuantidade.value = '1';
  refs.consumoInternoResumo.classList.add('selected-tags', 'empty');
  refs.consumoInternoResumo.textContent = 'Selecione um item com saldo no Almoxarifado.';
  refs.consumoInternoMensagem.className = 'message hidden';
  refs.consumoInternoMensagem.textContent = '';
  refs.consumoInternoSugestoes.classList.add('hidden');
  refs.consumoInternoSugestoes.innerHTML = '';
}

async function handleSalvarConsumoInterno(event) {
  event.preventDefault();

  try {
    const response = await fetch(estoqueConsumoInternoApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responsavel_consumo: refs.consumoInternoResponsavel.value.trim() || 'Producao',
        itens: [{
          id_peca: refs.consumoInternoIdItem.value,
          quantidade: refs.consumoInternoQuantidade.value
        }],
        observacao: refs.consumoInternoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalConsumoInterno();
    mostrarMensagem('Consumo interno registrado com sucesso.', 'success');
    await Promise.all([carregarEstoqueAlmox(), carregarHistoricoSeAberto()]);
  } catch (error) {
    refs.consumoInternoMensagem.textContent = error.message;
    refs.consumoInternoMensagem.className = 'message error';
    refs.consumoInternoMensagem.classList.remove('hidden');
  }
}

async function abrirModalPedidos() {
  try {
    await carregarSolicitacoes();
    stopTabFlash();
    openModal(refs.pedidosModal);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function fecharModalPedidos() {
  closeModal(refs.pedidosModal);
}

function abrirModalAtendimento(item) {
  refs.atendimentoMensagem.className = 'message hidden';
  refs.atendimentoMensagem.textContent = '';
  refs.atendimentoId.value = String(item.id);
  const pacote = Number(item.quantidade_pacote);
  refs.atendimentoQuantidade.value = Number.isFinite(pacote) && pacote > 0 ? String(pacote) : '';
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
  refs.atendimentoResumo.textContent = 'Selecione uma solicitacao para liberar.';
  closeModal(refs.atendimentoModal);
}

async function abrirModalTratamento() {
  try {
    await carregarTratamento();
    openModal(refs.tratamentoModal);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function fecharModalTratamento() {
  closeModal(refs.tratamentoModal);
}

function abrirModalRecebimento(item) {
  refs.recebimentoMensagem.className = 'message hidden';
  refs.recebimentoMensagem.textContent = '';
  refs.recebimentoIdPeca.value = String(item.id_item);
  refs.recebimentoQuantidade.value = String(Math.max(1, Number(item.quantidade_pendente || 0)));
  refs.recebimentoQuantidade.max = String(Math.max(1, Number(item.quantidade_pendente || 0)));
  refs.recebimentoObservacao.value = '';
  refs.recebimentoResumo.classList.remove('empty');
  refs.recebimentoResumo.classList.add('selected-tags');
  refs.recebimentoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Empresa: ${item.nome_empresa || '-'}`)}</span>
    <span class="selected-tag">${escapeHtml(`Pendente: ${formatInteger(item.quantidade_pendente)}`)}</span>
    <span class="selected-tag">${escapeHtml(`NF: ${item.numero_nf || '-'}`)}</span>
    <span class="selected-tag">${escapeHtml(`Envio: ${formatarDataHora(item.data_envio)}`)}</span>
  `;

  const almox = obterEstoqueAlmoxarifado();
  refs.recebimentoDestino.value = almox ? String(almox.id) : '';
  openModal(refs.recebimentoModal);
}

function fecharModalRecebimento() {
  refs.recebimentoIdPeca.value = '';
  refs.recebimentoResumo.classList.add('selected-tags', 'empty');
  refs.recebimentoResumo.textContent = 'Selecione uma peca para continuar.';
  closeModal(refs.recebimentoModal);
}

async function abrirModalMateriaPrima() {
  try {
    await carregarMateriasPrimas();
    resetModalMateriaPrima();
    openModal(refs.mpModal);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function fecharModalMateriaPrima() {
  resetModalMateriaPrima();
  closeModal(refs.mpModal);
}

async function abrirModalHistorico() {
  try {
    await carregarHistoricoAlmox();
    openModal(refs.historicoModal);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function fecharModalHistorico() {
  closeModal(refs.historicoModal);
}

async function abrirModalProducao() {
  try {
    refs.producaoMensagem.className = 'message hidden';
    refs.producaoMensagem.textContent = '';
    await carregarProducaoEmAndamento();
    openModal(refs.producaoModal);
  } catch (error) {
    refs.producaoMensagem.textContent = error.message;
    refs.producaoMensagem.className = 'message error';
    refs.producaoMensagem.classList.remove('hidden');
    openModal(refs.producaoModal);
  }
}

function fecharModalProducao() {
  closeModal(refs.producaoModal);
}

function handlePedidosActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const item = solicitacoesCache.find((entry) => Number(entry.id) === Number(button.dataset.id));
  if (!item) {
    return;
  }

  if (button.dataset.action === 'iniciar') {
    executarAcaoPedido(`${solicitacoesApiBaseUrl}/${item.id}/iniciar-separacao`, 'Pedido marcado como separando.');
    return;
  }

  if (button.dataset.action === 'atender') {
    abrirModalAtendimento(item);
  }
}

async function marcarProntoTodosPedidos() {
  const pedidosFiltrados = obterPedidosFiltrados();
  const elegiveis = pedidosFiltrados.filter((item) => ['PENDENTE', 'ATENDIDA_PARCIAL'].includes(String(item.status || '').toUpperCase()));

  if (!elegiveis.length) {
    mostrarMensagem('Nenhuma solicitacao pendente para marcar como pronto.', 'info');
    return;
  }

  const confirmado = window.confirm(`Marcar ${elegiveis.length} solicitacao(oes) como pronta(s)?`);
  if (!confirmado) {
    return;
  }

  let ok = 0;
  let falhas = 0;

  for (const pedido of elegiveis) {
    try {
      const response = await fetch(`${solicitacoesApiBaseUrl}/${pedido.id}/iniciar-separacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(extractErrorMessage(result));
      }

      ok += 1;
    } catch (error) {
      falhas += 1;
      console.error('Falha ao marcar pronto em lote:', error);
    }
  }

  if (falhas > 0) {
    mostrarMensagem(`Marcadas como prontas: ${ok}. Falhas: ${falhas}.`, 'warning');
  } else {
    mostrarMensagem(`Marcadas como prontas: ${ok}.`, 'success');
  }

  await carregarSolicitacoes();
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
      throw new Error(extractErrorMessage(result));
    }

    fecharModalAtendimento();
    mostrarMensagem('Pedido liberado para retirada com sucesso.', 'success');
    await Promise.all([carregarSolicitacoes(), carregarEstoqueAlmox(), carregarHistoricoSeAberto()]);
  } catch (error) {
    refs.atendimentoMensagem.textContent = error.message;
    refs.atendimentoMensagem.className = 'message error';
    refs.atendimentoMensagem.classList.remove('hidden');
  }
}

function handleTratamentoActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const item = tratamentoCache.find((entry) => Number(entry.id_item) === Number(button.dataset.id));
  if (!item) {
    return;
  }

  if (button.dataset.action === 'receber') {
    abrirModalRecebimento(item);
  }
}

async function handleReceberTratamento(event) {
  event.preventDefault();

  try {
    const destinoSelecionado = refs.recebimentoDestino.value;
    const response = await fetch(`${terceirizacaoApiBaseUrl}/retorno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_item: refs.recebimentoIdPeca.value,
        id_estoque_destino: destinoSelecionado,
        quantidade_retorno: refs.recebimentoQuantidade.value,
        observacao: refs.recebimentoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalRecebimento();
    mostrarMensagem(
      destinoSelecionado === RECEBIMENTO_DESTINO_ESTOQUE_MP
        ? 'Retorno da terceirizacao enviado ao estoque de materia-prima com sucesso.'
        : 'Retorno da terceirizacao registrado com sucesso.',
      'success'
    );
    await Promise.all([carregarTratamento(), carregarEstoqueAlmox(), carregarHistoricoSeAberto()]);
  } catch (error) {
    refs.recebimentoMensagem.textContent = error.message;
    refs.recebimentoMensagem.className = 'message error';
    refs.recebimentoMensagem.classList.remove('hidden');
  }
}

function renderizarSugestoesMateriaPrima(termo) {
  const filtro = normalizarBusca(termo);
  const itens = materiasPrimasCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.nome} ${item.liga || ''}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.mpSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma materia-prima encontrada.</div>';
    refs.mpSugestoes.classList.remove('hidden');
    return;
  }

  refs.mpSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-mp-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.nome}`)}</strong>
      <span>${escapeHtml(`${item.categoria} | ${item.geometria || '-'} | ${formatarReferenciaMateriaPrima(item)}`)}</span>
    </button>
  `).join('');
  refs.mpSugestoes.classList.remove('hidden');
}

function handleSugestaoMateriaPrimaClick(event) {
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

  refs.mpId.value = String(materiaPrima.id);
  refs.mpBusca.value = `${materiaPrima.codigo} - ${materiaPrima.nome}`;
  renderizarResumoMateriaPrima(materiaPrima);
  refs.mpSugestoes.classList.add('hidden');
  refs.mpSugestoes.innerHTML = '';
}

function renderizarResumoMateriaPrima(item) {
  if (!item) {
    refs.mpResumo.classList.add('selected-tags', 'empty');
    refs.mpResumo.textContent = 'Selecione uma materia-prima para continuar.';
    return;
  }

  refs.mpResumo.classList.remove('empty');
  refs.mpResumo.classList.add('selected-tags');
  refs.mpResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.nome)}</span>
    <span class="selected-tag">${escapeHtml(`Categoria: ${item.categoria}`)}</span>
    <span class="selected-tag">${escapeHtml(`Referencia: ${formatarReferenciaMateriaPrima(item)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Unidade: ${item.unidade_estoque || '-'}`)}</span>
  `;
}

async function handleSalvarEntradaMp(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${estoqueMateriaPrimaApiBaseUrl}/entrada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_materia_prima: refs.mpId.value,
        quantidade: refs.mpQuantidade.value,
        observacao: refs.mpObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalMateriaPrima();
    mostrarMensagem('Entrada de materia-prima registrada com sucesso.', 'success');
  } catch (error) {
    refs.mpMensagem.textContent = error.message;
    refs.mpMensagem.className = 'message error';
    refs.mpMensagem.classList.remove('hidden');
  }
}

async function executarAcaoPedido(url, successMessage) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    mostrarMensagem(successMessage, 'success');
    await carregarSolicitacoes();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function preencherEstoquesDestino() {
  const recebimentoOptions = `
    <option value="">Selecione</option>
    <option value="${RECEBIMENTO_DESTINO_ESTOQUE_MP}">Estoque de materia-prima</option>
    ${estoquesCache.map((estoque) => `<option value="${estoque.id}">${escapeHtml(estoque.nome)}</option>`).join('')}
  `;
  const transferenciaOptions = `
    <option value="">Selecione</option>
    ${estoquesCache.map((estoque) => `<option value="${estoque.id}">${escapeHtml(estoque.nome)}</option>`).join('')}
  `;

  refs.recebimentoDestino.innerHTML = recebimentoOptions;
  refs.transferenciaOrigem.innerHTML = transferenciaOptions;
  refs.transferenciaDestino.innerHTML = transferenciaOptions;
}

function limparFiltrosEstoque() {
  refs.filtroCodigo.value = '';
  refs.filtroDescricao.value = '';
  refs.filtroFornecedor.value = '';
  refs.filtroClassificacao.value = '';
  refs.filtroEstado.value = '';
  refs.filtroQuantidade.value = '';
  renderizarEstoque();
}

function limparFiltrosFornecedores() {
  refs.fornecedoresFiltroForm.reset();
  renderizarFornecedores();
}

function limparFiltrosPedidos() {
  refs.pedidosFiltroSituacao.value = 'abertas';
  refs.pedidosFiltroQ.value = '';
  refs.pedidosFiltroStatus.value = '';
  renderizarPedidos();
}

function limparFiltrosTratamento() {
  refs.tratamentoFiltroCodigo.value = '';
  refs.tratamentoFiltroDescricao.value = '';
  renderizarTratamento();
}

function resetModalMateriaPrima() {
  document.getElementById('almox-mp-form').reset();
  refs.mpId.value = '';
  refs.mpResumo.classList.add('selected-tags', 'empty');
  refs.mpResumo.textContent = 'Selecione uma materia-prima para continuar.';
  refs.mpMensagem.className = 'message hidden';
  refs.mpMensagem.textContent = '';
  refs.mpSugestoes.classList.add('hidden');
  refs.mpSugestoes.innerHTML = '';
}

async function carregarHistoricoSeAberto() {
  if (refs.historicoModal.classList.contains('hidden')) {
    return;
  }

  await carregarHistoricoAlmox();
}

function obterEstoqueAlmoxarifado() {
  return estoquesCache.find((estoque) => normalizarBusca(estoque.nome).includes('almox')) || null;
}

function obterPrioridadesOperacionaisAlmox() {
  return prioridadesAlmoxCache.filter((item) => String(item.estado_necessidade || '').toUpperCase() !== 'NORMAL');
}

function obterRegistrosEstoqueAlmox() {
  const prioridadesPorPeca = new Map(
    prioridadesAlmoxCache.map((item) => [Number(item.id_peca), item])
  );
  const registros = saldosAlmoxCache.map((item) => enriquecerRegistroEstoque(item, prioridadesPorPeca.get(Number(item.id_peca))));
  const idsExistentes = new Set(registros.map((item) => Number(item.id_peca)));

  obterPrioridadesOperacionaisAlmox().forEach((item) => {
    if (idsExistentes.has(Number(item.id_peca))) {
      return;
    }

    registros.push(enriquecerRegistroEstoque(item, item));
  });

  return registros;
}

function enriquecerRegistroEstoque(item, prioridade = null) {
  const quantidadeAtual = Number(prioridade?.quantidade ?? item.quantidade ?? 0);
  const estadoFallback = quantidadeAtual <= 0
    ? 'CRITICO'
    : isItemEmAlerta(item) ? 'ATENCAO' : 'NORMAL';

  return {
    ...item,
    id_peca: Number(prioridade?.id_peca ?? item.id_peca ?? 0),
    codigo: prioridade?.codigo ?? item.codigo ?? '-',
    descricao: prioridade?.descricao ?? item.descricao ?? '-',
    tipo: prioridade?.tipo ?? item.tipo ?? '-',
    classificacao: prioridade?.classificacao ?? item.classificacao ?? '-',
    fornecedor_nome: prioridade?.fornecedor_nome ?? item.fornecedor_nome ?? '',
    fornecedores_nomes: prioridade?.fornecedores_nomes ?? item.fornecedores_nomes ?? '',
    quantidade: quantidadeAtual,
    quantidade_saida_mes: Number(prioridade?.quantidade_saida_mes ?? item.consumo_mensal ?? 0),
    dias_cobertura: prioridade?.dias_cobertura ?? null,
    data_prevista_ruptura: prioridade?.data_prevista_ruptura ?? null,
    estado_necessidade: String(prioridade?.estado_necessidade || estadoFallback).toUpperCase()
  };
}

function formatarFornecedorEstoque(item) {
  return String(item.fornecedores_nomes || item.fornecedor_nome || '-').trim() || '-';
}

function obterClasseLinhaPrioridade(item) {
  return String(item.estado_necessidade || '').toUpperCase() === 'CRITICO' ? 'table-row-attention' : '';
}

function getLimiteAlerta(item) {
  return Number(item.estoque_seguranca || 0);
}

function isItemEmAlerta(item) {
  const limite = getLimiteAlerta(item);
  return limite > 0 && Number(item.quantidade || 0) <= limite;
}

function renderizarAlertaEstoque(item) {
  const limite = getLimiteAlerta(item);
  const quantidadeAtual = Number(item.quantidade || 0);

  if (limite <= 0) {
    return '-';
  }

  if (quantidadeAtual < limite) {
    return '<span class="status-chip is-danger">Abaixo do limite</span>';
  }

  if (quantidadeAtual === limite) {
    return '<span class="status-chip is-warning">No limite</span>';
  }

  return '<span class="status-chip is-success">Normal</span>';
}

function renderizarQuantidadeEstoque(item) {
  const quantidade = formatInteger(item.quantidade);
  const limite = getLimiteAlerta(item);
  const quantidadeAtual = Number(item.quantidade || 0);

  if (limite > 0 && quantidadeAtual < limite) {
    return `<span class="status-chip is-danger">${escapeHtml(quantidade)}</span>`;
  }

  if (limite > 0 && quantidadeAtual === limite) {
    return `<span class="status-chip is-warning">${escapeHtml(quantidade)}</span>`;
  }

  return escapeHtml(quantidade);
}

function renderizarCoberturaConsumo(item) {
  const consumoMensal = Number(item.consumo_mensal || 0);
  if (!Number.isFinite(consumoMensal) || consumoMensal <= 0) {
    return '-';
  }

  const dias = Math.floor((Number(item.quantidade || 0) / consumoMensal) * 30);
  const dataFinal = new Date();
  dataFinal.setDate(dataFinal.getDate() + dias);

  return `${dias} dia(s) | ate ${dataFinal.toLocaleDateString('pt-BR')}`;
}

function formatarDataCurta(value) {
  if (!value) {
    return '-';
  }

  const data = new Date(value);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleDateString('pt-BR');
}

function formatarDuracaoPrioridade(item) {
  const dias = Number(item.dias_cobertura);
  const dataPrevista = formatarDataCurta(item.data_prevista_ruptura);

  if (!Number.isFinite(dias) && dataPrevista === '-') {
    return 'Sem previsao';
  }

  if (!Number.isFinite(dias)) {
    return `ate ${dataPrevista}`;
  }

  return `${formatDecimal(dias)} dia(s) | ate ${dataPrevista}`;
}

function renderizarEstadoNecessidade(estado) {
  const normalized = String(estado || '').toUpperCase();
  let cssClass = 'status-chip';

  if (normalized === 'CRITICO') cssClass += ' is-danger';
  if (normalized === 'ATENCAO') cssClass += ' is-warning';
  if (normalized === 'OBSERVAR') cssClass += ' is-info';
  if (normalized === 'NORMAL') cssClass += ' is-success';

  return `<span class="${cssClass}">${escapeHtml(normalized || '-')}</span>`;
}

function renderizarStatus(status) {
  const normalized = String(status || '').toUpperCase();
  let cssClass = 'status-chip';

  if (normalized === 'ATENDIDA') cssClass += ' is-success';
  if (normalized === 'ATENDIDA_PARCIAL') cssClass += ' is-warning';
  if (normalized === 'PENDENTE') cssClass += ' is-danger';
  if (normalized === 'EM_SEPARACAO') cssClass += ' is-success';

  return `<span class="${cssClass}">${escapeHtml(formatarStatusSolicitacao(normalized))}</span>`;
}

function formatarStatusSolicitacao(status) {
  const labels = {
    PENDENTE: 'Pendente',
    EM_SEPARACAO: 'Pronto',
    ATENDIDA_PARCIAL: 'Pode retirar parcial',
    ATENDIDA: 'Pode retirar',
    CANCELADA: 'Cancelada',
    FALTANDO_PECA: 'Faltando peca',
    MONTANDO: 'Montando'
  };

  return labels[status] || status || '-';
}

function formatarReferenciaMateriaPrima(item) {
  if (item.categoria === 'FUNDIDO') {
    return item.liga || 'FUNDIDO';
  }

  if (item.bitola_original && item.bitola_mm) {
    return `${item.bitola_original} | ${formatDecimal(item.bitola_mm)} mm`;
  }

  if (item.bitola_original) {
    return item.bitola_original;
  }

  if (item.bitola_mm) {
    return `${formatDecimal(item.bitola_mm)} mm`;
  }

  return '-';
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'almox-fornecedores') fecharModalFornecedores();
  if (event.target.dataset.closeModal === 'almox-entrada-manual') fecharModalEntradaManual();
  if (event.target.dataset.closeModal === 'almox-transferencia') fecharModalTransferencia();
  if (event.target.dataset.closeModal === 'almox-consumo-interno') fecharModalConsumoInterno();
  if (event.target.dataset.closeModal === 'almox-pedidos') fecharModalPedidos();
  if (event.target.dataset.closeModal === 'almox-atendimento') fecharModalAtendimento();
  if (event.target.dataset.closeModal === 'almox-tratamento') fecharModalTratamento();
  if (event.target.dataset.closeModal === 'almox-recebimento') fecharModalRecebimento();
  if (event.target.dataset.closeModal === 'almox-mp') fecharModalMateriaPrima();
  if (event.target.dataset.closeModal === 'almox-historico') fecharModalHistorico();
  if (event.target.dataset.closeModal === 'almox-producao') fecharModalProducao();
}

function handleGlobalClick(event) {
  const trigger = event.target.closest('.row-menu-trigger');
  if (trigger) {
    const currentMenu = trigger.closest('.row-menu');
    window.requestAnimationFrame(() => {
      const shouldKeepOpen = currentMenu && currentMenu.hasAttribute('open');
      closeAllRowMenus(shouldKeepOpen ? currentMenu : null);
    });
  } else if (!event.target.closest('.row-menu')) {
    closeAllRowMenus();
  }

  if (!event.target.closest('.autocomplete')) {
    esconderSugestoesItemEstoque();
    esconderSugestoesMateriaPrima();
  }
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  closeAllRowMenus();

  if (!refs.producaoModal.classList.contains('hidden')) fecharModalProducao();
  else if (!refs.fornecedoresModal.classList.contains('hidden')) fecharModalFornecedores();
  else if (!refs.historicoModal.classList.contains('hidden')) fecharModalHistorico();
  else if (!refs.mpModal.classList.contains('hidden')) fecharModalMateriaPrima();
  else if (!refs.consumoInternoModal.classList.contains('hidden')) fecharModalConsumoInterno();
  else if (!refs.transferenciaModal.classList.contains('hidden')) fecharModalTransferencia();
  else if (!refs.entradaManualModal.classList.contains('hidden')) fecharModalEntradaManual();
  else if (!refs.recebimentoModal.classList.contains('hidden')) fecharModalRecebimento();
  else if (!refs.tratamentoModal.classList.contains('hidden')) fecharModalTratamento();
  else if (!refs.atendimentoModal.classList.contains('hidden')) fecharModalAtendimento();
  else if (!refs.pedidosModal.classList.contains('hidden')) fecharModalPedidos();
}

function esconderSugestoesItemEstoque() {
  refs.entradaManualSugestoes.classList.add('hidden');
  refs.entradaManualSugestoes.innerHTML = '';
  refs.transferenciaSugestoes.classList.add('hidden');
  refs.transferenciaSugestoes.innerHTML = '';
  refs.consumoInternoSugestoes.classList.add('hidden');
  refs.consumoInternoSugestoes.innerHTML = '';
}

function esconderSugestoesMateriaPrima() {
  refs.mpSugestoes.classList.add('hidden');
  refs.mpSugestoes.innerHTML = '';
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
  const hasModal = [
    refs.fornecedoresModal,
    refs.entradaManualModal,
    refs.transferenciaModal,
    refs.consumoInternoModal,
    refs.pedidosModal,
    refs.atendimentoModal,
    refs.tratamentoModal,
    refs.recebimentoModal,
    refs.mpModal,
    refs.historicoModal,
    refs.producaoModal
  ].some((item) => !item.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function extractErrorMessage(result) {
  if (!result) {
    return 'Operacao nao concluida.';
  }

  if (Array.isArray(result.errors) && result.errors.length) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatPackage(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return formatInteger(value);
}

function formatarDataHora(value) {
  if (!value) {
    return '-';
  }

  const data = new Date(value);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleString('pt-BR');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
