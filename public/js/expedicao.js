const estoquesApiBaseUrl = '/api/estoques';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const estoqueItensApiBaseUrl = '/api/estoque/itens';
const estoqueMovimentacoesApiBaseUrl = '/api/estoque/movimentacoes';
const transferenciaApiBaseUrl = '/api/estoque/transferencia';
const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';
const solicitacoesProducaoApiBaseUrl = '/api/solicitacoes-producao';
const saidaApiBaseUrl = '/api/estoque/saida';
const saidaDiagnosticoApiBaseUrl = '/api/estoque/saida/diagnostico';
const submontagensApiBaseUrl = '/api/submontagens';
const composicoesVendaApiBaseUrl = '/api/composicoes-venda';
const producaoApiBaseUrl = '/api/producao';
const AUTO_REFRESH_MS = 15000;
const TIPO_SAIDA_PADRAO = 'VENDA';
const ACTIVE_REQUEST_STATUSES = ['PENDENTE', 'FALTANDO_PECA', 'MONTANDO', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'];
const CLOSED_REQUEST_STATUSES = ['ATENDIDA', 'CANCELADA'];

let estoquesCache = [];
let itensCache = [];
let saldosExpedicaoCache = [];
let saldosMontagemCache = [];
let pedidosExpedicaoCache = [];
let historicoSaidasCache = [];
let saidaLista = [];
let estruturasSubmontagemCache = new Map();
let composicoesVendaCache = new Map();
let submontagensCache = [];
let submontagensExpedicaoCache = [];
let producaoEmAndamentoCache = [];
let autoRefreshHandle = null;
let efetuarFaltantesCache = [];
let solicitacaoLista = [];

const refs = {
  mensagem: document.getElementById('expedicao-mensagem'),
  saidaMensagem: document.getElementById('expedicao-saida-mensagem'),
  itemId: document.getElementById('expedicao-item-id'),
  itemBusca: document.getElementById('expedicao-item-busca'),
  itemSugestoes: document.getElementById('expedicao-item-sugestoes'),
  itemResumo: document.getElementById('expedicao-item-resumo'),
  quantidade: document.getElementById('expedicao-quantidade'),
  tipoSaida: document.getElementById('expedicao-tipo-saida'),
  observacao: document.getElementById('expedicao-observacao'),
  listaTbody: document.getElementById('expedicao-lista-tbody'),
  pedidosTbody: document.getElementById('expedicao-pedidos-tbody'),
  pedidosFiltroSituacao: document.getElementById('expedicao-pedidos-filtro-situacao'),
  historicoTbody: document.getElementById('expedicao-historico-tbody'),
  estoqueTbody: document.getElementById('expedicao-estoque-tbody'),
  filtroCodigo: document.getElementById('expedicao-filtro-codigo'),
  filtroDescricao: document.getElementById('expedicao-filtro-descricao'),
  filtroClassificacao: document.getElementById('expedicao-filtro-classificacao'),
  filtroQuantidade: document.getElementById('expedicao-filtro-quantidade'),
  badgePedidos: document.getElementById('expedicao-badge-pedidos'),
  badgeProducao: document.getElementById('expedicao-badge-producao'),
  estruturaModal: document.getElementById('expedicao-estrutura-modal'),
  estruturaMensagem: document.getElementById('expedicao-estrutura-mensagem'),
  estruturaTitulo: document.getElementById('expedicao-estrutura-titulo'),
  estruturaSubtitulo: document.getElementById('expedicao-estrutura-subtitulo'),
  estruturaTbody: document.getElementById('expedicao-estrutura-tbody'),
  historicoItemModal: document.getElementById('expedicao-historico-item-modal'),
  historicoItemMensagem: document.getElementById('expedicao-historico-item-mensagem'),
  historicoItemTitulo: document.getElementById('expedicao-historico-item-titulo'),
  historicoItemSubtitulo: document.getElementById('expedicao-historico-item-subtitulo'),
  historicoItemTbody: document.getElementById('expedicao-historico-item-tbody'),
  saldosItemModal: document.getElementById('expedicao-saldos-item-modal'),
  saldosItemMensagem: document.getElementById('expedicao-saldos-item-mensagem'),
  saldosItemTitulo: document.getElementById('expedicao-saldos-item-titulo'),
  saldosItemSubtitulo: document.getElementById('expedicao-saldos-item-subtitulo'),
  saldosItemTbody: document.getElementById('expedicao-saldos-item-tbody'),
  saidaModal: document.getElementById('expedicao-saida-modal'),
  faltasModal: document.getElementById('expedicao-faltas-modal'),
  faltasSubtitulo: document.getElementById('expedicao-faltas-subtitulo'),
  faltasTbody: document.getElementById('expedicao-faltas-tbody'),
  retornoModal: document.getElementById('expedicao-retorno-modal'),
  retornoMensagem: document.getElementById('expedicao-retorno-mensagem'),
  retornoForm: document.getElementById('expedicao-retorno-form'),
  retornoItemId: document.getElementById('expedicao-retorno-item-id'),
  retornoBusca: document.getElementById('expedicao-retorno-item-busca'),
  retornoSugestoes: document.getElementById('expedicao-retorno-item-sugestoes'),
  retornoResumo: document.getElementById('expedicao-retorno-item-resumo'),
  retornoDestino: document.getElementById('expedicao-retorno-destino'),
  retornoQuantidade: document.getElementById('expedicao-retorno-quantidade'),
  retornoObservacao: document.getElementById('expedicao-retorno-observacao'),
  pedidosModal: document.getElementById('expedicao-pedidos-modal'),
  historicoModal: document.getElementById('expedicao-historico-modal'),
  producaoModal: document.getElementById('expedicao-producao-modal'),
  producaoMensagem: document.getElementById('expedicao-producao-mensagem'),
  producaoTbody: document.getElementById('expedicao-producao-tbody'),
  consumirProducaoModal: document.getElementById('expedicao-consumir-producao-modal'),
  consumirProducaoMensagem: document.getElementById('expedicao-consumir-producao-mensagem'),
  consumirProducaoForm: document.getElementById('expedicao-consumir-producao-form'),
  consumirProducaoId: document.getElementById('expedicao-consumir-producao-id'),
  consumirProducaoResumo: document.getElementById('expedicao-consumir-producao-resumo'),
  consumirProducaoQuantidade: document.getElementById('expedicao-consumir-producao-quantidade'),
  consumirProducaoObservacao: document.getElementById('expedicao-consumir-producao-observacao'),
  solicitacaoModal: document.getElementById('expedicao-solicitacao-modal'),
  solicitacaoMensagem: document.getElementById('expedicao-solicitacao-mensagem'),
  solicitacaoForm: document.getElementById('expedicao-solicitacao-form'),
  solicitacaoOrigem: document.getElementById('expedicao-solicitacao-origem'),
  solicitacaoItemId: document.getElementById('expedicao-solicitacao-item-id'),
  solicitacaoBusca: document.getElementById('expedicao-solicitacao-item-busca'),
  solicitacaoSugestoes: document.getElementById('expedicao-solicitacao-item-sugestoes'),
  solicitacaoResumo: document.getElementById('expedicao-solicitacao-item-resumo'),
  solicitacaoQuantidade: document.getElementById('expedicao-solicitacao-quantidade'),
  solicitacaoObservacao: document.getElementById('expedicao-solicitacao-observacao'),
  solicitacaoListaTbody: document.getElementById('expedicao-solicitacao-lista-tbody'),
  solicitacaoListaTotal: document.getElementById('expedicao-solicitacao-lista-total'),
  solicitacaoEnviar: document.getElementById('btn-expedicao-solicitacao-enviar'),
  efetuarModal: document.getElementById('expedicao-efetuar-modal'),
  efetuarMensagem: document.getElementById('expedicao-efetuar-mensagem'),
  efetuarForm: document.getElementById('expedicao-efetuar-form'),
  efetuarSubmontagemId: document.getElementById('expedicao-efetuar-submontagem-id'),
  efetuarBusca: document.getElementById('expedicao-efetuar-submontagem-busca'),
  efetuarSugestoes: document.getElementById('expedicao-efetuar-submontagem-sugestoes'),
  efetuarQuantidade: document.getElementById('expedicao-efetuar-quantidade'),
  efetuarObservacao: document.getElementById('expedicao-efetuar-observacao'),
  efetuarPreviewTitulo: document.getElementById('expedicao-efetuar-preview-titulo'),
  efetuarPreviewSubtitulo: document.getElementById('expedicao-efetuar-preview-subtitulo'),
  efetuarPreviewProntoChip: document.getElementById('expedicao-efetuar-preview-pronto-chip'),
  efetuarPreviewComponentesChip: document.getElementById('expedicao-efetuar-preview-componentes-chip'),
  efetuarPreviewStatusChip: document.getElementById('expedicao-efetuar-preview-status-chip'),
  efetuarPreviewTbody: document.getElementById('expedicao-efetuar-preview-tbody'),
  efetuarSolicitarFaltantes: document.getElementById('btn-expedicao-efetuar-solicitar-faltantes'),
  efetuarSubmit: document.getElementById('btn-confirmar-modal-expedicao-efetuar'),
  desmembrarModal: document.getElementById('expedicao-desmembrar-modal'),
  desmembrarMensagem: document.getElementById('expedicao-desmembrar-mensagem'),
  desmembrarForm: document.getElementById('expedicao-desmembrar-form'),
  desmembrarSubmontagemId: document.getElementById('expedicao-desmembrar-submontagem-id'),
  desmembrarBusca: document.getElementById('expedicao-desmembrar-submontagem-busca'),
  desmembrarSugestoes: document.getElementById('expedicao-desmembrar-submontagem-sugestoes'),
  desmembrarQuantidade: document.getElementById('expedicao-desmembrar-quantidade'),
  desmembrarDestino: document.getElementById('expedicao-desmembrar-destino'),
  desmembrarObservacao: document.getElementById('expedicao-desmembrar-observacao'),
  desmembrarPreviewTitulo: document.getElementById('expedicao-desmembrar-preview-titulo'),
  desmembrarPreviewSubtitulo: document.getElementById('expedicao-desmembrar-preview-subtitulo'),
  desmembrarPreviewProntoChip: document.getElementById('expedicao-desmembrar-preview-pronto-chip'),
  desmembrarPreviewComponentesChip: document.getElementById('expedicao-desmembrar-preview-componentes-chip'),
  desmembrarPreviewStatusChip: document.getElementById('expedicao-desmembrar-preview-status-chip'),
  desmembrarPreviewTbody: document.getElementById('expedicao-desmembrar-preview-tbody'),
  desmembrarSubmit: document.getElementById('btn-confirmar-modal-expedicao-desmembrar'),
  simulacaoModal: document.getElementById('expedicao-simulacao-modal'),
  simulacaoMensagem: document.getElementById('expedicao-simulacao-mensagem'),
  simulacaoForm: document.getElementById('expedicao-simulacao-form'),
  simulacaoSubmontagemId: document.getElementById('expedicao-simulacao-submontagem-id'),
  simulacaoBusca: document.getElementById('expedicao-simulacao-submontagem-busca'),
  simulacaoSugestoes: document.getElementById('expedicao-simulacao-submontagem-sugestoes'),
  simulacaoQuantidade: document.getElementById('expedicao-simulacao-quantidade'),
  simulacaoResumo: document.getElementById('expedicao-simulacao-resumo'),
  simulacaoTbody: document.getElementById('expedicao-simulacao-tbody'),
  solicitacaoProducaoModal: document.getElementById('expedicao-producao-solicitacao-modal'),
  solicitacaoProducaoMensagem: document.getElementById('expedicao-producao-solicitacao-mensagem'),
  solicitacaoProducaoForm: document.getElementById('expedicao-producao-solicitacao-form'),
  solicitacaoProducaoItemId: document.getElementById('expedicao-producao-solicitacao-item-id'),
  solicitacaoProducaoResumo: document.getElementById('expedicao-producao-solicitacao-resumo'),
  solicitacaoProducaoQuantidade: document.getElementById('expedicao-producao-solicitacao-quantidade'),
  solicitacaoProducaoObservacao: document.getElementById('expedicao-producao-solicitacao-observacao')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();

  try {
    await carregarTudo();
    iniciarAtualizacaoAutomatica();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
});

function bindEvents() {
  refs.itemBusca.addEventListener('input', async () => {
    refs.itemId.value = '';
    renderizarResumoItem(null);
    await renderizarSugestoes(refs.itemBusca.value.trim());
  });
  refs.itemBusca.addEventListener('focus', async () => {
    await renderizarSugestoes(refs.itemBusca.value.trim());
  });
  refs.itemSugestoes.addEventListener('click', (event) => {
    handleSugestaoClick(event).catch((error) => {
      console.error('Falha ao selecionar item para venda na Expedicao:', error);
      mostrarMensagemSaida(error.message || 'Nao foi possivel carregar a disponibilidade do item.', 'error');
    });
  });
  document.getElementById('expedicao-btn-adicionar').addEventListener('click', () => {
    adicionarItemNaLista().catch((error) => {
      console.error('Falha ao adicionar item na lista de saida:', error);
      mostrarMensagemSaida(error.message || 'Nao foi possivel adicionar o item.', 'error');
    });
  });
  document.getElementById('expedicao-btn-limpar-item').addEventListener('click', limparItemAtual);
  document.getElementById('expedicao-btn-baixar').addEventListener('click', baixarSaida);
  refs.tipoSaida.addEventListener('change', atualizarObrigatoriedadeObservacaoSaida);
  refs.listaTbody.addEventListener('click', handleListaActions);

  document.getElementById('expedicao-btn-saida-menu').addEventListener('click', abrirModalSaida);
  document.getElementById('expedicao-btn-retornar').addEventListener('click', abrirModalRetorno);
  document.getElementById('expedicao-btn-desmembrar').addEventListener('click', abrirModalDesmembrar);
  document.getElementById('expedicao-btn-solicitar').addEventListener('click', () => abrirModalSolicitacao());
  document.getElementById('expedicao-btn-solicitar-inline').addEventListener('click', () => abrirModalSolicitacao());
  document.getElementById('expedicao-btn-efetuar').addEventListener('click', abrirModalEfetuarMontagem);
  document.getElementById('expedicao-btn-simular').addEventListener('click', abrirModalSimulacao);
  document.getElementById('expedicao-btn-pedidos-menu').addEventListener('click', abrirModalPedidos);
  document.getElementById('expedicao-btn-historico-menu').addEventListener('click', abrirModalHistorico);
  document.getElementById('expedicao-btn-producao').addEventListener('click', abrirModalProducao);
  document.getElementById('expedicao-btn-excluir-todos-pedidos').addEventListener('click', excluirTodosPedidosExpedicao);
  refs.pedidosFiltroSituacao.addEventListener('change', renderizarPedidos);
  refs.pedidosTbody.addEventListener('click', handlePedidosActions);
  refs.filtroCodigo.addEventListener('input', renderizarEstoque);
  refs.filtroDescricao.addEventListener('input', renderizarEstoque);
  refs.filtroClassificacao.addEventListener('change', renderizarEstoque);
  refs.filtroQuantidade.addEventListener('change', renderizarEstoque);
  refs.estoqueTbody.addEventListener('click', handleEstoqueActions);
  document.getElementById('expedicao-btn-limpar-filtros-estoque').addEventListener('click', limparFiltrosEstoque);
  document.getElementById('btn-fechar-modal-expedicao-estrutura').addEventListener('click', fecharModalEstrutura);
  document.getElementById('btn-fechar-modal-expedicao-saida').addEventListener('click', fecharModalSaida);
  document.getElementById('btn-fechar-modal-expedicao-faltas').addEventListener('click', fecharModalFaltas);
  document.getElementById('btn-fechar-modal-expedicao-faltas-rodape').addEventListener('click', fecharModalFaltas);
  document.getElementById('btn-fechar-modal-expedicao-retorno').addEventListener('click', fecharModalRetorno);
  document.getElementById('btn-cancelar-modal-expedicao-retorno').addEventListener('click', fecharModalRetorno);
  document.getElementById('btn-fechar-modal-expedicao-pedidos').addEventListener('click', fecharModalPedidos);
  document.getElementById('btn-fechar-modal-expedicao-historico').addEventListener('click', fecharModalHistorico);
  document.getElementById('btn-fechar-modal-expedicao-producao').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-expedicao-producao-rodape').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-expedicao-consumir-producao').addEventListener('click', fecharModalConsumirProducao);
  document.getElementById('btn-cancelar-modal-expedicao-consumir-producao').addEventListener('click', fecharModalConsumirProducao);
  refs.producaoTbody.addEventListener('click', handleProducaoActions);
  refs.consumirProducaoForm.addEventListener('submit', handleConsumirProducao);
  document.getElementById('btn-fechar-modal-expedicao-historico-item').addEventListener('click', fecharModalHistoricoItem);
  document.getElementById('btn-fechar-modal-expedicao-saldos-item').addEventListener('click', fecharModalSaldosItem);
  document.getElementById('btn-fechar-modal-expedicao-solicitacao').addEventListener('click', fecharModalSolicitacao);
  document.getElementById('btn-cancelar-modal-expedicao-solicitacao').addEventListener('click', fecharModalSolicitacao);
  document.getElementById('btn-fechar-modal-expedicao-efetuar').addEventListener('click', fecharModalEfetuarMontagem);
  document.getElementById('btn-cancelar-modal-expedicao-efetuar').addEventListener('click', fecharModalEfetuarMontagem);
  refs.efetuarSolicitarFaltantes.addEventListener('click', handleSolicitarFaltantesExpedicao);
  document.getElementById('btn-fechar-modal-expedicao-desmembrar').addEventListener('click', fecharModalDesmembrar);
  document.getElementById('btn-cancelar-modal-expedicao-desmembrar').addEventListener('click', fecharModalDesmembrar);
  document.getElementById('btn-fechar-modal-expedicao-simulacao').addEventListener('click', fecharModalSimulacao);
  document.getElementById('btn-fechar-modal-expedicao-producao-solicitacao').addEventListener('click', fecharModalSolicitacaoProducao);
  document.getElementById('btn-cancelar-modal-expedicao-producao-solicitacao').addEventListener('click', fecharModalSolicitacaoProducao);

  refs.retornoForm.addEventListener('submit', handleRetorno);
  refs.retornoBusca.addEventListener('input', () => {
    refs.retornoItemId.value = '';
    renderizarResumoRetorno(null);
    renderizarSugestoesRetorno(refs.retornoBusca.value.trim());
  });
  refs.retornoBusca.addEventListener('focus', () => renderizarSugestoesRetorno(refs.retornoBusca.value.trim()));
  refs.retornoSugestoes.addEventListener('click', handleSugestaoRetornoClick);

  refs.solicitacaoForm.addEventListener('submit', handleAdicionarSolicitacaoNaLista);
  refs.solicitacaoOrigem.addEventListener('change', handleSolicitacaoOrigemChange);
  refs.solicitacaoBusca.addEventListener('input', () => {
    refs.solicitacaoItemId.value = '';
    renderizarResumoItemSolicitacao(null);
    renderizarSugestoesSolicitacao(refs.solicitacaoBusca.value.trim());
  });
  refs.solicitacaoBusca.addEventListener('focus', () => renderizarSugestoesSolicitacao(refs.solicitacaoBusca.value.trim()));
  refs.solicitacaoSugestoes.addEventListener('click', handleSugestaoSolicitacaoClick);
  refs.solicitacaoListaTbody.addEventListener('click', handleSolicitacaoListaActions);
  refs.solicitacaoEnviar.addEventListener('click', enviarSolicitacoesDaLista);

  refs.efetuarForm.addEventListener('submit', handleEfetuarMontagem);
  refs.efetuarBusca.addEventListener('input', () => {
    refs.efetuarSubmontagemId.value = '';
    atualizarPreviewEfetuarMontagem();
    renderizarSugestoesEfetuarMontagem(refs.efetuarBusca.value.trim());
  });
  refs.efetuarBusca.addEventListener('focus', () => renderizarSugestoesEfetuarMontagem(refs.efetuarBusca.value.trim()));
  refs.efetuarSugestoes.addEventListener('click', handleSugestaoEfetuarMontagemClick);
  refs.efetuarQuantidade.addEventListener('input', () => atualizarPreviewEfetuarMontagem());

  refs.desmembrarForm.addEventListener('submit', handleDesmembrarSubmontagem);
  refs.desmembrarBusca.addEventListener('input', () => {
    refs.desmembrarSubmontagemId.value = '';
    atualizarPreviewDesmembrar();
    renderizarSugestoesDesmembrar(refs.desmembrarBusca.value.trim());
  });
  refs.desmembrarBusca.addEventListener('focus', () => renderizarSugestoesDesmembrar(refs.desmembrarBusca.value.trim()));
  refs.desmembrarSugestoes.addEventListener('click', handleSugestaoDesmembrarClick);
  refs.desmembrarQuantidade.addEventListener('input', () => atualizarPreviewDesmembrar());
  refs.desmembrarDestino.addEventListener('change', () => atualizarPreviewDesmembrar());

  refs.simulacaoForm.addEventListener('submit', handleSimular);
  refs.simulacaoBusca.addEventListener('input', () => {
    refs.simulacaoSubmontagemId.value = '';
    renderizarSugestoesSubmontagem(refs.simulacaoBusca.value.trim());
  });
  refs.simulacaoBusca.addEventListener('focus', () => renderizarSugestoesSubmontagem(refs.simulacaoBusca.value.trim()));
  refs.simulacaoSugestoes.addEventListener('click', handleSugestaoSubmontagemClick);
  refs.simulacaoTbody.addEventListener('click', handleSimulacaoActions);

  refs.solicitacaoProducaoForm.addEventListener('submit', handleCriarSolicitacaoProducao);

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.row-menu-trigger');
    if (trigger) {
      const currentMenu = trigger.closest('.row-menu');
      window.requestAnimationFrame(() => {
        const shouldKeepOpen = currentMenu && currentMenu.hasAttribute('open');
        closeAllRowMenus(shouldKeepOpen ? currentMenu : null);
      });
    } else if (event.target.closest('.row-menu-item')) {
      closeAllRowMenus();
    } else if (!event.target.closest('.row-menu')) {
      closeAllRowMenus();
    }

    if (!event.target.closest('.autocomplete')) {
      esconderSugestoes();
      esconderSugestoesRetorno();
      esconderSugestoesSolicitacao();
      esconderSugestoesEfetuarMontagem();
      esconderSugestoesDesmembrar();
      esconderSugestoesSubmontagem();
    }
  });

  [
    refs.estruturaModal,
    refs.historicoItemModal,
    refs.saldosItemModal,
    refs.saidaModal,
    refs.retornoModal,
    refs.pedidosModal,
    refs.historicoModal,
    refs.producaoModal,
    refs.consumirProducaoModal,
    refs.solicitacaoModal,
    refs.efetuarModal,
    refs.desmembrarModal,
    refs.simulacaoModal,
    refs.solicitacaoProducaoModal
  ].forEach((modal) => modal.addEventListener('click', handleModalBackdrop));

  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarTudo() {
  await carregarEstoques();
  await carregarItens();
  await carregarSubmontagens();
  await carregarComposicoesVenda();
  await Promise.all([
    carregarEstoqueMontagem(),
    carregarEstoqueExpedicao(),
    carregarPedidosExpedicao(),
    carregarHistoricoSaidas(),
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
}

async function carregarItens() {
  const response = await fetch(estoqueItensApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os itens.');
  }

  itensCache = result;
}

async function carregarSubmontagens() {
  const response = await fetch(submontagensApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as submontagens.');
  }

  submontagensCache = result;
}

async function carregarComposicoesVenda() {
  const response = await fetch(composicoesVendaApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as composicoes de venda.');
  }

  composicoesVendaCache = new Map();
  (Array.isArray(result) ? result : []).forEach((linha) => {
    const idItemVenda = Number(linha.id_item_venda);
    if (!composicoesVendaCache.has(idItemVenda)) {
      composicoesVendaCache.set(idItemVenda, []);
    }

    composicoesVendaCache.get(idItemVenda).push({
      ...linha,
      id_item_atende: Number(linha.id_item_atende),
      quantidade: Number(linha.quantidade || 0)
    });
  });
}

async function carregarSubmontagensExpedicaoDisponiveis() {
  const expedicao = obterEstoquePorNome('exped');
  if (!expedicao) {
    throw new Error('Estoque da Expedicao nao encontrado.');
  }

  const response = await fetch(`${submontagensApiBaseUrl}?estoque_referencia=${expedicao.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as submontagens disponiveis na Expedicao.');
  }

  submontagensExpedicaoCache = Array.isArray(result) ? result : [];
}

async function carregarEstoqueExpedicao() {
  const expedicao = obterEstoquePorNome('exped');
  if (!expedicao) {
    throw new Error('Estoque da Expedicao nao encontrado.');
  }

  const response = await fetch(`${estoqueSaldosApiBaseUrl}?estoque=${expedicao.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o estoque da Expedicao.');
  }

  saldosExpedicaoCache = result;
  renderizarEstoque();
  atualizarIndicadores();
}

async function carregarEstoqueMontagem() {
  const montagem = obterEstoquePorNome('mont');
  if (!montagem) {
    throw new Error('Estoque da Montagem nao encontrado.');
  }

  const response = await fetch(`${estoqueSaldosApiBaseUrl}?estoque=${montagem.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o estoque da Montagem.');
  }

  saldosMontagemCache = result;
}

async function carregarPedidosExpedicao() {
  const response = await fetch(`${solicitacoesApiBaseUrl}?area_origem=EXPEDICAO`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os pedidos da Expedicao.');
  }

  pedidosExpedicaoCache = result;
  renderizarPedidos();
  atualizarIndicadores();
}

async function carregarHistoricoSaidas() {
  const expedicao = obterEstoquePorNome('exped');
  if (!expedicao) {
    throw new Error('Estoque da Expedicao nao encontrado.');
  }

  const response = await fetch(`${estoqueMovimentacoesApiBaseUrl}?estoque=${expedicao.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o historico de saidas.');
  }

  historicoSaidasCache = result
    .filter((item) => String(item.tipo_movimentacao || '').toUpperCase() === 'SAIDA')
    .slice(0, 30);
  renderizarHistorico();
}

async function carregarEstruturasParaSugestoesVenda(termo) {
  const filtro = normalizarBusca(termo);
  if (!filtro) {
    return;
  }

  const candidatos = itensCache
    .filter((item) => (
      (item.classificacao === 'SUBMONTAGEM' || composicoesVendaCache.has(Number(item.id)))
      && normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro)
    ))
    .slice(0, 8);

  if (!candidatos.length) {
    return;
  }

  await Promise.allSettled(candidatos.map((item) => garantirDisponibilidadeVendaCarregada(item)));
}

async function garantirDisponibilidadeVendaCarregada(item) {
  if (!item) {
    return;
  }

  const carregamentos = [];

  if (item.classificacao === 'SUBMONTAGEM' && !estruturasSubmontagemCache.has(item.id)) {
    carregamentos.push(carregarEstruturaSubmontagem(item.id));
  }

  const composicao = composicoesVendaCache.get(Number(item.id)) || [];
  composicao.forEach((linha) => {
    const itemAtende = itensCache.find((entry) => Number(entry.id) === Number(linha.id_item_atende));

    if (itemAtende?.classificacao === 'SUBMONTAGEM' && !estruturasSubmontagemCache.has(itemAtende.id)) {
      carregamentos.push(carregarEstruturaSubmontagem(itemAtende.id));
    }
  });

  if (carregamentos.length) {
    await Promise.allSettled(carregamentos);
  }
}

async function renderizarSugestoes(termo) {
  const filtro = normalizarBusca(termo);
  await carregarEstruturasParaSugestoesVenda(termo);

  const itens = itensCache.filter((item) => {
    const disponibilidade = obterDisponibilidadeVenda(item);

    if (!filtro) {
      return disponibilidade > 0;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.itemSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum item encontrado para venda.</div>';
    refs.itemSugestoes.classList.remove('hidden');
    return;
  }

  refs.itemSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`${item.classificacao} | Disponivel: ${formatInteger(obterDisponibilidadeVenda(item))}`)}</span>
    </button>
  `).join('');
  refs.itemSugestoes.classList.remove('hidden');
}

async function handleSugestaoClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  await garantirDisponibilidadeVendaCarregada(item);
  refs.itemId.value = String(item.id);
  refs.itemBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoItem(item);
  esconderSugestoes();
}

function renderizarResumoItem(item) {
  if (!item) {
    refs.itemResumo.classList.add('selected-tags', 'empty');
    refs.itemResumo.textContent = 'Selecione um item para ver a disponibilidade atual em Expedicao + Montagem.';
    return;
  }

  refs.itemResumo.classList.remove('empty');
  refs.itemResumo.classList.add('selected-tags');
  refs.itemResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Disponivel para venda: ${formatInteger(obterDisponibilidadeVenda(item))}`)}</span>
  `;
}

function abrirModalSolicitacao(prefill = null) {
  refs.solicitacaoMensagem.className = 'message hidden';
  refs.solicitacaoMensagem.textContent = '';
  solicitacaoLista = [];
  renderizarListaSolicitacao();

  if (prefill) {
    preencherSolicitacaoEstoque(prefill);
  } else {
    refs.solicitacaoForm.reset();
    refs.solicitacaoOrigem.value = 'ALMOXARIFADO';
    refs.solicitacaoQuantidade.value = '1';
    refs.solicitacaoItemId.value = '';
    refs.solicitacaoBusca.value = '';
    renderizarResumoItemSolicitacao(null);
  }

  openModal(refs.solicitacaoModal);
}

function abrirModalSaida() {
  if (!refs.tipoSaida.value) {
    refs.tipoSaida.value = TIPO_SAIDA_PADRAO;
  }

  atualizarObrigatoriedadeObservacaoSaida();
  openModal(refs.saidaModal);
}

function fecharModalSaida() {
  closeModal(refs.saidaModal);
}

function abrirModalFaltas(details) {
  const itemVendaCodigo = details?.item_venda?.codigo || '-';
  const itemVendaDescricao = details?.item_venda?.descricao || '-';
  const faltas = Array.isArray(details?.faltas) ? details.faltas : [];

  refs.faltasSubtitulo.textContent = `Venda bloqueada para ${itemVendaCodigo} - ${itemVendaDescricao}. Regularize os itens abaixo.`;

  if (!faltas.length) {
    refs.faltasTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma pendencia detalhada recebida.</td></tr>';
  } else {
    refs.faltasTbody.innerHTML = faltas.map((falta) => `
      <tr>
        <td class="table-code">${escapeHtml(falta.item_venda_codigo || itemVendaCodigo)}</td>
        <td class="table-code">${escapeHtml(falta.codigo || '-')}</td>
        <td class="table-description">${escapeHtml(falta.descricao || '-')}</td>
        <td class="table-quantity">${formatDecimal(falta.necessario)}</td>
        <td class="table-quantity">${formatDecimal(falta.disponivel_expedicao)}</td>
        <td class="table-quantity">${formatDecimal(falta.disponivel_montagem)}</td>
        <td class="table-quantity">${formatDecimal(falta.disponivel_total)}</td>
        <td class="table-quantity">${formatDecimal(falta.falta)}</td>
      </tr>
    `).join('');
  }

  openModal(refs.faltasModal);
}

function fecharModalFaltas() {
  closeModal(refs.faltasModal);
}

function atualizarObrigatoriedadeObservacaoSaida() {
  const exigeObservacao = refs.tipoSaida.value === 'OUTROS';
  refs.observacao.required = exigeObservacao;
  refs.observacao.placeholder = exigeObservacao ? 'Obrigatoria para Outros' : 'Opcional';
}

async function abrirModalEstrutura(submontagemId) {
  const item = saldosExpedicaoCache.find((entry) => Number(entry.id_peca) === Number(submontagemId))
    || itensCache.find((entry) => Number(entry.id) === Number(submontagemId))
    || submontagensCache.find((entry) => Number(entry.id) === Number(submontagemId));

  refs.estruturaMensagem.className = 'message hidden';
  refs.estruturaMensagem.textContent = '';
  refs.estruturaTitulo.textContent = item
    ? `Estrutura de ${item.codigo}`
    : 'Estrutura da submontagem';
  refs.estruturaSubtitulo.textContent = item
    ? `${item.descricao} | Componentes usados na Expedicao.`
    : 'Veja o que entra nesta submontagem e o saldo atual dos componentes na Expedicao.';
  refs.estruturaTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Carregando estrutura...</td></tr>';
  openModal(refs.estruturaModal);

  try {
    const componentes = await carregarEstruturaSubmontagem(submontagemId);

    if (!componentes.length) {
      refs.estruturaTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Esta submontagem nao possui componentes cadastrados.</td></tr>';
      return;
    }

    refs.estruturaTbody.innerHTML = componentes.map((componente) => `
      <tr>
        <td class="table-code">${escapeHtml(componente.codigo_componente)}</td>
        <td class="table-description">${escapeHtml(componente.descricao_componente)}</td>
        <td class="table-quantity">${formatDecimal(componente.quantidade)}</td>
        <td class="table-quantity">${formatDecimal(obterSaldoExpedicao(componente.id_item_componente))}</td>
      </tr>
    `).join('');
  } catch (error) {
    refs.estruturaMensagem.textContent = error.message;
    refs.estruturaMensagem.className = 'message error';
    refs.estruturaMensagem.classList.remove('hidden');
    refs.estruturaTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nao foi possivel carregar a estrutura.</td></tr>';
  }
}

function fecharModalEstrutura() {
  closeModal(refs.estruturaModal);
}

async function abrirModalHistoricoItem(itemId) {
  const item = saldosExpedicaoCache.find((entry) => Number(entry.id_peca) === Number(itemId))
    || itensCache.find((entry) => Number(entry.id) === Number(itemId));

  refs.historicoItemMensagem.className = 'message hidden';
  refs.historicoItemMensagem.textContent = '';
  refs.historicoItemTitulo.textContent = item
    ? `Historico de ${item.codigo}`
    : 'Historico da peca';
  refs.historicoItemSubtitulo.textContent = item
    ? `${item.descricao} | Ultimas movimentacoes deste item.`
    : 'Veja as ultimas movimentacoes desta peca no sistema.';
  refs.historicoItemTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Carregando historico...</td></tr>';
  openModal(refs.historicoItemModal);

  try {
    const response = await fetch(`${estoqueMovimentacoesApiBaseUrl}?idPeca=${itemId}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar o historico da peca.');
    }

    if (!Array.isArray(result) || !result.length) {
      refs.historicoItemTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma movimentacao encontrada para este item.</td></tr>';
      return;
    }

    refs.historicoItemTbody.innerHTML = result.map((movimentacao) => `
      <tr>
        <td>${formatarDataHora(movimentacao.data_movimentacao)}</td>
        <td>${escapeHtml(movimentacao.tipo_movimentacao || '-')}</td>
        <td>${escapeHtml(movimentacao.estoque_origem_nome || '-')}</td>
        <td>${escapeHtml(movimentacao.estoque_destino_nome || '-')}</td>
        <td class="table-quantity">${formatDecimal(movimentacao.quantidade)}</td>
        <td>${escapeHtml(movimentacao.observacao || '-')}</td>
      </tr>
    `).join('');
  } catch (error) {
    refs.historicoItemMensagem.textContent = error.message;
    refs.historicoItemMensagem.className = 'message error';
    refs.historicoItemMensagem.classList.remove('hidden');
    refs.historicoItemTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nao foi possivel carregar o historico.</td></tr>';
  }
}

