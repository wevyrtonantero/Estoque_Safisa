const estoquesApiBaseUrl = '/api/estoques';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const estoqueItensApiBaseUrl = '/api/estoque/itens';
const transferenciaApiBaseUrl = '/api/estoque/transferencia';
const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';
const solicitacoesProducaoApiBaseUrl = '/api/solicitacoes-producao';
const submontagensApiBaseUrl = '/api/submontagens';
const producaoApiBaseUrl = '/api/producao';
const AUTO_REFRESH_MS = 15000;
const ACTIVE_REQUEST_STATUSES = ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'];
const CLOSED_REQUEST_STATUSES = ['ATENDIDA', 'CANCELADA'];

let estoquesCache = [];
let itensCache = [];
let submontagensCache = [];
let saldosMontagemCache = [];
let pedidosMontagemCache = [];
let pedidosRecebidosCache = [];
let producaoEmAndamentoCache = [];
let autoRefreshHandle = null;

const refs = {
  mensagem: document.getElementById('montagem-mensagem'),
  transferenciaMensagem: document.getElementById('montagem-transferencia-mensagem'),
  transferenciaForm: document.getElementById('montagem-transferencia-form'),
  itemId: document.getElementById('montagem-item-id'),
  itemBusca: document.getElementById('montagem-item-busca'),
  itemSugestoes: document.getElementById('montagem-item-sugestoes'),
  itemResumo: document.getElementById('montagem-item-resumo'),
  quantidade: document.getElementById('montagem-quantidade'),
  observacao: document.getElementById('montagem-observacao'),
  pedidosTbody: document.getElementById('montagem-pedidos-tbody'),
  pedidosRecebidosTbody: document.getElementById('montagem-pedidos-recebidos-tbody'),
  pedidosFiltroSituacao: document.getElementById('montagem-pedidos-filtro-situacao'),
  pedidosRecebidosFiltroSituacao: document.getElementById('montagem-recebidos-filtro-situacao'),
  estoqueTbody: document.getElementById('montagem-estoque-tbody'),
  filtroCodigo: document.getElementById('montagem-filtro-codigo'),
  filtroDescricao: document.getElementById('montagem-filtro-descricao'),
  filtroClassificacao: document.getElementById('montagem-filtro-classificacao'),
  filtroQuantidade: document.getElementById('montagem-filtro-quantidade'),
  badgePedidos: document.getElementById('montagem-badge-pedidos'),
  badgeRecebidos: document.getElementById('montagem-badge-recebidos'),
  badgeProducao: document.getElementById('montagem-badge-producao'),
  transferenciaModal: document.getElementById('montagem-transferencia-modal'),
  pedidosModal: document.getElementById('montagem-pedidos-modal'),
  pedidosRecebidosModal: document.getElementById('montagem-recebidos-modal'),
  producaoModal: document.getElementById('montagem-producao-modal'),
  producaoMensagem: document.getElementById('montagem-producao-mensagem'),
  producaoTbody: document.getElementById('montagem-producao-tbody'),
  solicitacaoModal: document.getElementById('montagem-solicitacao-modal'),
  solicitacaoMensagem: document.getElementById('montagem-solicitacao-mensagem'),
  solicitacaoForm: document.getElementById('montagem-solicitacao-form'),
  solicitacaoItemId: document.getElementById('montagem-solicitacao-item-id'),
  solicitacaoBusca: document.getElementById('montagem-solicitacao-item-busca'),
  solicitacaoSugestoes: document.getElementById('montagem-solicitacao-item-sugestoes'),
  solicitacaoResumo: document.getElementById('montagem-solicitacao-item-resumo'),
  solicitacaoQuantidade: document.getElementById('montagem-solicitacao-quantidade'),
  solicitacaoObservacao: document.getElementById('montagem-solicitacao-observacao'),
  simulacaoModal: document.getElementById('montagem-simulacao-modal'),
  simulacaoMensagem: document.getElementById('montagem-simulacao-mensagem'),
  simulacaoForm: document.getElementById('montagem-simulacao-form'),
  simulacaoSubmontagemId: document.getElementById('montagem-simulacao-submontagem-id'),
  simulacaoBusca: document.getElementById('montagem-simulacao-submontagem-busca'),
  simulacaoSugestoes: document.getElementById('montagem-simulacao-submontagem-sugestoes'),
  simulacaoQuantidade: document.getElementById('montagem-simulacao-quantidade'),
  simulacaoResumo: document.getElementById('montagem-simulacao-resumo'),
  simulacaoTbody: document.getElementById('montagem-simulacao-tbody'),
  atendimentoModal: document.getElementById('montagem-atendimento-modal'),
  atendimentoMensagem: document.getElementById('montagem-atendimento-mensagem'),
  atendimentoForm: document.getElementById('montagem-atendimento-form'),
  atendimentoId: document.getElementById('montagem-atendimento-id'),
  atendimentoResumo: document.getElementById('montagem-atendimento-resumo'),
  atendimentoQuantidade: document.getElementById('montagem-atendimento-quantidade'),
  atendimentoObservacao: document.getElementById('montagem-atendimento-observacao'),
  solicitacaoProducaoModal: document.getElementById('montagem-producao-solicitacao-modal'),
  solicitacaoProducaoMensagem: document.getElementById('montagem-producao-solicitacao-mensagem'),
  solicitacaoProducaoForm: document.getElementById('montagem-producao-solicitacao-form'),
  solicitacaoProducaoItemId: document.getElementById('montagem-producao-solicitacao-item-id'),
  solicitacaoProducaoResumo: document.getElementById('montagem-producao-solicitacao-resumo'),
  solicitacaoProducaoQuantidade: document.getElementById('montagem-producao-solicitacao-quantidade'),
  solicitacaoProducaoObservacao: document.getElementById('montagem-producao-solicitacao-observacao')
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
  refs.transferenciaForm.addEventListener('submit', handleTransferencia);
  refs.itemBusca.addEventListener('input', () => {
    refs.itemId.value = '';
    renderizarResumoItem(null);
    renderizarSugestoes(refs.itemBusca.value.trim());
  });
  refs.itemBusca.addEventListener('focus', () => renderizarSugestoes(refs.itemBusca.value.trim()));
  refs.itemSugestoes.addEventListener('click', handleSugestaoClick);

  document.addEventListener('click', (event) => {
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
      esconderSugestoes();
      esconderSugestoesSolicitacao();
      esconderSugestoesSubmontagem();
    }
  });
  document.getElementById('montagem-btn-transferencia-menu').addEventListener('click', abrirModalTransferencia);
  document.getElementById('montagem-btn-solicitar').addEventListener('click', () => abrirModalSolicitacao());
  document.getElementById('montagem-btn-solicitar-inline').addEventListener('click', () => abrirModalSolicitacao());
  document.getElementById('montagem-btn-simular').addEventListener('click', abrirModalSimulacao);
  document.getElementById('montagem-btn-pedidos-menu').addEventListener('click', abrirModalPedidos);
  document.getElementById('montagem-btn-recebidos-menu').addEventListener('click', abrirModalPedidosRecebidos);
  document.getElementById('montagem-btn-producao').addEventListener('click', abrirModalProducao);
  refs.pedidosFiltroSituacao.addEventListener('change', renderizarPedidos);
  refs.pedidosRecebidosFiltroSituacao.addEventListener('change', renderizarPedidosRecebidos);
  refs.filtroCodigo.addEventListener('input', renderizarEstoque);
  refs.filtroDescricao.addEventListener('input', renderizarEstoque);
  refs.filtroClassificacao.addEventListener('change', renderizarEstoque);
  refs.filtroQuantidade.addEventListener('change', renderizarEstoque);
  document.getElementById('montagem-btn-limpar-filtros-estoque').addEventListener('click', limparFiltrosEstoque);
  document.getElementById('btn-fechar-modal-montagem-transferencia').addEventListener('click', fecharModalTransferencia);
  document.getElementById('btn-cancelar-modal-montagem-transferencia').addEventListener('click', fecharModalTransferencia);
  document.getElementById('btn-fechar-modal-montagem-pedidos').addEventListener('click', fecharModalPedidos);
  document.getElementById('btn-fechar-modal-montagem-recebidos').addEventListener('click', fecharModalPedidosRecebidos);
  document.getElementById('btn-fechar-modal-montagem-producao').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-montagem-producao-rodape').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-montagem-solicitacao').addEventListener('click', fecharModalSolicitacao);
  document.getElementById('btn-cancelar-modal-montagem-solicitacao').addEventListener('click', fecharModalSolicitacao);
  document.getElementById('btn-fechar-modal-montagem-simulacao').addEventListener('click', fecharModalSimulacao);
  document.getElementById('btn-fechar-modal-montagem-atendimento').addEventListener('click', fecharModalAtendimento);
  document.getElementById('btn-cancelar-modal-montagem-atendimento').addEventListener('click', fecharModalAtendimento);
  document.getElementById('btn-fechar-modal-montagem-producao-solicitacao').addEventListener('click', fecharModalSolicitacaoProducao);
  document.getElementById('btn-cancelar-modal-montagem-producao-solicitacao').addEventListener('click', fecharModalSolicitacaoProducao);
  [
    refs.transferenciaModal,
    refs.pedidosModal,
    refs.pedidosRecebidosModal,
    refs.producaoModal,
    refs.solicitacaoModal,
    refs.simulacaoModal,
    refs.atendimentoModal,
    refs.solicitacaoProducaoModal
  ].forEach((modal) => modal.addEventListener('click', handleModalBackdrop));
  refs.solicitacaoForm.addEventListener('submit', handleCriarSolicitacao);
  refs.simulacaoForm.addEventListener('submit', handleSimular);
  refs.simulacaoTbody.addEventListener('click', handleSimulacaoActions);
  refs.atendimentoForm.addEventListener('submit', handleAtenderPedidoRecebido);
  refs.pedidosRecebidosTbody.addEventListener('click', handlePedidosRecebidosActions);
  refs.solicitacaoProducaoForm.addEventListener('submit', handleCriarSolicitacaoProducao);
  refs.solicitacaoBusca.addEventListener('input', () => {
    refs.solicitacaoItemId.value = '';
    renderizarResumoItemSolicitacao(null);
    renderizarSugestoesSolicitacao(refs.solicitacaoBusca.value.trim());
  });
  refs.solicitacaoBusca.addEventListener('focus', () => renderizarSugestoesSolicitacao(refs.solicitacaoBusca.value.trim()));
  refs.solicitacaoSugestoes.addEventListener('click', handleSugestaoSolicitacaoClick);
  refs.simulacaoBusca.addEventListener('input', () => {
    refs.simulacaoSubmontagemId.value = '';
    renderizarSugestoesSubmontagem(refs.simulacaoBusca.value.trim());
  });
  refs.simulacaoBusca.addEventListener('focus', () => renderizarSugestoesSubmontagem(refs.simulacaoBusca.value.trim()));
  refs.simulacaoSugestoes.addEventListener('click', handleSugestaoSubmontagemClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function abrirModalTransferencia() {
  refs.transferenciaMensagem.className = 'message hidden';
  refs.transferenciaMensagem.textContent = '';
  openModal(refs.transferenciaModal);
}

function fecharModalTransferencia() {
  closeModal(refs.transferenciaModal);
}

function abrirModalPedidos() {
  openModal(refs.pedidosModal);
}

function fecharModalPedidos() {
  closeModal(refs.pedidosModal);
}

function abrirModalPedidosRecebidos() {
  openModal(refs.pedidosRecebidosModal);
}

function fecharModalPedidosRecebidos() {
  closeModal(refs.pedidosRecebidosModal);
}

async function carregarTudo() {
  await carregarEstoques();
  await Promise.all([
    carregarItens(),
    carregarSubmontagens(),
    carregarEstoqueMontagem(),
    carregarPedidosMontagem(),
    carregarPedidosRecebidos(),
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
  renderizarEstoque();
  atualizarIndicadores();
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

async function carregarPedidosMontagem() {
  const response = await fetch(`${solicitacoesApiBaseUrl}?area_origem=MONTAGEM`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os pedidos da Montagem.');
  }

  pedidosMontagemCache = result;
  renderizarPedidos();
  atualizarIndicadores();
}

async function carregarPedidosRecebidos() {
  const response = await fetch(`${solicitacoesApiBaseUrl}?area_origem=EXPEDICAO&origem_atendimento=MONTAGEM&abertas=1`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os pedidos recebidos da Expedicao.');
  }

  pedidosRecebidosCache = result;
  renderizarPedidosRecebidos();
  atualizarBadgesMenu();
}

function renderizarSugestoes(termo) {
  const filtro = normalizarBusca(termo);
  const itens = saldosMontagemCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.itemSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum item disponivel na Montagem.</div>';
    refs.itemSugestoes.classList.remove('hidden');
    return;
  }

  refs.itemSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id_peca}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`${item.classificacao} | Saldo: ${formatInteger(item.quantidade)}`)}</span>
    </button>
  `).join('');
  refs.itemSugestoes.classList.remove('hidden');
}

function handleSugestaoClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = saldosMontagemCache.find((entry) => Number(entry.id_peca) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.itemId.value = String(item.id_peca);
  refs.itemBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoItem(item);
  esconderSugestoes();
}

function renderizarResumoItem(item) {
  if (!item) {
    refs.itemResumo.classList.add('selected-tags', 'empty');
    refs.itemResumo.textContent = 'Selecione um item para ver o saldo disponivel na Montagem.';
    return;
  }

  refs.itemResumo.classList.remove('empty');
  refs.itemResumo.classList.add('selected-tags');
  refs.itemResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo na Montagem: ${formatInteger(item.quantidade)}`)}</span>
  `;
}

function renderizarSugestoesSolicitacao(termo) {
  const filtro = normalizarBusca(termo);
  const itens = itensCache.filter((item) => {
    if (obterSaldoAlmoxarifado(item) <= 0) {
      return false;
    }

    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.solicitacaoSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma peca com saldo disponivel no Almoxarifado.</div>';
    refs.solicitacaoSugestoes.classList.remove('hidden');
    return;
  }

  refs.solicitacaoSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`${item.classificacao} | Pacote: ${formatPackage(item.estoque_minimo)} | Almox: ${formatInteger(item.saldo_almoxarifado)}`)}</span>
    </button>
  `).join('');
  refs.solicitacaoSugestoes.classList.remove('hidden');
}

function handleSugestaoSolicitacaoClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.solicitacaoItemId.value = String(item.id);
  refs.solicitacaoBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoItemSolicitacao(item);
  esconderSugestoesSolicitacao();
}

function renderizarResumoItemSolicitacao(item) {
  if (!item) {
    refs.solicitacaoResumo.classList.add('selected-tags', 'empty');
    refs.solicitacaoResumo.textContent = 'Digite para ver a quantidade por pacote e o saldo atual no Almoxarifado.';
    return;
  }

  refs.solicitacaoResumo.classList.remove('empty');
  refs.solicitacaoResumo.classList.add('selected-tags');
  refs.solicitacaoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Qtd por pacote: ${formatPackage(item.estoque_minimo)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo Almox: ${formatInteger(item.saldo_almoxarifado)}`)}</span>
  `;
}

function abrirModalSolicitacao(prefill = null) {
  refs.solicitacaoMensagem.className = 'message hidden';
  refs.solicitacaoMensagem.textContent = '';

  if (prefill) {
    preencherSolicitacaoEstoque(prefill);
  } else {
    refs.solicitacaoForm.reset();
    refs.solicitacaoQuantidade.value = '1';
    refs.solicitacaoItemId.value = '';
    refs.solicitacaoBusca.value = '';
    renderizarResumoItemSolicitacao(null);
  }

  openModal(refs.solicitacaoModal);
}

function fecharModalSolicitacao() {
  closeModal(refs.solicitacaoModal);
}

async function handleCriarSolicitacao(event) {
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
    const saldoDisponivel = obterSaldoAlmoxarifado(item);

    if (saldoDisponivel <= 0) {
      throw new Error('O Almoxarifado nao possui saldo disponivel para esta solicitacao.');
    }

    if (quantidadeSolicitada > saldoDisponivel) {
      throw new Error(`Saldo insuficiente no Almoxarifado. Disponivel: ${formatInteger(saldoDisponivel)}.`);
    }

    const response = await fetch(solicitacoesApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_origem: 'MONTAGEM',
        origem_atendimento: 'ALMOXARIFADO',
        id_peca: refs.solicitacaoItemId.value,
        quantidade_solicitada: refs.solicitacaoQuantidade.value,
        observacao: refs.solicitacaoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel criar a solicitacao.');
    }

    fecharModalSolicitacao();
    mostrarMensagem('Solicitacao enviada com sucesso.', 'success');
    await carregarPedidosMontagem();
  } catch (error) {
    refs.solicitacaoMensagem.textContent = error.message;
    refs.solicitacaoMensagem.className = 'message error';
    refs.solicitacaoMensagem.classList.remove('hidden');
  }
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

function abrirModalSimulacao() {
  refs.simulacaoMensagem.className = 'message hidden';
  refs.simulacaoMensagem.textContent = '';
  refs.simulacaoResumo.classList.add('selected-tags', 'empty');
  refs.simulacaoResumo.textContent = 'A simulacao vai mostrar o que falta e a melhor acao sugerida.';
  refs.simulacaoTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma simulacao executada.</td></tr>';
  openModal(refs.simulacaoModal);
}

function fecharModalSimulacao() {
  closeModal(refs.simulacaoModal);
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
    const suggestion = buildSuggestion(item, 'MONTAGEM');

    return `
      <tr class="${item.quantidade_faltante > 0 ? 'table-row-attention' : ''}">
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
  if (item.quantidade_faltante <= 0 || suggestion.type === 'NONE') {
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
        area_origem: 'MONTAGEM',
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

async function handleTransferencia(event) {
  event.preventDefault();

  try {
    const montagem = obterEstoquePorNome('mont');
    const expedicao = obterEstoquePorNome('exped');

    if (!montagem || !expedicao) {
      throw new Error('Nao foi possivel identificar Montagem e Expedicao.');
    }

    if (!refs.itemId.value) {
      throw new Error('Selecione um item valido da Montagem.');
    }

    const response = await fetch(transferenciaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: refs.itemId.value,
        id_estoque_origem: montagem.id,
        id_estoque_destino: expedicao.id,
        quantidade: refs.quantidade.value,
        observacao: refs.observacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel transferir para a Expedicao.');
    }

    refs.transferenciaForm.reset();
    refs.quantidade.value = '1';
    refs.itemId.value = '';
    renderizarResumoItem(null);
    esconderSugestoes();
    mostrarMensagemTransferencia('Transferencia realizada com sucesso.', 'success');
    await carregarEstoqueMontagem();
  } catch (error) {
    mostrarMensagemTransferencia(error.message, 'error');
  }
}

async function abrirModalProducao() {
  refs.producaoMensagem.className = 'message hidden';
  refs.producaoMensagem.textContent = '';
  refs.producaoTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Carregando producao...</td></tr>';
  openModal(refs.producaoModal);

  try {
    await carregarProducaoEmAndamento();
  } catch (error) {
    refs.producaoMensagem.textContent = error.message;
    refs.producaoMensagem.className = 'message error';
    refs.producaoMensagem.classList.remove('hidden');
    refs.producaoTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nao foi possivel carregar a producao.</td></tr>';
  }
}

function fecharModalProducao() {
  closeModal(refs.producaoModal);
}

function renderizarProducao(producoes) {
  if (!Array.isArray(producoes) || !producoes.length) {
    refs.producaoTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma ordem em andamento no momento.</td></tr>';
    return;
  }

  refs.producaoTbody.innerHTML = producoes.map((item) => `
    <tr>
      <td class="table-code">OP ${escapeHtml(item.id)}</td>
      <td>${escapeHtml(item.maquina_nome || '-')}</td>
      <td class="table-code">${escapeHtml(item.peca_codigo || '-')}</td>
      <td class="table-description">${escapeHtml(item.peca_descricao || '-')}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_planejada)}</td>
      <td>${escapeHtml(formatMateriaPrima(item))}</td>
      <td>${formatDate(item.data_inicio)}</td>
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