function fecharModalHistoricoItem() {
  closeModal(refs.historicoItemModal);
}

async function abrirModalSaldosItem(itemId) {
  const item = saldosExpedicaoCache.find((entry) => Number(entry.id_peca) === Number(itemId))
    || itensCache.find((entry) => Number(entry.id) === Number(itemId));

  refs.saldosItemMensagem.className = 'message hidden';
  refs.saldosItemMensagem.textContent = '';
  refs.saldosItemTitulo.textContent = item
    ? `Saldos de ${item.codigo}`
    : 'Saldo nos estoques';
  refs.saldosItemSubtitulo.textContent = item
    ? `${item.descricao} | Estoques com saldo positivo para este item.`
    : 'Veja em quais estoques este item esta disponivel.';
  refs.saldosItemTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Carregando saldos...</td></tr>';
  openModal(refs.saldosItemModal);

  try {
    const response = await fetch(`${estoqueSaldosApiBaseUrl}?id_peca=${itemId}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar os saldos da peca.');
    }

    if (!Array.isArray(result) || !result.length) {
      refs.saldosItemTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum saldo encontrado para este item.</td></tr>';
      return;
    }

    refs.saldosItemTbody.innerHTML = result.map((saldo) => `
      <tr>
        <td>${escapeHtml(saldo.estoque_nome || '-')}</td>
        <td class="table-code">${escapeHtml(saldo.codigo || '-')}</td>
        <td class="table-description">${escapeHtml(saldo.descricao || '-')}</td>
        <td>${escapeHtml(saldo.classificacao || '-')}</td>
        <td class="table-quantity">${formatDecimal(saldo.quantidade)}</td>
      </tr>
    `).join('');
  } catch (error) {
    refs.saldosItemMensagem.textContent = error.message;
    refs.saldosItemMensagem.className = 'message error';
    refs.saldosItemMensagem.classList.remove('hidden');
    refs.saldosItemTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nao foi possivel carregar os saldos.</td></tr>';
  }
}

function fecharModalSaldosItem() {
  closeModal(refs.saldosItemModal);
}

function obterEstoquesDestinoRetorno({ incluirExpedicao = false } = {}) {
  const expedicao = obterEstoquePorNome('exped');

  return estoquesCache.filter((estoque) => (
    Number(estoque.ativo) === 1
    && (
      incluirExpedicao
      || !expedicao
      || Number(estoque.id) !== Number(expedicao.id)
    )
  ));
}

function preencherSelectDestinosRetorno(select, { incluirExpedicao = false, selecionadoId = '' } = {}) {
  const opcoes = obterEstoquesDestinoRetorno({ incluirExpedicao });
  select.innerHTML = `
    <option value="">Selecione</option>
    ${opcoes.map((estoque) => `<option value="${estoque.id}">${escapeHtml(estoque.nome)}</option>`).join('')}
  `;

  if (selecionadoId !== '' && selecionadoId !== null && selecionadoId !== undefined) {
    select.value = String(selecionadoId);
  }
}

function abrirModalRetorno() {
  refs.retornoMensagem.className = 'message hidden';
  refs.retornoMensagem.textContent = '';
  refs.retornoForm.reset();
  refs.retornoItemId.value = '';
  refs.retornoQuantidade.value = '1';
  refs.retornoBusca.value = '';
  preencherSelectDestinosRetorno(refs.retornoDestino);
  renderizarResumoRetorno(null);
  esconderSugestoesRetorno();
  openModal(refs.retornoModal);
}

function fecharModalRetorno() {
  closeModal(refs.retornoModal);
}

function renderizarSugestoesRetorno(termo) {
  const filtro = normalizarBusca(termo);
  const itens = saldosExpedicaoCache.filter((item) => {
    if (Number(item.quantidade || 0) <= 0) {
      return false;
    }

    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  }).slice(0, 8);

  renderizarPainelAutocomplete(
    refs.retornoSugestoes,
    itens,
    (item) => ({
      id: item.id_peca,
      title: `${item.codigo} - ${item.descricao}`,
      subtitle: `${item.classificacao} | Saldo na Expedicao: ${formatInteger(item.quantidade)}`
    }),
    'Nenhum item pronto disponivel na Expedicao.'
  );
}

function handleSugestaoRetornoClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = saldosExpedicaoCache.find((entry) => Number(entry.id_peca) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.retornoItemId.value = String(item.id_peca);
  refs.retornoBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoRetorno(item);
  esconderSugestoesRetorno();
}

function renderizarResumoRetorno(item) {
  if (!item) {
    refs.retornoResumo.classList.add('selected-tags', 'empty');
    refs.retornoResumo.textContent = 'Selecione o item pronto que vai sair da Expedicao.';
    return;
  }

  refs.retornoResumo.classList.remove('empty');
  refs.retornoResumo.classList.add('selected-tags');
  refs.retornoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo na Expedicao: ${formatInteger(item.quantidade)}`)}</span>
  `;
}

async function handleRetorno(event) {
  event.preventDefault();

  try {
    const expedicao = obterEstoquePorNome('exped');
    if (!expedicao) {
      throw new Error('Estoque da Expedicao nao encontrado.');
    }

    if (!refs.retornoItemId.value) {
      throw new Error('Selecione um item valido para retorno.');
    }

    if (!refs.retornoDestino.value) {
      throw new Error('Selecione o estoque de destino.');
    }

    const response = await fetch(transferenciaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: refs.retornoItemId.value,
        id_estoque_origem: expedicao.id,
        id_estoque_destino: refs.retornoDestino.value,
        quantidade: refs.retornoQuantidade.value,
        observacao: refs.retornoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel devolver o item para outro estoque.');
    }

    fecharModalRetorno();
    mostrarMensagem('Item pronto transferido com sucesso.', 'success');
    await Promise.all([
      carregarEstoqueExpedicao(),
      carregarEstoqueMontagem()
    ]);
  } catch (error) {
    refs.retornoMensagem.textContent = error.message;
    refs.retornoMensagem.className = 'message error';
    refs.retornoMensagem.classList.remove('hidden');
  }
}

function abrirModalPedidos() {
  openModal(refs.pedidosModal);
}

function fecharModalPedidos() {
  closeModal(refs.pedidosModal);
}

function abrirModalHistorico() {
  openModal(refs.historicoModal);
}

function fecharModalHistorico() {
  closeModal(refs.historicoModal);
}

function fecharModalSolicitacao() {
  solicitacaoLista = [];
  renderizarListaSolicitacao();
  closeModal(refs.solicitacaoModal);
}

async function carregarEstruturaSubmontagem(submontagemId) {
  if (estruturasSubmontagemCache.has(submontagemId)) {
    return estruturasSubmontagemCache.get(submontagemId);
  }

  const response = await fetch(`${submontagensApiBaseUrl}/${submontagemId}/componentes`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar a estrutura da submontagem.');
  }

  estruturasSubmontagemCache.set(submontagemId, result);
  return result;
}

async function abrirModalEfetuarMontagem() {
  resetModalEfetuarMontagem();
  openModal(refs.efetuarModal);

  try {
    await carregarSubmontagensExpedicaoDisponiveis();
    renderizarSugestoesEfetuarMontagem(refs.efetuarBusca.value.trim());
  } catch (error) {
    refs.efetuarMensagem.textContent = error.message;
    refs.efetuarMensagem.className = 'message error';
    refs.efetuarMensagem.classList.remove('hidden');
  }
}

function fecharModalEfetuarMontagem() {
  resetModalEfetuarMontagem();
  closeModal(refs.efetuarModal);
}

function resetModalEfetuarMontagem() {
  efetuarFaltantesCache = [];
  refs.efetuarMensagem.className = 'message hidden';
  refs.efetuarMensagem.textContent = '';
  refs.efetuarForm.reset();
  refs.efetuarSubmontagemId.value = '';
  refs.efetuarQuantidade.value = '1';
  refs.efetuarPreviewTitulo.textContent = 'Selecione uma submontagem';
  refs.efetuarPreviewSubtitulo.textContent = 'A Expedicao vai consumir os componentes do proprio estoque e gerar o item pronto no mesmo setor.';
  refs.efetuarPreviewProntoChip.textContent = 'Pronto atual: 0';
  refs.efetuarPreviewComponentesChip.textContent = 'Componentes: 0';
  refs.efetuarPreviewStatusChip.textContent = 'Status: aguardando selecao';
  refs.efetuarPreviewTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Selecione a submontagem para visualizar o consumo.</td></tr>';
  refs.efetuarSolicitarFaltantes.disabled = true;
  refs.efetuarSubmit.disabled = true;
  esconderSugestoesEfetuarMontagem();
}

function renderizarSugestoesEfetuarMontagem(termo) {
  const filtro = normalizarBusca(termo);
  const itens = submontagensExpedicaoCache
    .filter((item) => {
      if (!filtro) {
        return true;
      }

      return normalizarBusca(`${item.codigo} ${item.descricao}`).includes(filtro);
    })
    .sort((a, b) => {
      const capacidadeA = Number(a.capacidade_estoque || 0);
      const capacidadeB = Number(b.capacidade_estoque || 0);

      if (capacidadeA !== capacidadeB) {
        return capacidadeB - capacidadeA;
      }

      return String(a.codigo || '').localeCompare(String(b.codigo || ''));
    })
    .slice(0, 8);

  renderizarPainelAutocomplete(
    refs.efetuarSugestoes,
    itens,
    (item) => ({
      id: item.id,
      title: `${item.codigo} - ${item.descricao}`,
      subtitle: `Pronto: ${formatInteger(item.saldo_pronto_estoque)} | Consegue montar: ${formatInteger(item.capacidade_estoque)}`
    }),
    'Nenhuma submontagem encontrada.'
  );
}

function handleSugestaoEfetuarMontagemClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = submontagensExpedicaoCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.efetuarSubmontagemId.value = String(item.id);
  refs.efetuarBusca.value = `${item.codigo} - ${item.descricao}`;
  esconderSugestoesEfetuarMontagem();
  atualizarPreviewEfetuarMontagem();
}

async function atualizarPreviewEfetuarMontagem() {
  const submontagemId = Number.parseInt(refs.efetuarSubmontagemId.value, 10);
  const submontagem = submontagensExpedicaoCache.find((item) => Number(item.id) === submontagemId);
  const quantidadeInformada = Number.parseFloat(refs.efetuarQuantidade.value);
  const quantidade = Number.isFinite(quantidadeInformada) && quantidadeInformada > 0 ? quantidadeInformada : 0;

  if (!submontagem) {
    efetuarFaltantesCache = [];
    refs.efetuarPreviewTitulo.textContent = 'Selecione uma submontagem';
    refs.efetuarPreviewSubtitulo.textContent = 'A Expedicao vai consumir os componentes do proprio estoque e gerar o item pronto no mesmo setor.';
    refs.efetuarPreviewProntoChip.textContent = 'Pronto atual: 0';
    refs.efetuarPreviewComponentesChip.textContent = 'Componentes: 0';
    refs.efetuarPreviewStatusChip.textContent = 'Status: aguardando selecao';
    refs.efetuarPreviewTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Selecione a submontagem para visualizar o consumo.</td></tr>';
    refs.efetuarSolicitarFaltantes.disabled = true;
    refs.efetuarSubmit.disabled = true;
    return;
  }

  refs.efetuarPreviewTitulo.textContent = `${submontagem.codigo} - ${submontagem.descricao}`;
  refs.efetuarPreviewSubtitulo.textContent = `Montagem pronta atual: ${formatInteger(submontagem.saldo_pronto_estoque)} | Capacidade estimada no setor: ${formatInteger(submontagem.capacidade_estoque)}`;

  try {
    const componentes = await carregarEstruturaSubmontagem(submontagem.id);

    if (!componentes.length) {
      efetuarFaltantesCache = [];
      refs.efetuarPreviewProntoChip.textContent = `Pronto atual: ${formatInteger(submontagem.saldo_pronto_estoque)}`;
      refs.efetuarPreviewComponentesChip.textContent = 'Componentes: 0';
      refs.efetuarPreviewStatusChip.textContent = 'Status: sem estrutura';
      refs.efetuarPreviewTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Esta submontagem nao possui componentes cadastrados.</td></tr>';
      refs.efetuarSolicitarFaltantes.disabled = true;
      refs.efetuarSubmit.disabled = true;
      return;
    }

    const linhas = componentes.map((componente) => {
      const quantidadeNecessaria = Number((Number(componente.quantidade) * quantidade).toFixed(2));
      const saldoExpedicao = obterSaldoExpedicao(componente.id_item_componente);
      const suficiente = quantidade > 0 && saldoExpedicao >= quantidadeNecessaria;

      return {
        ...componente,
        quantidade_necessaria: quantidadeNecessaria,
        saldo_expedicao: saldoExpedicao,
        quantidade_faltante: Math.max(0, Number((quantidadeNecessaria - saldoExpedicao).toFixed(2))),
        suficiente
      };
    });

    const prontoParaMontar = quantidade > 0 && linhas.every((componente) => componente.suficiente);
    efetuarFaltantesCache = linhas.filter((componente) => Number(componente.quantidade_faltante || 0) > 0);

    refs.efetuarPreviewProntoChip.textContent = `Pronto atual: ${formatInteger(submontagem.saldo_pronto_estoque)}`;
    refs.efetuarPreviewComponentesChip.textContent = `Componentes: ${componentes.length}`;
    refs.efetuarPreviewStatusChip.textContent = prontoParaMontar
      ? 'Status: pronto para montar'
      : 'Status: saldo insuficiente';
    refs.efetuarPreviewTbody.innerHTML = linhas.map((componente) => `
      <tr>
        <td class="table-code">${escapeHtml(componente.codigo_componente)}</td>
        <td class="table-description">${escapeHtml(componente.descricao_componente)}</td>
        <td class="table-quantity">${formatDecimal(componente.quantidade)}</td>
        <td class="table-quantity">${formatDecimal(componente.quantidade_necessaria)}</td>
        <td class="table-quantity">${formatDecimal(componente.saldo_expedicao)}</td>
        <td>${componente.suficiente ? 'OK' : 'Faltando'}</td>
      </tr>
    `).join('');
    refs.efetuarSolicitarFaltantes.disabled = prontoParaMontar || efetuarFaltantesCache.length === 0;
    refs.efetuarSubmit.disabled = !prontoParaMontar;
  } catch (error) {
    efetuarFaltantesCache = [];
    refs.efetuarPreviewProntoChip.textContent = `Pronto atual: ${formatInteger(submontagem.saldo_pronto_estoque)}`;
    refs.efetuarPreviewComponentesChip.textContent = 'Componentes: 0';
    refs.efetuarPreviewStatusChip.textContent = 'Status: erro';
    refs.efetuarPreviewTbody.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
    refs.efetuarSolicitarFaltantes.disabled = true;
    refs.efetuarSubmit.disabled = true;
  }
}

async function handleEfetuarMontagem(event) {
  event.preventDefault();

  try {
    const expedicao = obterEstoquePorNome('exped');
    if (!expedicao) {
      throw new Error('Estoque da Expedicao nao encontrado.');
    }

    if (!refs.efetuarSubmontagemId.value) {
      throw new Error('Selecione uma submontagem valida.');
    }

    const response = await fetch(`${submontagensApiBaseUrl}/${refs.efetuarSubmontagemId.value}/montar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_estoque: expedicao.id,
        quantidade: refs.efetuarQuantidade.value,
        observacao: refs.efetuarObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel efetuar a montagem da submontagem.');
    }

    fecharModalEfetuarMontagem();
    mostrarMensagem('Montagem efetuada com sucesso.', 'success');
    await Promise.all([
      carregarEstoqueExpedicao(),
      carregarSubmontagensExpedicaoDisponiveis()
    ]);
  } catch (error) {
    refs.efetuarMensagem.textContent = error.message;
    refs.efetuarMensagem.className = 'message error';
    refs.efetuarMensagem.classList.remove('hidden');
  }
}

async function handleSolicitarFaltantesExpedicao() {
  try {
    const submontagemId = Number.parseInt(refs.efetuarSubmontagemId.value, 10);
    const submontagem = submontagensExpedicaoCache.find((item) => Number(item.id) === submontagemId);

    if (!submontagem) {
      throw new Error('Selecione uma submontagem valida.');
    }

    const faltantes = efetuarFaltantesCache.filter((item) => Number(item.quantidade_faltante || 0) > 0);
    if (!faltantes.length) {
      throw new Error('Nao ha faltantes para solicitar ao Almoxarifado.');
    }

    const criadas = [];
    const semSaldo = [];
    const falhas = [];

    for (const componente of faltantes) {
      const item = itensCache.find((entry) => Number(entry.id) === Number(componente.id_item_componente));

      if (!item) {
        falhas.push(`${componente.codigo_componente}: cadastro nao encontrado.`);
        continue;
      }

      const saldoAlmox = Number(item.saldo_almoxarifado || 0);
      if (saldoAlmox <= 0) {
        semSaldo.push(`${item.codigo}`);
        continue;
      }

      const quantidadeSolicitada = Number(Math.min(saldoAlmox, Number(componente.quantidade_faltante || 0)).toFixed(2));
      if (quantidadeSolicitada <= 0) {
        continue;
      }

      const response = await fetch(solicitacoesApiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_origem: 'EXPEDICAO',
          origem_atendimento: 'ALMOXARIFADO',
          id_peca: item.id,
          quantidade_solicitada: quantidadeSolicitada,
          observacao: `Faltante para montar ${submontagem.codigo} na Expedicao.`
        })
      });
      const result = await response.json();

      if (!response.ok) {
        falhas.push(`${item.codigo}: ${result.message || 'nao foi possivel solicitar.'}`);
        continue;
      }

      criadas.push(`${item.codigo} (${formatDecimal(quantidadeSolicitada)})`);
    }

    await carregarPedidosExpedicao();

    if (!criadas.length) {
      const detalhes = [
        semSaldo.length ? `Sem saldo no Almox: ${semSaldo.join(', ')}` : '',
        falhas.length ? `Falhas: ${falhas.join(' | ')}` : ''
      ].filter(Boolean).join(' | ');
      throw new Error(detalhes || 'Nenhuma solicitacao foi criada.');
    }

    const detalhes = [
      `Solicitacoes criadas: ${criadas.join(', ')}`,
      semSaldo.length ? `Sem saldo no Almox: ${semSaldo.join(', ')}` : '',
      falhas.length ? `Falhas: ${falhas.join(' | ')}` : ''
    ].filter(Boolean).join(' | ');

    refs.efetuarMensagem.textContent = detalhes;
    refs.efetuarMensagem.className = 'message success';
    refs.efetuarMensagem.classList.remove('hidden');
  } catch (error) {
    refs.efetuarMensagem.textContent = error.message;
    refs.efetuarMensagem.className = 'message error';
    refs.efetuarMensagem.classList.remove('hidden');
  }
}