function renderizarPedidos() {
  const pedidosFiltrados = obterPedidosMontagemFiltrados();
  document.getElementById('montagem-pedidos-total').textContent = `${pedidosFiltrados.length} registro(s) encontrado(s)`;

  if (!pedidosMontagemCache.length) {
    refs.pedidosTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum pedido da Montagem encontrado.</td></tr>';
    return;
  }

  if (!pedidosFiltrados.length) {
    refs.pedidosTbody.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(obterMensagemTimeline(refs.pedidosFiltroSituacao.value, 'pedido da Montagem'))}</td></tr>`;
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
      <td>${formatDate(item.data_solicitacao)}</td>
    </tr>
  `).join('');
}

function renderizarPedidosRecebidos() {
  const pedidosFiltrados = obterPedidosRecebidosFiltrados();
  document.getElementById('montagem-pedidos-recebidos-total').textContent = `${pedidosFiltrados.length} registro(s) encontrado(s)`;

  if (!pedidosRecebidosCache.length) {
    refs.pedidosRecebidosTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum pedido da Expedicao para a Montagem.</td></tr>';
    return;
  }

  if (!pedidosFiltrados.length) {
    refs.pedidosRecebidosTbody.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(obterMensagemTimeline(refs.pedidosRecebidosFiltroSituacao.value, 'pedido da Expedicao para a Montagem'))}</td></tr>`;
    return;
  }

  refs.pedidosRecebidosTbody.innerHTML = pedidosFiltrados.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatPackage(item.quantidade_pacote)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_solicitada)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente)}</td>
      <td class="table-quantity">${formatInteger(obterSaldoMontagem(item.id_peca))}</td>
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

function handlePedidosRecebidosActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) {
    return;
  }

  const pedido = pedidosRecebidosCache.find((item) => Number(item.id) === Number(actionButton.dataset.id));
  if (!pedido) {
    return;
  }

  if (actionButton.dataset.action === 'iniciar') {
    executarAcaoSolicitacao(`${solicitacoesApiBaseUrl}/${pedido.id}/iniciar-separacao`, 'Separacao iniciada na Montagem.');
    return;
  }

  refs.atendimentoMensagem.className = 'message hidden';
  refs.atendimentoMensagem.textContent = '';
  refs.atendimentoId.value = String(pedido.id);
  refs.atendimentoQuantidade.value = '1';
  refs.atendimentoQuantidade.max = String(Math.max(1, Number(pedido.quantidade_pendente || 0)));
  refs.atendimentoObservacao.value = pedido.observacao || '';
  refs.atendimentoResumo.classList.remove('empty');
  refs.atendimentoResumo.classList.add('selected-tags');
  refs.atendimentoResumo.innerHTML = `
    <span class="selected-tag">Expedicao</span>
    <span class="selected-tag">${escapeHtml(`${pedido.codigo} - ${pedido.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Qtd pacote: ${formatPackage(pedido.quantidade_pacote)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Pendente: ${formatInteger(pedido.quantidade_pendente)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo Montagem: ${formatInteger(obterSaldoMontagem(pedido.id_peca))}`)}</span>
  `;
  openModal(refs.atendimentoModal);
}

async function executarAcaoSolicitacao(url, successMessage) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Operacao nao concluida.');
    }

    mostrarMensagem(successMessage, 'success');
    await carregarPedidosRecebidos();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function fecharModalAtendimento() {
  closeModal(refs.atendimentoModal);
}

async function handleAtenderPedidoRecebido(event) {
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
      throw new Error(result.message || 'Nao foi possivel atender o pedido da Expedicao.');
    }

    fecharModalAtendimento();
    mostrarMensagem('Pedido da Expedicao atendido com sucesso.', 'success');
    await Promise.all([carregarPedidosRecebidos(), carregarEstoqueMontagem()]);
  } catch (error) {
    refs.atendimentoMensagem.textContent = error.message;
    refs.atendimentoMensagem.className = 'message error';
    refs.atendimentoMensagem.classList.remove('hidden');
  }
}

function renderizarEstoque() {
  const saldosFiltrados = obterSaldosMontagemFiltrados();
  document.getElementById('montagem-estoque-total').textContent = `${saldosFiltrados.length} registro(s) encontrado(s)`;

  if (!saldosMontagemCache.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum saldo na Montagem.</td></tr>';
    return;
  }

  if (!saldosFiltrados.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum item encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.estoqueTbody.innerHTML = saldosFiltrados.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.tipo)}</td>
      <td>${escapeHtml(item.classificacao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  document.getElementById('montagem-card-itens').textContent = String(saldosMontagemCache.length);
  document.getElementById('montagem-card-quantidade').textContent = formatInteger(
    saldosMontagemCache.reduce((total, item) => total + Number(item.quantidade || 0), 0)
  );
  document.getElementById('montagem-card-pedidos').textContent = String(
    pedidosMontagemCache.filter((item) => ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(item.status)).length
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
      carregarPedidosMontagem(),
      carregarPedidosRecebidos(),
      carregarProducaoEmAndamento()
    ]);
  } catch (error) {
    console.error('Falha ao atualizar badges da Montagem:', error);
  }
}

function atualizarBadgesMenu() {
  setBadge(refs.badgePedidos, contarPedidosAbertos(pedidosMontagemCache));
  setBadge(refs.badgeRecebidos, contarPedidosAbertos(pedidosRecebidosCache));
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

function obterPedidosMontagemFiltrados() {
  return pedidosMontagemCache.filter((item) => filtrarPorTimeline(item.status, refs.pedidosFiltroSituacao.value));
}

function obterPedidosRecebidosFiltrados() {
  return pedidosRecebidosCache.filter((item) => filtrarPorTimeline(item.status, refs.pedidosRecebidosFiltroSituacao.value));
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

function obterSaldosMontagemFiltrados() {
  const filtroCodigo = normalizarBusca(refs.filtroCodigo.value.trim());
  const filtroDescricao = normalizarBusca(refs.filtroDescricao.value.trim());
  const filtroClassificacao = refs.filtroClassificacao.value.trim().toUpperCase();
  const ordenacaoQuantidade = refs.filtroQuantidade.value;
  const saldosFiltrados = saldosMontagemCache.filter((item) => {
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

function esconderSugestoes() {
  refs.itemSugestoes.classList.add('hidden');
  refs.itemSugestoes.innerHTML = '';
}

function esconderSugestoesSolicitacao() {
  refs.solicitacaoSugestoes.classList.add('hidden');
  refs.solicitacaoSugestoes.innerHTML = '';
}

function esconderSugestoesSubmontagem() {
  refs.simulacaoSugestoes.classList.add('hidden');
  refs.simulacaoSugestoes.innerHTML = '';
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'montagem-transferencia') fecharModalTransferencia();
  if (event.target.dataset.closeModal === 'montagem-pedidos') fecharModalPedidos();
  if (event.target.dataset.closeModal === 'montagem-recebidos') fecharModalPedidosRecebidos();
  if (event.target.dataset.closeModal === 'montagem-producao') fecharModalProducao();
  if (event.target.dataset.closeModal === 'montagem-solicitacao') fecharModalSolicitacao();
  if (event.target.dataset.closeModal === 'montagem-simulacao') fecharModalSimulacao();
  if (event.target.dataset.closeModal === 'montagem-atendimento') fecharModalAtendimento();
  if (event.target.dataset.closeModal === 'montagem-producao-solicitacao') fecharModalSolicitacaoProducao();
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  closeAllRowMenus();
  esconderSugestoes();
  esconderSugestoesSolicitacao();
  esconderSugestoesSubmontagem();

  if (!refs.solicitacaoProducaoModal.classList.contains('hidden')) {
    fecharModalSolicitacaoProducao();
    return;
  }

  if (!refs.pedidosRecebidosModal.classList.contains('hidden')) {
    fecharModalPedidosRecebidos();
    return;
  }

  if (!refs.pedidosModal.classList.contains('hidden')) {
    fecharModalPedidos();
    return;
  }

  if (!refs.atendimentoModal.classList.contains('hidden')) {
    fecharModalAtendimento();
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

  if (!refs.transferenciaModal.classList.contains('hidden')) {
    fecharModalTransferencia();
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
    refs.transferenciaModal,
    refs.pedidosModal,
    refs.pedidosRecebidosModal,
    refs.producaoModal,
    refs.solicitacaoModal,
    refs.simulacaoModal,
    refs.atendimentoModal,
    refs.solicitacaoProducaoModal
  ].some((item) => !item.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
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
  if (normalized === 'EM_SEPARACAO') className += ' is-info';

  return `<span class="${className}">${escapeHtml(normalized || '-')}</span>`;
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemTransferencia(texto, tipo) {
  refs.transferenciaMensagem.textContent = texto;
  refs.transferenciaMensagem.className = `message ${tipo}`;
  refs.transferenciaMensagem.classList.remove('hidden');
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function obterSaldoMontagem(idPeca) {
  const saldo = saldosMontagemCache.find((item) => Number(item.id_peca) === Number(idPeca));
  return saldo ? Number(saldo.quantidade || 0) : 0;
}

function obterSaldoAlmoxarifado(item) {
  return Number(item?.saldo_almoxarifado || 0);
}

function preencherSolicitacaoEstoque(prefill) {
  const item = itensCache.find((entry) => Number(entry.id) === Number(prefill.id));

  refs.solicitacaoForm.reset();
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