function handleSolicitacaoOrigemChange() {
  const item = itensCache.find((entry) => Number(entry.id) === Number(refs.solicitacaoItemId.value));
  if (item) {
    renderizarResumoItemSolicitacao(item);
  }
  renderizarSugestoesSolicitacao(refs.solicitacaoBusca.value.trim());
}

function renderizarSugestoesSolicitacao(termo) {
  const filtro = normalizarBusca(termo);
  const candidatos = itensCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  });

  const origemPermiteSemSaldo = refs.solicitacaoOrigem.value === 'MONTAGEM';
  const comSaldo = [];
  const semSaldo = [];

  candidatos.forEach((item) => {
    const saldo = obterSaldoOrigemSolicitacao(item);
    if (saldo > 0 || origemPermiteSemSaldo) {
      comSaldo.push(item);
      return;
    }

    semSaldo.push(item);
  });

  const itens = [...comSaldo, ...semSaldo].slice(0, 8);

  if (!itens.length) {
    refs.solicitacaoSugestoes.innerHTML = refs.solicitacaoOrigem.value === 'MONTAGEM'
      ? '<div class="autocomplete-empty">Nenhum item encontrado para solicitar a Montagem.</div>'
      : '<div class="autocomplete-empty">Nenhuma peca com saldo disponivel na origem selecionada.</div>';
    refs.solicitacaoSugestoes.classList.remove('hidden');
    return;
  }

  refs.solicitacaoSugestoes.innerHTML = itens.map((item) => {
    const saldo = obterSaldoOrigemSolicitacao(item);
    const desabilitado = !origemPermiteSemSaldo && saldo <= 0;
    const origemLabel = `${formatInteger(saldo)}${desabilitado ? ' (sem saldo)' : ''}`;

    return `
    <button type="button" class="autocomplete-option" data-id="${item.id}" ${desabilitado ? 'disabled' : ''}>
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`${item.classificacao} | Pacote: ${formatPackage(item.estoque_minimo)} | Origem: ${origemLabel}`)}${origemPermiteSemSaldo ? ' (pode pedir sem saldo)' : ''}</span>
    </button>
  `;
  }).join('');
  refs.solicitacaoSugestoes.classList.remove('hidden');
}

function handleSugestaoSolicitacaoClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option || option.disabled) {
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.solicitacaoItemId.value = String(item.id);
  refs.solicitacaoBusca.value = `${item.codigo} - ${item.descricao}`;
  preencherQuantidadeSolicitacaoPadrao(item);
  renderizarResumoItemSolicitacao(item);
  esconderSugestoesSolicitacao();
}

function preencherQuantidadeSolicitacaoPadrao(item) {
  const pacote = Number(item?.estoque_minimo);
  refs.solicitacaoQuantidade.value = Number.isFinite(pacote) && pacote > 0 ? String(pacote) : '';
}

function renderizarResumoItemSolicitacao(item) {
  if (!item) {
    refs.solicitacaoResumo.classList.add('selected-tags', 'empty');
    refs.solicitacaoResumo.textContent = 'Digite para ver a quantidade por pacote e o saldo na origem escolhida.';
    return;
  }

  const origemLabel = refs.solicitacaoOrigem.value === 'MONTAGEM' ? 'Saldo Montagem' : 'Saldo Almox';
  const detalheLivre = refs.solicitacaoOrigem.value === 'MONTAGEM'
    ? `<span class="selected-tag">Pode solicitar mesmo sem saldo</span>`
    : '';

  refs.solicitacaoResumo.classList.remove('empty');
  refs.solicitacaoResumo.classList.add('selected-tags');
  refs.solicitacaoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Qtd por pacote: ${formatPackage(item.estoque_minimo)}`)}</span>
    <span class="selected-tag">${escapeHtml(`${origemLabel}: ${formatInteger(obterSaldoOrigemSolicitacao(item))}`)}</span>
    ${detalheLivre}
  `;
}

function preencherSolicitacaoEstoque(prefill) {
  const item = itensCache.find((entry) => Number(entry.id) === Number(prefill.id));

  refs.solicitacaoForm.reset();
  refs.solicitacaoOrigem.value = prefill.origem || 'ALMOXARIFADO';
  refs.solicitacaoItemId.value = String(prefill.id);
  refs.solicitacaoBusca.value = `${prefill.codigo} - ${prefill.descricao}`;
  refs.solicitacaoQuantidade.value = String(Math.max(1, Number.parseInt(prefill.quantidade, 10) || 1));
  refs.solicitacaoObservacao.value = prefill.observacao || '';
  renderizarResumoItemSolicitacao(item || {
    codigo: prefill.codigo,
    descricao: prefill.descricao,
    classificacao: '-',
    estoque_minimo: null,
    saldo_almoxarifado: 0
  });
}

function renderizarListaSolicitacao() {
  refs.solicitacaoListaTotal.textContent = `${solicitacaoLista.length} item(ns) na lista`;

  if (!solicitacaoLista.length) {
    refs.solicitacaoListaTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum item na lista de solicitacao.</td></tr>';
    return;
  }

  refs.solicitacaoListaTbody.innerHTML = solicitacaoLista.map((item) => `
    <tr>
      <td>${escapeHtml(item.origemLabel)}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
      <td class="table-actions-cell">
        <button type="button" class="btn btn-neutral btn-small" data-remove-solicitacao-key="${escapeHtml(item.key)}">Remover</button>
      </td>
    </tr>
  `).join('');
}

function limparFormularioSolicitacao() {
  refs.solicitacaoItemId.value = '';
  refs.solicitacaoBusca.value = '';
  refs.solicitacaoQuantidade.value = '';
  refs.solicitacaoObservacao.value = '';
  renderizarResumoItemSolicitacao(null);
  esconderSugestoesSolicitacao();
}

async function handleAdicionarSolicitacaoNaLista(event) {
  event.preventDefault();

  try {
    if (!refs.solicitacaoItemId.value) {
      throw new Error('Selecione uma peca ou submontagem valida.');
    }

    const item = itensCache.find((entry) => Number(entry.id) === Number(refs.solicitacaoItemId.value));
    if (!item) {
      throw new Error('Selecione uma peca ou submontagem valida.');
    }

    const quantidadeSolicitada = Math.max(1, Number.parseInt(refs.solicitacaoQuantidade.value, 10) || 0);
    const saldoDisponivel = obterSaldoOrigemSolicitacao(item);
    const origemNome = refs.solicitacaoOrigem.value === 'MONTAGEM' ? 'Montagem' : 'Almoxarifado';
    const origemPermiteFila = refs.solicitacaoOrigem.value === 'MONTAGEM';

    if (!origemPermiteFila && saldoDisponivel <= 0) {
      throw new Error(`${origemNome} nao possui saldo disponivel para esta solicitacao.`);
    }

    if (!origemPermiteFila && quantidadeSolicitada > saldoDisponivel) {
      throw new Error(`Saldo insuficiente em ${origemNome}. Disponivel: ${formatInteger(saldoDisponivel)}.`);
    }

    const key = `${refs.solicitacaoOrigem.value}:${item.id}`;
    const existente = solicitacaoLista.find((entry) => entry.key === key);
    if (existente) {
      existente.quantidade += quantidadeSolicitada;
      existente.observacao = refs.solicitacaoObservacao.value.trim() || existente.observacao || '';
    } else {
      solicitacaoLista.push({
        key,
        origem: refs.solicitacaoOrigem.value,
        origemLabel: origemNome,
        id_peca: item.id,
        codigo: item.codigo,
        descricao: item.descricao,
        quantidade: quantidadeSolicitada,
        observacao: refs.solicitacaoObservacao.value.trim()
      });
    }

    renderizarListaSolicitacao();
    limparFormularioSolicitacao();
    refs.solicitacaoMensagem.textContent = 'Item adicionado a lista de solicitacao.';
    refs.solicitacaoMensagem.className = 'message success';
    refs.solicitacaoMensagem.classList.remove('hidden');
  } catch (error) {
    refs.solicitacaoMensagem.textContent = error.message;
    refs.solicitacaoMensagem.className = 'message error';
    refs.solicitacaoMensagem.classList.remove('hidden');
  }
}

function handleSolicitacaoListaActions(event) {
  const button = event.target.closest('button[data-remove-solicitacao-key]');
  if (!button) {
    return;
  }

  solicitacaoLista = solicitacaoLista.filter((item) => item.key !== button.dataset.removeSolicitacaoKey);
  renderizarListaSolicitacao();
}

async function enviarSolicitacoesDaLista() {
  try {
    if (!solicitacaoLista.length) {
      throw new Error('Adicione pelo menos um item na lista de solicitacao.');
    }

    const criadas = [];
    const falhas = [];
    const pendentes = [];

    for (const item of solicitacaoLista) {
      const response = await fetch(solicitacoesApiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_origem: 'EXPEDICAO',
          origem_atendimento: item.origem,
          id_peca: item.id_peca,
          quantidade_solicitada: item.quantidade,
          observacao: item.observacao || null
        })
      });
      const result = await response.json();

      if (!response.ok) {
        falhas.push(`${item.codigo}: ${result.message || 'nao foi possivel criar a solicitacao.'}`);
        pendentes.push(item);
        continue;
      }

      criadas.push(`${item.codigo} (${formatInteger(item.quantidade)})`);
    }

    solicitacaoLista = pendentes;
    renderizarListaSolicitacao();
    await carregarPedidosExpedicao();

    if (!criadas.length) {
      throw new Error(falhas.join(' | ') || 'Nenhuma solicitacao foi criada.');
    }

    if (falhas.length) {
      refs.solicitacaoMensagem.textContent = `Criadas: ${criadas.join(', ')} | Falhas: ${falhas.join(' | ')}`;
      refs.solicitacaoMensagem.className = 'message error';
      refs.solicitacaoMensagem.classList.remove('hidden');
      return;
    }

    fecharModalSolicitacao();
    mostrarMensagem(`Solicitacoes enviadas com sucesso: ${criadas.join(', ')}`, 'success');
  } catch (error) {
    refs.solicitacaoMensagem.textContent = error.message;
    refs.solicitacaoMensagem.className = 'message error';
    refs.solicitacaoMensagem.classList.remove('hidden');
  }
}

function abrirModalDesmembrar() {
  const expedicao = obterEstoquePorNome('exped');
  refs.desmembrarMensagem.className = 'message hidden';
  refs.desmembrarMensagem.textContent = '';
  refs.desmembrarForm.reset();
  refs.desmembrarSubmontagemId.value = '';
  refs.desmembrarQuantidade.value = '1';
  refs.desmembrarBusca.value = '';
  preencherSelectDestinosRetorno(refs.desmembrarDestino, {
    incluirExpedicao: true,
    selecionadoId: expedicao ? expedicao.id : ''
  });
  refs.desmembrarPreviewTitulo.textContent = 'Selecione uma submontagem';
  refs.desmembrarPreviewSubtitulo.textContent = 'A Expedicao pode desmembrar no proprio estoque ou devolver os componentes para outro setor.';
  refs.desmembrarPreviewProntoChip.textContent = 'Pronto atual: 0';
  refs.desmembrarPreviewComponentesChip.textContent = 'Componentes: 0';
  refs.desmembrarPreviewStatusChip.textContent = 'Status: aguardando selecao';
  refs.desmembrarPreviewTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Selecione a submontagem para visualizar o retorno dos componentes.</td></tr>';
  refs.desmembrarSubmit.disabled = true;
  esconderSugestoesDesmembrar();
  openModal(refs.desmembrarModal);
}

function fecharModalDesmembrar() {
  closeModal(refs.desmembrarModal);
}

function renderizarSugestoesDesmembrar(termo) {
  const filtro = normalizarBusca(termo);
  const itens = saldosExpedicaoCache
    .filter((item) => String(item.classificacao || '').toUpperCase() === 'SUBMONTAGEM' && Number(item.quantidade || 0) > 0)
    .filter((item) => {
      if (!filtro) {
        return true;
      }

      return normalizarBusca(`${item.codigo} ${item.descricao}`).includes(filtro);
    })
    .slice(0, 8);

  renderizarPainelAutocomplete(
    refs.desmembrarSugestoes,
    itens,
    (item) => ({
      id: item.id_peca,
      title: `${item.codigo} - ${item.descricao}`,
      subtitle: `Saldo pronto na Expedicao: ${formatInteger(item.quantidade)}`
    }),
    'Nenhuma submontagem pronta disponivel para desmembrar.'
  );
}

function handleSugestaoDesmembrarClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = saldosExpedicaoCache.find((entry) => Number(entry.id_peca) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.desmembrarSubmontagemId.value = String(item.id_peca);
  refs.desmembrarBusca.value = `${item.codigo} - ${item.descricao}`;
  esconderSugestoesDesmembrar();
  atualizarPreviewDesmembrar();
}

async function atualizarPreviewDesmembrar() {
  const submontagemId = Number.parseInt(refs.desmembrarSubmontagemId.value, 10);
  const quantidadeInformada = Number.parseFloat(refs.desmembrarQuantidade.value);
  const quantidade = Number.isFinite(quantidadeInformada) && quantidadeInformada > 0 ? quantidadeInformada : 0;
  const submontagem = saldosExpedicaoCache.find((item) => Number(item.id_peca) === submontagemId);
  const destino = estoquesCache.find((estoque) => Number(estoque.id) === Number(refs.desmembrarDestino.value));

  if (!submontagem) {
    refs.desmembrarPreviewTitulo.textContent = 'Selecione uma submontagem';
    refs.desmembrarPreviewSubtitulo.textContent = 'A Expedicao vai baixar o item pronto e devolver os componentes para outro estoque.';
    refs.desmembrarPreviewProntoChip.textContent = 'Pronto atual: 0';
    refs.desmembrarPreviewComponentesChip.textContent = 'Componentes: 0';
    refs.desmembrarPreviewStatusChip.textContent = 'Status: aguardando selecao';
    refs.desmembrarPreviewTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Selecione a submontagem para visualizar o retorno dos componentes.</td></tr>';
    refs.desmembrarSubmit.disabled = true;
    return;
  }

  refs.desmembrarPreviewTitulo.textContent = `${submontagem.codigo} - ${submontagem.descricao}`;
  refs.desmembrarPreviewSubtitulo.textContent = [
    `Saldo pronto atual: ${formatInteger(submontagem.quantidade)}`,
    destino ? `Destino dos componentes: ${destino.nome}` : 'Selecione o estoque de destino'
  ].join(' | ');

  try {
    const componentes = await carregarEstruturaSubmontagem(submontagem.id_peca);

    if (!componentes.length) {
      refs.desmembrarPreviewProntoChip.textContent = `Pronto atual: ${formatInteger(submontagem.quantidade)}`;
      refs.desmembrarPreviewComponentesChip.textContent = 'Componentes: 0';
      refs.desmembrarPreviewStatusChip.textContent = 'Status: sem estrutura';
      refs.desmembrarPreviewTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Esta submontagem nao possui componentes cadastrados.</td></tr>';
      refs.desmembrarSubmit.disabled = true;
      return;
    }

    refs.desmembrarPreviewProntoChip.textContent = `Pronto atual: ${formatInteger(submontagem.quantidade)}`;
    refs.desmembrarPreviewComponentesChip.textContent = `Componentes: ${componentes.length}`;
    refs.desmembrarPreviewStatusChip.textContent = quantidade > 0 && destino
      ? 'Status: pronto para desmembrar'
      : 'Status: defina quantidade e destino';
    refs.desmembrarPreviewTbody.innerHTML = componentes.map((componente) => `
      <tr>
        <td class="table-code">${escapeHtml(componente.codigo_componente)}</td>
        <td class="table-description">${escapeHtml(componente.descricao_componente)}</td>
        <td class="table-quantity">${formatDecimal(componente.quantidade)}</td>
        <td class="table-quantity">${formatDecimal(Number((Number(componente.quantidade) * quantidade).toFixed(2)))}</td>
      </tr>
    `).join('');
    refs.desmembrarSubmit.disabled = !(quantidade > 0 && destino);
  } catch (error) {
    refs.desmembrarPreviewProntoChip.textContent = `Pronto atual: ${formatInteger(submontagem.quantidade)}`;
    refs.desmembrarPreviewComponentesChip.textContent = 'Componentes: 0';
    refs.desmembrarPreviewStatusChip.textContent = 'Status: erro';
    refs.desmembrarPreviewTbody.innerHTML = `<tr><td colspan="4" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
    refs.desmembrarSubmit.disabled = true;
  }
}

async function handleDesmembrarSubmontagem(event) {
  event.preventDefault();

  try {
    const expedicao = obterEstoquePorNome('exped');
    if (!expedicao) {
      throw new Error('Estoque da Expedicao nao encontrado.');
    }

    if (!refs.desmembrarSubmontagemId.value) {
      throw new Error('Selecione uma submontagem valida.');
    }

    if (!refs.desmembrarDestino.value) {
      throw new Error('Selecione o estoque de destino.');
    }

    const response = await fetch(`${submontagensApiBaseUrl}/${refs.desmembrarSubmontagemId.value}/desmembrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_estoque_origem: expedicao.id,
        id_estoque_destino: refs.desmembrarDestino.value,
        quantidade: refs.desmembrarQuantidade.value,
        observacao: refs.desmembrarObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel desmembrar a submontagem.');
    }

    fecharModalDesmembrar();
    mostrarMensagem('Submontagem desmembrada com sucesso.', 'success');
    await Promise.all([
      carregarEstoqueExpedicao(),
      carregarEstoqueMontagem()
    ]);
  } catch (error) {
    refs.desmembrarMensagem.textContent = error.message;
    refs.desmembrarMensagem.className = 'message error';
    refs.desmembrarMensagem.classList.remove('hidden');
  }
}

function abrirModalSimulacao() {
  refs.simulacaoMensagem.className = 'message hidden';
  refs.simulacaoMensagem.textContent = '';
  refs.simulacaoForm.reset();
  refs.simulacaoQuantidade.value = '1';
  refs.simulacaoSubmontagemId.value = '';
  refs.simulacaoBusca.value = '';
  refs.simulacaoResumo.classList.add('selected-tags', 'empty');
  refs.simulacaoResumo.textContent = 'A simulacao vai mostrar o que falta e a melhor acao sugerida.';
  refs.simulacaoTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma simulacao executada.</td></tr>';
  openModal(refs.simulacaoModal);
}

function fecharModalSimulacao() {
  closeModal(refs.simulacaoModal);
}

function renderizarSugestoesSubmontagem(termo) {
  const filtro = normalizarBusca(termo);
  const itens = submontagensCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.simulacaoSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma submontagem encontrada.</div>';
    refs.simulacaoSugestoes.classList.remove('hidden');
    return;
  }

  refs.simulacaoSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`Componentes: ${formatInteger(item.total_componentes || 0)} | Massa: ${formatDecimal(item.massa_kg || 0)} kg`)}</span>
    </button>
  `).join('');
  refs.simulacaoSugestoes.classList.remove('hidden');
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
  refs.simulacaoBusca.value = `${item.codigo} - ${item.descricao}`;
  esconderSugestoesSubmontagem();
}

async function handleSimular(event) {
  event.preventDefault();

  if (!refs.simulacaoSubmontagemId.value) {
    refs.simulacaoMensagem.textContent = 'Selecione uma submontagem valida.';
    refs.simulacaoMensagem.className = 'message error';
    refs.simulacaoMensagem.classList.remove('hidden');
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
    refs.simulacaoMensagem.textContent = 'Simulacao atualizada.';
    refs.simulacaoMensagem.className = 'message success';
    refs.simulacaoMensagem.classList.remove('hidden');
  } catch (error) {
    refs.simulacaoMensagem.textContent = error.message;
    refs.simulacaoMensagem.className = 'message error';
    refs.simulacaoMensagem.classList.remove('hidden');
  }
}

function renderizarResultadoSimulacao(result) {
  refs.simulacaoResumo.classList.remove('empty');
  refs.simulacaoResumo.classList.add('selected-tags');
  refs.simulacaoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`${result.submontagem.codigo} - ${result.submontagem.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo pronto: ${formatInteger(result.saldo_pronto_total)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Capacidade total: ${formatInteger(result.capacidade_total)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Consegue montar: ${result.pode_montar_quantidade_desejada ? 'SIM' : 'NAO'}`)}</span>
  `;

  if (!result.componentes.length) {
    refs.simulacaoTbody.innerHTML = '<tr><td colspan="9" class="empty-state">A submontagem nao possui componentes.</td></tr>';
    return;
  }

  refs.simulacaoTbody.innerHTML = result.componentes.map((item) => {
    const almox = getStockQuantity(item, 'almox');
    const montagem = getStockQuantity(item, 'mont');
    const expedicao = getStockQuantity(item, 'exped');
    const suggestion = buildSuggestion(item, 'EXPEDICAO');

    return `
      <tr class="${Number(item.quantidade_faltante || 0) > 0 ? 'table-row-attention' : ''}">
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(item.descricao)}</td>
        <td class="table-quantity">${formatInteger(item.quantidade_necessaria)}</td>
        <td class="table-quantity">${formatInteger(almox)}</td>
        <td class="table-quantity">${formatInteger(montagem)}</td>
        <td class="table-quantity">${formatInteger(expedicao)}</td>
        <td class="table-quantity">${formatInteger(item.quantidade_faltante)}</td>
        <td>${escapeHtml(suggestion.label)}</td>
        <td class="table-actions-cell">${renderSuggestionActionButton(item, suggestion, result.submontagem)}</td>
      </tr>
    `;
  }).join('');
}

function renderSuggestionActionButton(item, suggestion, submontagem) {
  if (Number(item.quantidade_faltante || 0) <= 0 || suggestion.type === 'NONE') {
    return '<span class="status-chip is-success">OK</span>';
  }

  const payload = escapeHtml(JSON.stringify({
    id: item.id_item_componente,
    codigo: item.codigo,
    descricao: item.descricao,
    quantidade: item.quantidade_faltante,
    origem: suggestion.origin,
    submontagemCodigo: submontagem.codigo
  }));

  if (suggestion.type === 'STOCK') {
    return `<button type="button" class="btn btn-neutral btn-small" data-sim-action="stock" data-item='${payload}'>${escapeHtml(suggestion.buttonLabel)}</button>`;
  }

  return `<button type="button" class="btn btn-secondary btn-small" data-sim-action="producao" data-item='${payload}'>Solicitar Producao</button>`;
}

function handleSimulacaoActions(event) {
  const button = event.target.closest('button[data-sim-action]');
  if (!button) {
    return;
  }

  const payload = parseDatasetJson(button.dataset.item);
  if (!payload) {
    return;
  }

  if (button.dataset.simAction === 'stock') {
    abrirModalSolicitacao({
      id: payload.id,
      codigo: payload.codigo,
      descricao: payload.descricao,
      quantidade: payload.quantidade,
      origem: payload.origem,
      observacao: `Faltante da simulacao de ${payload.submontagemCodigo}.`
    });
    return;
  }

  abrirModalSolicitacaoProducao({
    id: payload.id,
    codigo: payload.codigo,
    descricao: payload.descricao,
    quantidade: payload.quantidade,
    observacao: `Faltante da simulacao de ${payload.submontagemCodigo}.`
  });
}

function buildSuggestion(item, contexto) {
  if (Number(item.quantidade_faltante || 0) <= 0) {
    return { type: 'NONE', label: 'Disponivel', buttonLabel: '' };
  }

  const almox = getStockQuantity(item, 'almox');
  const montagem = getStockQuantity(item, 'mont');

  if (contexto === 'EXPEDICAO' && montagem > 0) {
    return {
      type: 'STOCK',
      origin: 'MONTAGEM',
      label: 'Pedir para a Montagem',
      buttonLabel: 'Pedir a Montagem'
    };
  }

  if (almox > 0 || String(item.tipo || '').toUpperCase() === 'COMPRADA') {
    return {
      type: 'STOCK',
      origin: 'ALMOXARIFADO',
      label: almox > 0 ? 'Pedir ao Almoxarifado' : 'Pedir ao Almoxarifado (reposicao)',
      buttonLabel: 'Pedir ao Almox'
    };
  }

  if (String(item.tipo || '').toUpperCase() === 'PRODUZIDA') {
    return {
      type: 'PRODUCTION',
      origin: 'PRODUCAO',
      label: 'Solicitar a Producao',
      buttonLabel: 'Solicitar Producao'
    };
  }

  return {
    type: 'STOCK',
    origin: 'ALMOXARIFADO',
    label: 'Pedir ao Almoxarifado',
    buttonLabel: 'Pedir ao Almox'
  };
}

function abrirModalSolicitacaoProducao(prefill) {
  refs.solicitacaoProducaoMensagem.className = 'message hidden';
  refs.solicitacaoProducaoMensagem.textContent = '';
  refs.solicitacaoProducaoForm.reset();
  refs.solicitacaoProducaoItemId.value = String(prefill.id);
  refs.solicitacaoProducaoQuantidade.value = String(Math.max(1, Number.parseInt(prefill.quantidade, 10) || 1));
  refs.solicitacaoProducaoObservacao.value = prefill.observacao || '';
  refs.solicitacaoProducaoResumo.classList.remove('empty');
  refs.solicitacaoProducaoResumo.classList.add('selected-tags');
  refs.solicitacaoProducaoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(prefill.codigo)}</span>
    <span class="selected-tag">${escapeHtml(prefill.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Quantidade: ${formatInteger(prefill.quantidade)}`)}</span>
  `;
  openModal(refs.solicitacaoProducaoModal);
}

function fecharModalSolicitacaoProducao() {
  closeModal(refs.solicitacaoProducaoModal);
}

async function handleCriarSolicitacaoProducao(event) {
  event.preventDefault();

  try {
    const response = await fetch(solicitacoesProducaoApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_origem: 'EXPEDICAO',
        id_peca: refs.solicitacaoProducaoItemId.value,
        quantidade_solicitada: refs.solicitacaoProducaoQuantidade.value,
        observacao: refs.solicitacaoProducaoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel enviar a solicitacao para a Producao.');
    }

    fecharModalSolicitacaoProducao();
    mostrarMensagem('Solicitacao enviada para a Producao.', 'success');
  } catch (error) {
    refs.solicitacaoProducaoMensagem.textContent = error.message;
    refs.solicitacaoProducaoMensagem.className = 'message error';
    refs.solicitacaoProducaoMensagem.classList.remove('hidden');
  }
}

async function adicionarItemNaLista() {
  if (!refs.itemId.value) {
    mostrarMensagemSaida('Selecione um item valido da saida.', 'error');
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(refs.itemId.value));
  if (!item) {
    mostrarMensagemSaida('Item nao encontrado para a saida.', 'error');
    return;
  }

  await garantirDisponibilidadeVendaCarregada(item);

  const quantidade = Number.parseInt(refs.quantidade.value, 10) || 0;
  if (quantidade <= 0) {
    mostrarMensagemSaida('A quantidade deve ser maior que zero.', 'error');
    return;
  }

  const existente = saidaLista.find((entry) => Number(entry.id_peca) === Number(item.id));
  const quantidadeTotal = quantidade + Number(existente ? existente.quantidade : 0);

  if (existente) {
    existente.quantidade = quantidadeTotal;
    await diagnosticarLinhaSaida(existente);
  } else {
    const novoItem = {
      id_peca: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade
    };
    saidaLista.push(novoItem);
    await diagnosticarLinhaSaida(novoItem);
  }

  limparItemAtual();
  renderizarLista();
  mostrarMensagemSaida('Item adicionado na lista de saida.', 'success');
}

function limparItemAtual() {
  refs.itemId.value = '';
  refs.itemBusca.value = '';
  refs.quantidade.value = '1';
  renderizarResumoItem(null);
  esconderSugestoes();
}

function handleListaActions(event) {
  const botaoFalta = event.target.closest('button[data-falta-id]');
  if (botaoFalta) {
    const idPeca = Number(botaoFalta.dataset.faltaId);
    const itemLista = saidaLista.find((entry) => Number(entry.id_peca) === idPeca);

    if (!itemLista) {
      mostrarMensagemSaida('Nao foi possivel calcular as faltas deste item.', 'error');
      return;
    }

    diagnosticarLinhaSaida(itemLista)
      .then(() => {
        renderizarLista();
        if (itemLista.pode_baixar) {
          mostrarMensagemSaida(`${itemLista.codigo} possui saldo para baixa.`, 'success');
          return;
        }

        abrirModalFaltas(itemLista.pendencias);
      })
      .catch((error) => mostrarMensagemSaida(error.message || 'Nao foi possivel calcular as faltas deste item.', 'error'));
    return;
  }

  const button = event.target.closest('button[data-remove-id]');
  if (!button) {
    return;
  }

  saidaLista = saidaLista.filter((item) => Number(item.id_peca) !== Number(button.dataset.removeId));
  renderizarLista();
}

async function baixarSaida() {
  if (!saidaLista.length) {
    mostrarMensagemSaida('Adicione ao menos um item na lista de saida.', 'error');
    return;
  }

  if (refs.tipoSaida.value === 'OUTROS' && !refs.observacao.value.trim()) {
    mostrarMensagemSaida('Informe a observacao quando o tipo de saida for Outros.', 'error');
    refs.observacao.focus();
    return;
  }

  try {
    await diagnosticarListaSaida();
  } catch (error) {
    mostrarMensagemSaida(error.message || 'Nao foi possivel validar os itens da lista.', 'error');
    return;
  }

  const itensOriginais = saidaLista.filter((item) => item.pode_baixar);
  const itensPendentes = saidaLista.filter((item) => !item.pode_baixar);
  const itensComFalha = [];
  const pendencias = [];
  let baixados = 0;

  itensPendentes.forEach((item) => {
    if (item.pendencias) {
      pendencias.push(item.pendencias);
    }
  });

  if (!itensOriginais.length) {
    if (pendencias.length) {
      abrirModalFaltas(consolidarPendenciasVenda(pendencias));
    }
    return;
  }

  for (const item of itensOriginais) {
    try {
      const response = await fetch(saidaApiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_saida: refs.tipoSaida.value || TIPO_SAIDA_PADRAO,
          itens: [{
            id_peca: item.id_peca,
            quantidade: item.quantidade
          }],
          observacao: refs.observacao.value.trim()
        })
      });
      const result = await response.json();

      if (!response.ok) {
        itensComFalha.push(item);
        if (result?.details?.tipo === 'FALTA_ESTOQUE_VENDA') {
          pendencias.push(result.details);
        }
        continue;
      }

      baixados += 1;
    } catch (_) {
      itensComFalha.push(item);
    }
  }

  saidaLista = [...itensPendentes, ...itensComFalha];
  renderizarLista();

  await Promise.all([
    carregarEstoqueExpedicao(),
    carregarEstoqueMontagem(),
    carregarHistoricoSaidas()
  ]);

  if (pendencias.length) {
    abrirModalFaltas(consolidarPendenciasVenda(pendencias));
  }

  if (baixados > 0 && itensComFalha.length > 0) {
    mostrarMensagemSaida(`Baixa parcial concluida: ${baixados} item(ns) baixado(s) e ${itensComFalha.length} pendente(s).`, 'warning');
    return;
  }

  if (baixados > 0) {
    refs.tipoSaida.value = TIPO_SAIDA_PADRAO;
    refs.observacao.value = '';
    atualizarObrigatoriedadeObservacaoSaida();
    mostrarMensagemSaida('Saida registrada com sucesso.', 'success');
    return;
  }

  if (!pendencias.length) {
    mostrarMensagemSaida('Nao foi possivel registrar a saida com os itens atuais.', 'error');
  }
}

async function diagnosticarLinhaSaida(itemLista) {
  const response = await fetch(saidaDiagnosticoApiBaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo_saida: refs.tipoSaida.value || TIPO_SAIDA_PADRAO,
      itens: [{
        id_peca: itemLista.id_peca,
        quantidade: itemLista.quantidade
      }],
      observacao: refs.observacao.value.trim()
    })
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel diagnosticar a saida.');
  }

  itemLista.pode_baixar = Boolean(result.pode_baixar);
  itemLista.pendencias = result.details || null;
  return itemLista;
}

async function diagnosticarListaSaida() {
  await Promise.all(saidaLista.map((item) => diagnosticarLinhaSaida(item)));
  renderizarLista();
}

async function abrirModalProducao() {
  refs.producaoMensagem.className = 'message hidden';
  refs.producaoMensagem.textContent = '';
  refs.producaoTbody.innerHTML = '<tr><td colspan="10" class="empty-state">Carregando producao...</td></tr>';
  openModal(refs.producaoModal);

  try {
    await carregarProducaoEmAndamento();
  } catch (error) {
    refs.producaoMensagem.textContent = error.message;
    refs.producaoMensagem.className = 'message error';
    refs.producaoMensagem.classList.remove('hidden');
    refs.producaoTbody.innerHTML = '<tr><td colspan="10" class="empty-state">Nao foi possivel carregar a producao.</td></tr>';
  }
}

function fecharModalProducao() {
  closeModal(refs.producaoModal);
}

function handleProducaoActions(event) {
  const button = event.target.closest('button[data-action="consumir-producao"]');
  if (!button) {
    return;
  }

  const producao = producaoEmAndamentoCache.find((item) => Number(item.id) === Number(button.dataset.id));
  if (!producao) {
    return;
  }

  abrirModalConsumirProducao(producao);
}

function abrirModalConsumirProducao(producao) {
  refs.consumirProducaoId.value = String(producao.id);
  refs.consumirProducaoQuantidade.value = '1';
  refs.consumirProducaoQuantidade.max = String(Math.max(1, Number(producao.quantidade_pendente_destino || 0)));
  refs.consumirProducaoObservacao.value = '';
  refs.consumirProducaoResumo.className = 'span-12 selected-tags';
  refs.consumirProducaoResumo.textContent = `OP ${producao.id} | ${producao.peca_codigo} - ${producao.peca_descricao} | disponivel para retirada: ${formatInteger(producao.quantidade_pendente_destino || 0)}`;
  refs.consumirProducaoMensagem.className = 'message hidden';
  refs.consumirProducaoMensagem.textContent = '';
  openModal(refs.consumirProducaoModal);
}

function fecharModalConsumirProducao() {
  refs.consumirProducaoForm.reset();
  refs.consumirProducaoId.value = '';
  refs.consumirProducaoResumo.className = 'span-12 selected-tags empty';
  refs.consumirProducaoResumo.textContent = 'Selecione uma ordem em andamento.';
  refs.consumirProducaoMensagem.className = 'message hidden';
  refs.consumirProducaoMensagem.textContent = '';
  closeModal(refs.consumirProducaoModal);
}

async function handleConsumirProducao(event) {
  event.preventDefault();
  const id = refs.consumirProducaoId.value;

  try {
    const response = await fetch(`${producaoApiBaseUrl}/${id}/destinos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destino: 'EXPEDICAO',
        quantidade: refs.consumirProducaoQuantidade.value,
        observacao: refs.consumirProducaoObservacao.value.trim() || 'Retirada da producao pela Expedicao.'
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel consumir da producao.');
    }

    fecharModalConsumirProducao();
    mostrarMensagem('Quantidade transferida da producao para a Expedicao.', 'success');
    await Promise.all([carregarProducaoEmAndamento(), carregarEstoqueExpedicao()]);
  } catch (error) {
    refs.consumirProducaoMensagem.textContent = error.message;
    refs.consumirProducaoMensagem.className = 'message error';
    refs.consumirProducaoMensagem.classList.remove('hidden');
  }
}

function renderizarProducao(producoes) {
  if (!Array.isArray(producoes) || !producoes.length) {
    refs.producaoTbody.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhuma ordem em andamento no momento.</td></tr>';
    return;
  }

  refs.producaoTbody.innerHTML = producoes.map((item) => `
    <tr>
      <td class="table-code">#${escapeHtml(item.id)}</td>
      <td>${escapeHtml(item.maquina_nome || '-')}</td>
      <td class="table-code">${escapeHtml(item.peca_codigo || '-')}</td>
      <td class="table-description">${escapeHtml(item.peca_descricao || '-')}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_planejada)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_destinada || 0)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente_destino || 0)}</td>
      <td>${escapeHtml(formatMateriaPrima(item))}</td>
      <td>${formatDate(item.data_inicio)}</td>
      <td class="table-actions-cell">
        <button type="button" class="btn btn-primary btn-small" data-action="consumir-producao" data-id="${item.id}">Consumir</button>
      </td>
    </tr>
  `).join('');
}

async function carregarProducaoEmAndamento() {
  const response = await fetch(`${producaoApiBaseUrl}?status=EM_ANDAMENTO`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar a producao em andamento.');
  }

  producaoEmAndamentoCache = Array.isArray(result) ? result : [];
  renderizarProducao(producaoEmAndamentoCache);
  atualizarBadgesMenu();
}

function renderizarLista() {
  document.getElementById('expedicao-lista-total').textContent = `${saidaLista.length} item(ns) na lista`;

  if (!saidaLista.length) {
    refs.listaTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum item na lista.</td></tr>';
    return;
  }

  refs.listaTbody.innerHTML = saidaLista.map((item) => `
    <tr class="${item.pode_baixar === false ? 'expedicao-list-row-pendente' : ''}">
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">
        ${escapeHtml(item.descricao)}
        ${item.pode_baixar === false ? '<div class="table-note">Pendente de estoque</div>' : ''}
      </td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td class="table-actions-cell expedicao-list-actions">
        ${item.pode_baixar === false
          ? `<button type="button" class="btn btn-secondary btn-small" data-falta-id="${item.id_peca}">Ver faltas</button>`
          : ''}
        <button type="button" class="btn btn-neutral btn-small" data-remove-id="${item.id_peca}">Remover</button>
      </td>
    </tr>
  `).join('');
}

function consolidarPendenciasVenda(listaDetalhes) {
  const itensVenda = [];
  const faltas = [];

  listaDetalhes.forEach((details) => {
    if (details?.item_venda) {
      itensVenda.push(details.item_venda);
    }

    (details?.faltas || []).forEach((falta) => {
      faltas.push({
        ...falta,
        item_venda_codigo: details?.item_venda?.codigo || '-',
        item_venda_descricao: details?.item_venda?.descricao || '-'
      });
    });
  });

  return {
    tipo: 'FALTA_ESTOQUE_VENDA',
    item_venda: {
      codigo: itensVenda.map((item) => item.codigo).filter(Boolean).join(', ') || '-',
      descricao: 'Pendencias em itens da lista'
    },
    faltas
  };
}

function renderizarPedidos() {
  const pedidosFiltrados = obterPedidosExpedicaoFiltrados();
  document.getElementById('expedicao-pedidos-total').textContent = `${pedidosFiltrados.length} registro(s) encontrado(s)`;

  if (!pedidosExpedicaoCache.length) {
    refs.pedidosTbody.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhum pedido da Expedicao encontrado.</td></tr>';
    return;
  }

  if (!pedidosFiltrados.length) {
    refs.pedidosTbody.innerHTML = `<tr><td colspan="10" class="empty-state">${escapeHtml(obterMensagemTimeline(refs.pedidosFiltroSituacao.value, 'pedido da Expedicao'))}</td></tr>`;
    return;
  }

  refs.pedidosTbody.innerHTML = pedidosFiltrados.map((item) => `
    <tr>
      <td>${escapeHtml(item.origem_atendimento_nome || 'Almoxarifado')}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatPackage(item.quantidade_pacote)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_solicitada)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente)}</td>
      <td>${renderStatus(item.status)}</td>
      <td>${formatarDataCurta(item.data_previsao)}</td>
      <td>${formatDate(item.data_solicitacao)}</td>
      <td class="table-actions-cell">
        ${['ATENDIDA', 'CANCELADA'].includes(String(item.status || '').toUpperCase())
          ? '<span class="table-muted">-</span>'
          : `<button type="button" class="btn btn-neutral btn-small" data-action="cancelar-pedido" data-id="${item.id}">Excluir</button>`}
      </td>
    </tr>
  `).join('');
}

async function handlePedidosActions(event) {
  const button = event.target.closest('button[data-action][data-id]');
  if (!button || button.dataset.action !== 'cancelar-pedido') {
    return;
  }

  const pedido = pedidosExpedicaoCache.find((item) => Number(item.id) === Number(button.dataset.id));
  if (!pedido) {
    return;
  }

  try {
    const response = await fetch(`${solicitacoesApiBaseUrl}/${pedido.id}/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observacao: `Pedido cancelado pela Expedicao. ${pedido.observacao || ''}`.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel excluir o pedido.');
    }

    mostrarMensagem('Pedido da Expedicao excluido com sucesso.', 'success');
    await carregarPedidosExpedicao();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

async function excluirTodosPedidosExpedicao() {
  const pedidosFiltrados = obterPedidosExpedicaoFiltrados();
  const cancelaveis = pedidosFiltrados.filter((item) => !['ATENDIDA', 'CANCELADA'].includes(String(item.status || '').toUpperCase()));

  if (!cancelaveis.length) {
    mostrarMensagem('Nenhum pedido ativo para excluir.', 'info');
    return;
  }

  const confirmado = window.confirm(`Excluir ${cancelaveis.length} pedido(s) ativo(s) da Expedicao?`);
  if (!confirmado) {
    return;
  }

  let ok = 0;
  let falhas = 0;

  for (const pedido of cancelaveis) {
    try {
      const response = await fetch(`${solicitacoesApiBaseUrl}/${pedido.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observacao: `Pedido cancelado pela Expedicao. ${pedido.observacao || ''}`.trim()
        })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Nao foi possivel excluir o pedido.');
      }

      ok += 1;
    } catch (error) {
      falhas += 1;
      console.error('Falha ao excluir pedido em lote:', error);
    }
  }

  if (falhas > 0) {
    mostrarMensagem(`Pedidos excluidos: ${ok}. Falhas: ${falhas}.`, 'warning');
  } else {
    mostrarMensagem(`Pedidos excluidos: ${ok}.`, 'success');
  }

  await carregarPedidosExpedicao();
}

function renderizarHistorico() {
  document.getElementById('expedicao-historico-total').textContent = `${historicoSaidasCache.length} registro(s) encontrado(s)`;

  if (!historicoSaidasCache.length) {
    refs.historicoTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma saida registrada na Expedicao.</td></tr>';
    return;
  }

  refs.historicoTbody.innerHTML = historicoSaidasCache.map((item) => `
    <tr>
      <td>${formatDate(item.data_movimentacao)}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
    </tr>
  `).join('');
}

function renderizarEstoque() {
  const saldosFiltrados = obterSaldosExpedicaoFiltrados();
  document.getElementById('expedicao-estoque-total').textContent = `${saldosFiltrados.length} registro(s) encontrado(s)`;

  if (!saldosExpedicaoCache.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum saldo na Expedicao.</td></tr>';
    return;
  }

  if (!saldosFiltrados.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum item encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.estoqueTbody.innerHTML = saldosFiltrados.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.tipo)}</td>
      <td>${escapeHtml(item.classificacao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td>
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="history" data-item-id="${item.id_peca}">Ver historico</button>
            <button type="button" class="row-menu-item" data-action="stocks" data-item-id="${item.id_peca}">Ver saldo nos estoques</button>
            ${item.classificacao === 'SUBMONTAGEM'
              ? `<button type="button" class="row-menu-item" data-action="structure" data-item-id="${item.id_peca}">Ver o que vai</button>`
              : '<span class="row-menu-item">Sem estrutura</span>'}
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  document.getElementById('expedicao-card-itens').textContent = String(saldosExpedicaoCache.length);
  document.getElementById('expedicao-card-quantidade').textContent = formatInteger(
    saldosExpedicaoCache.reduce((total, item) => total + Number(item.quantidade || 0), 0)
  );
  document.getElementById('expedicao-card-pedidos').textContent = String(
    pedidosExpedicaoCache.filter((item) => ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(item.status)).length
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
      carregarEstoqueMontagem(),
      carregarEstoqueExpedicao(),
      carregarPedidosExpedicao(),
      carregarHistoricoSaidas(),
      carregarProducaoEmAndamento()
    ]);
  } catch (error) {
    console.error('Falha ao atualizar badges da Expedicao:', error);
  }
}

function atualizarBadgesMenu() {
  setBadge(refs.badgePedidos, contarPedidosAbertos(pedidosExpedicaoCache));
  setBadge(refs.badgeProducao, producaoEmAndamentoCache.length);
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

function obterPedidosExpedicaoFiltrados() {
  return pedidosExpedicaoCache.filter((item) => filtrarPorTimeline(item.status, refs.pedidosFiltroSituacao.value));
}

function filtrarPorTimeline(status, filtro) {
  const normalized = String(status || '').toUpperCase();

  if (filtro === 'encerradas') {
    return CLOSED_REQUEST_STATUSES.includes(normalized);
  }

  if (filtro === 'todas') {
    return true;
  }

  return ACTIVE_REQUEST_STATUSES.includes(normalized);
}

function obterMensagemTimeline(filtro, contexto) {
  if (filtro === 'encerradas') {
    return `Nenhum ${contexto} encerrado encontrado.`;
  }

  if (filtro === 'todas') {
    return `Nenhum ${contexto} encontrado.`;
  }

  return `Nenhum ${contexto} ativo encontrado.`;
}

function obterSaldosExpedicaoFiltrados() {
  const filtroCodigo = normalizarBusca(refs.filtroCodigo.value.trim());
  const filtroDescricao = normalizarBusca(refs.filtroDescricao.value.trim());
  const filtroClassificacao = refs.filtroClassificacao.value.trim().toUpperCase();
  const ordenacaoQuantidade = refs.filtroQuantidade.value;
  const saldosFiltrados = saldosExpedicaoCache.filter((item) => {
    if (filtroCodigo && !normalizarBusca(item.codigo).includes(filtroCodigo)) {
      return false;
    }

    if (filtroDescricao && !normalizarBusca(item.descricao).includes(filtroDescricao)) {
      return false;
    }

    if (filtroClassificacao && String(item.classificacao || '').toUpperCase() !== filtroClassificacao) {
      return false;
    }

    return true;
  });

  if (ordenacaoQuantidade === 'asc') {
    saldosFiltrados.sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));
  } else if (ordenacaoQuantidade === 'desc') {
    saldosFiltrados.sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0));
  }

  return saldosFiltrados;
}

function limparFiltrosEstoque() {
  refs.filtroCodigo.value = '';
  refs.filtroDescricao.value = '';
  refs.filtroClassificacao.value = '';
  refs.filtroQuantidade.value = '';
  renderizarEstoque();
}

function obterEstoquePorNome(chave) {
  return estoquesCache.find((estoque) => normalizarBusca(estoque.nome).includes(chave)) || null;
}

function obterSaldoExpedicao(idPeca) {
  const saldo = saldosExpedicaoCache.find((item) => Number(item.id_peca) === Number(idPeca));
  return saldo ? Number(saldo.quantidade || 0) : 0;
}

function obterSaldoMontagem(idPeca) {
  const saldo = saldosMontagemCache.find((item) => Number(item.id_peca) === Number(idPeca));
  return saldo ? Number(saldo.quantidade || 0) : 0;
}

function obterSaldoOrigemSolicitacao(item) {
  if (refs.solicitacaoOrigem.value === 'MONTAGEM') {
    return obterSaldoMontagem(item.id);
  }

  return Number(item.saldo_almoxarifado || 0);
}

function obterSaldoConsolidadoVenda(idPeca) {
  return obterSaldoExpedicao(idPeca) + obterSaldoMontagem(idPeca);
}

function calcularCapacidadeComponentesSubmontagem(item) {
  const componentes = estruturasSubmontagemCache.get(item.id) || [];

  if (!componentes.length) {
    return 0;
  }

  const capacidades = componentes.map((componente) => {
    const saldoComponente = obterSaldoConsolidadoVenda(componente.id_item_componente);
    return Math.floor(saldoComponente / Number(componente.quantidade || 1));
  });

  return capacidades.length ? Math.max(0, Math.min(...capacidades)) : 0;
}

function calcularDisponibilidadeSubmontagem(item) {
  const saldoPronto = obterSaldoConsolidadoVenda(item.id);
  const capacidadeComposicaoVenda = calcularDisponibilidadeComposicaoVenda(item.id);
  const possuiComposicaoVenda = (composicoesVendaCache.get(Number(item.id)) || []).length > 0;

  if (possuiComposicaoVenda) {
    return saldoPronto + capacidadeComposicaoVenda;
  }

  const capacidadeComponentes = calcularCapacidadeComponentesSubmontagem(item);

  return saldoPronto + capacidadeComposicaoVenda + Math.max(0, capacidadeComponentes);
}

function calcularDisponibilidadeComposicaoVenda(idItemVenda) {
  const composicao = composicoesVendaCache.get(Number(idItemVenda)) || [];

  if (!composicao.length) {
    return 0;
  }

  const capacidades = composicao.map((linha) => {
    const quantidadeBase = Number(linha.quantidade || 0);
    if (quantidadeBase <= 0) {
      return 0;
    }

    const itemAtende = itensCache.find((entry) => Number(entry.id) === Number(linha.id_item_atende));
    const saldoPronto = obterSaldoConsolidadoVenda(linha.id_item_atende);
    const capacidadeComponentes = itemAtende?.classificacao === 'SUBMONTAGEM'
      ? calcularCapacidadeComponentesSubmontagem(itemAtende)
      : 0;

    return Math.floor((saldoPronto + capacidadeComponentes) / quantidadeBase);
  });

  return capacidades.length ? Math.max(0, Math.min(...capacidades)) : 0;
}

function obterDisponibilidadeVenda(item) {
  const saldoPronto = obterSaldoConsolidadoVenda(item.id);
  const capacidadeComposicaoVenda = calcularDisponibilidadeComposicaoVenda(item.id);

  if (item.classificacao === 'SUBMONTAGEM') {
    return calcularDisponibilidadeSubmontagem(item);
  }

  return saldoPronto + capacidadeComposicaoVenda;
}

function esconderSugestoes() {
  refs.itemSugestoes.classList.add('hidden');
  refs.itemSugestoes.innerHTML = '';
}

function esconderSugestoesRetorno() {
  refs.retornoSugestoes.classList.add('hidden');
  refs.retornoSugestoes.innerHTML = '';
}

function esconderSugestoesSolicitacao() {
  refs.solicitacaoSugestoes.classList.add('hidden');
  refs.solicitacaoSugestoes.innerHTML = '';
}

function esconderSugestoesEfetuarMontagem() {
  refs.efetuarSugestoes.classList.add('hidden');
  refs.efetuarSugestoes.innerHTML = '';
}

function esconderSugestoesDesmembrar() {
  refs.desmembrarSugestoes.classList.add('hidden');
  refs.desmembrarSugestoes.innerHTML = '';
}

function esconderSugestoesSubmontagem() {
  refs.simulacaoSugestoes.classList.add('hidden');
  refs.simulacaoSugestoes.innerHTML = '';
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'expedicao-estrutura') fecharModalEstrutura();
  if (event.target.dataset.closeModal === 'expedicao-historico-item') fecharModalHistoricoItem();
  if (event.target.dataset.closeModal === 'expedicao-saldos-item') fecharModalSaldosItem();
  if (event.target.dataset.closeModal === 'expedicao-saida') fecharModalSaida();
  if (event.target.dataset.closeModal === 'expedicao-faltas') fecharModalFaltas();
  if (event.target.dataset.closeModal === 'expedicao-retorno') fecharModalRetorno();
  if (event.target.dataset.closeModal === 'expedicao-pedidos') fecharModalPedidos();
  if (event.target.dataset.closeModal === 'expedicao-historico') fecharModalHistorico();
  if (event.target.dataset.closeModal === 'expedicao-producao') fecharModalProducao();
  if (event.target.dataset.closeModal === 'expedicao-consumir-producao') fecharModalConsumirProducao();
  if (event.target.dataset.closeModal === 'expedicao-solicitacao') fecharModalSolicitacao();
  if (event.target.dataset.closeModal === 'expedicao-efetuar') fecharModalEfetuarMontagem();
  if (event.target.dataset.closeModal === 'expedicao-desmembrar') fecharModalDesmembrar();
  if (event.target.dataset.closeModal === 'expedicao-simulacao') fecharModalSimulacao();
  if (event.target.dataset.closeModal === 'expedicao-producao-solicitacao') fecharModalSolicitacaoProducao();
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  closeAllRowMenus();
  esconderSugestoes();
  esconderSugestoesRetorno();
  esconderSugestoesSolicitacao();
  esconderSugestoesEfetuarMontagem();
  esconderSugestoesDesmembrar();
  esconderSugestoesSubmontagem();

  if (!refs.solicitacaoProducaoModal.classList.contains('hidden')) {
    fecharModalSolicitacaoProducao();
    return;
  }

  if (!refs.estruturaModal.classList.contains('hidden')) {
    fecharModalEstrutura();
    return;
  }

  if (!refs.historicoItemModal.classList.contains('hidden')) {
    fecharModalHistoricoItem();
    return;
  }

  if (!refs.saldosItemModal.classList.contains('hidden')) {
    fecharModalSaldosItem();
    return;
  }

  if (!refs.faltasModal.classList.contains('hidden')) {
    fecharModalFaltas();
    return;
  }

  if (!refs.historicoModal.classList.contains('hidden')) {
    fecharModalHistorico();
    return;
  }

  if (!refs.retornoModal.classList.contains('hidden')) {
    fecharModalRetorno();
    return;
  }

  if (!refs.pedidosModal.classList.contains('hidden')) {
    fecharModalPedidos();
    return;
  }

  if (!refs.efetuarModal.classList.contains('hidden')) {
    fecharModalEfetuarMontagem();
    return;
  }

  if (!refs.desmembrarModal.classList.contains('hidden')) {
    fecharModalDesmembrar();
    return;
  }

  if (!refs.simulacaoModal.classList.contains('hidden')) {
    fecharModalSimulacao();
    return;
  }

  if (!refs.solicitacaoModal.classList.contains('hidden')) {
    fecharModalSolicitacao();
    return;
  }

  if (!refs.saidaModal.classList.contains('hidden')) {
    fecharModalSaida();
    return;
  }

  if (!refs.consumirProducaoModal.classList.contains('hidden')) {
    fecharModalConsumirProducao();
    return;
  }

  if (!refs.producaoModal.classList.contains('hidden')) {
    fecharModalProducao();
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
  const hasModal = [
    refs.estruturaModal,
    refs.historicoItemModal,
    refs.saldosItemModal,
    refs.saidaModal,
    refs.faltasModal,
    refs.retornoModal,
    refs.pedidosModal,
    refs.historicoModal,
    refs.producaoModal,
    refs.consumirProducaoModal,
    refs.solicitacaoModal,
    refs.efetuarModal,
    refs.desmembrarModal,
    refs.simulacaoModal,
    refs.solicitacaoProducaoModal
  ].some((item) => !item.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

function handleEstoqueActions(event) {
  const button = event.target.closest('button[data-action][data-item-id]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'structure') {
    abrirModalEstrutura(button.dataset.itemId);
    return;
  }

  if (button.dataset.action === 'history') {
    abrirModalHistoricoItem(button.dataset.itemId);
    return;
  }

  if (button.dataset.action === 'stocks') {
    abrirModalSaldosItem(button.dataset.itemId);
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

function getStockQuantity(item, key) {
  const row = Array.isArray(item.saldos_por_estoque)
    ? item.saldos_por_estoque.find((entry) => normalizarBusca(entry.estoque_nome).includes(key))
    : null;
  return row ? Number(row.quantidade || 0) : 0;
}

function renderizarPainelAutocomplete(panel, itens, mapper, emptyText) {
  if (!itens.length) {
    panel.innerHTML = `<div class="autocomplete-empty">${escapeHtml(emptyText)}</div>`;
    panel.classList.remove('hidden');
    return;
  }

  panel.innerHTML = itens.map((item) => {
    const mapped = mapper(item);
    return `
      <button type="button" class="autocomplete-option" data-id="${mapped.id}">
        <strong>${escapeHtml(mapped.title)}</strong>
        <span>${escapeHtml(mapped.subtitle)}</span>
      </button>
    `;
  }).join('');
  panel.classList.remove('hidden');
}

function parseDatasetJson(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function formatMateriaPrima(item) {
  const codigo = item.materia_prima_codigo || '';
  const nome = item.materia_prima_nome || '';

  if (!codigo && !nome) {
    return '-';
  }

  return codigo && nome ? `${codigo} - ${nome}` : (codigo || nome);
}

function renderStatus(status) {
  const normalized = String(status || '').toUpperCase();
  let className = 'status-chip';

  if (normalized === 'ATENDIDA') className += ' is-success';
  if (normalized === 'ATENDIDA_PARCIAL') className += ' is-warning';
  if (normalized === 'PENDENTE') className += ' is-danger';
  if (normalized === 'EM_SEPARACAO') className += ' is-success';
  if (normalized === 'FALTANDO_PECA') className += ' is-warning';
  if (normalized === 'MONTANDO') className += ' is-info';

  return `<span class="${className}">${escapeHtml(formatStatusLabel(normalized || '-'))}</span>`;
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemSaida(texto, tipo) {
  refs.saidaMensagem.textContent = texto;
  refs.saidaMensagem.className = `message ${tipo}`;
  refs.saidaMensagem.classList.remove('hidden');
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

function formatPackage(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return formatInteger(value);
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('pt-BR');
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

function formatStatusLabel(value) {
  const normalized = String(value || '').toUpperCase();
  const labels = {
    PENDENTE: 'Pendente',
    EM_SEPARACAO: 'Pronto',
    ATENDIDA_PARCIAL: 'Pode retirar parcial',
    ATENDIDA: 'Pode retirar',
    CANCELADA: 'Cancelada',
    FALTANDO_PECA: 'Faltando peca',
    MONTANDO: 'Montando'
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return String(value || '-')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

function formatarDataHora(value) {
  return formatDate(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
