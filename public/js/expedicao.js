const estoquesApiBaseUrl = '/api/estoques';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const estoqueItensApiBaseUrl = '/api/estoque/itens';
const estoqueMovimentacoesApiBaseUrl = '/api/estoque/movimentacoes';
const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';
const solicitacoesProducaoApiBaseUrl = '/api/solicitacoes-producao';
const saidaApiBaseUrl = '/api/estoque/saida';
const submontagensApiBaseUrl = '/api/submontagens';
const producaoApiBaseUrl = '/api/producao';
const AUTO_REFRESH_MS = 15000;

let estoquesCache = [];
let itensCache = [];
let saldosExpedicaoCache = [];
let saldosMontagemCache = [];
let pedidosExpedicaoCache = [];
let historicoSaidasCache = [];
let saidaLista = [];
let estruturasSubmontagemCache = new Map();
let submontagensCache = [];
let producaoEmAndamentoCache = [];
let autoRefreshHandle = null;

const refs = {
  mensagem: document.getElementById('expedicao-mensagem'),
  saidaMensagem: document.getElementById('expedicao-saida-mensagem'),
  itemId: document.getElementById('expedicao-item-id'),
  itemBusca: document.getElementById('expedicao-item-busca'),
  itemSugestoes: document.getElementById('expedicao-item-sugestoes'),
  itemResumo: document.getElementById('expedicao-item-resumo'),
  quantidade: document.getElementById('expedicao-quantidade'),
  observacao: document.getElementById('expedicao-observacao'),
  listaTbody: document.getElementById('expedicao-lista-tbody'),
  pedidosTbody: document.getElementById('expedicao-pedidos-tbody'),
  historicoTbody: document.getElementById('expedicao-historico-tbody'),
  estoqueTbody: document.getElementById('expedicao-estoque-tbody'),
  filtroCodigo: document.getElementById('expedicao-filtro-codigo'),
  filtroDescricao: document.getElementById('expedicao-filtro-descricao'),
  filtroClassificacao: document.getElementById('expedicao-filtro-classificacao'),
  filtroQuantidade: document.getElementById('expedicao-filtro-quantidade'),
  badgePedidos: document.getElementById('expedicao-badge-pedidos'),
  badgeProducao: document.getElementById('expedicao-badge-producao'),
  saidaModal: document.getElementById('expedicao-saida-modal'),
  pedidosModal: document.getElementById('expedicao-pedidos-modal'),
  historicoModal: document.getElementById('expedicao-historico-modal'),
  producaoModal: document.getElementById('expedicao-producao-modal'),
  producaoMensagem: document.getElementById('expedicao-producao-mensagem'),
  producaoTbody: document.getElementById('expedicao-producao-tbody'),
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
  refs.itemBusca.addEventListener('input', () => {
    refs.itemId.value = '';
    renderizarResumoItem(null);
    renderizarSugestoes(refs.itemBusca.value.trim());
  });
  refs.itemBusca.addEventListener('focus', () => renderizarSugestoes(refs.itemBusca.value.trim()));
  refs.itemSugestoes.addEventListener('click', handleSugestaoClick);
  document.getElementById('expedicao-btn-adicionar').addEventListener('click', adicionarItemNaLista);
  document.getElementById('expedicao-btn-limpar-item').addEventListener('click', limparItemAtual);
  document.getElementById('expedicao-btn-baixar').addEventListener('click', baixarSaida);
  refs.listaTbody.addEventListener('click', handleListaActions);

  document.getElementById('expedicao-btn-saida-menu').addEventListener('click', abrirModalSaida);
  document.getElementById('expedicao-btn-solicitar').addEventListener('click', () => abrirModalSolicitacao());
  document.getElementById('expedicao-btn-solicitar-inline').addEventListener('click', () => abrirModalSolicitacao());
  document.getElementById('expedicao-btn-simular').addEventListener('click', abrirModalSimulacao);
  document.getElementById('expedicao-btn-pedidos-menu').addEventListener('click', abrirModalPedidos);
  document.getElementById('expedicao-btn-historico-menu').addEventListener('click', abrirModalHistorico);
  document.getElementById('expedicao-btn-producao').addEventListener('click', abrirModalProducao);
  refs.filtroCodigo.addEventListener('input', renderizarEstoque);
  refs.filtroDescricao.addEventListener('input', renderizarEstoque);
  refs.filtroClassificacao.addEventListener('change', renderizarEstoque);
  refs.filtroQuantidade.addEventListener('change', renderizarEstoque);
  document.getElementById('expedicao-btn-limpar-filtros-estoque').addEventListener('click', limparFiltrosEstoque);
  document.getElementById('btn-fechar-modal-expedicao-saida').addEventListener('click', fecharModalSaida);
  document.getElementById('btn-fechar-modal-expedicao-pedidos').addEventListener('click', fecharModalPedidos);
  document.getElementById('btn-fechar-modal-expedicao-historico').addEventListener('click', fecharModalHistorico);
  document.getElementById('btn-fechar-modal-expedicao-producao').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-expedicao-producao-rodape').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-expedicao-solicitacao').addEventListener('click', fecharModalSolicitacao);
  document.getElementById('btn-cancelar-modal-expedicao-solicitacao').addEventListener('click', fecharModalSolicitacao);
  document.getElementById('btn-fechar-modal-expedicao-simulacao').addEventListener('click', fecharModalSimulacao);
  document.getElementById('btn-fechar-modal-expedicao-producao-solicitacao').addEventListener('click', fecharModalSolicitacaoProducao);
  document.getElementById('btn-cancelar-modal-expedicao-producao-solicitacao').addEventListener('click', fecharModalSolicitacaoProducao);

  refs.solicitacaoForm.addEventListener('submit', handleCriarSolicitacao);
  refs.solicitacaoOrigem.addEventListener('change', handleSolicitacaoOrigemChange);
  refs.solicitacaoBusca.addEventListener('input', () => {
    refs.solicitacaoItemId.value = '';
    renderizarResumoItemSolicitacao(null);
    renderizarSugestoesSolicitacao(refs.solicitacaoBusca.value.trim());
  });
  refs.solicitacaoBusca.addEventListener('focus', () => renderizarSugestoesSolicitacao(refs.solicitacaoBusca.value.trim()));
  refs.solicitacaoSugestoes.addEventListener('click', handleSugestaoSolicitacaoClick);

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
    } else if (!event.target.closest('.row-menu')) {
      closeAllRowMenus();
    }

    if (!event.target.closest('.autocomplete')) {
      esconderSugestoes();
      esconderSugestoesSolicitacao();
      esconderSugestoesSubmontagem();
    }
  });

  [
    refs.saidaModal,
    refs.pedidosModal,
    refs.historicoModal,
    refs.producaoModal,
    refs.solicitacaoModal,
    refs.simulacaoModal,
    refs.solicitacaoProducaoModal
  ].forEach((modal) => modal.addEventListener('click', handleModalBackdrop));

  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarTudo() {
  await carregarEstoques();
  await carregarItens();
  await carregarSubmontagens();
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
  await preCarregarEstruturasSubmontagem();
}

async function carregarSubmontagens() {
  const response = await fetch(submontagensApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as submontagens.');
  }

  submontagensCache = result;
}

async function preCarregarEstruturasSubmontagem() {
  const submontagens = itensCache.filter((item) => item.classificacao === 'SUBMONTAGEM');

  await Promise.all(submontagens.map(async (item) => {
    if (estruturasSubmontagemCache.has(item.id)) {
      return;
    }

    try {
      const response = await fetch(`/api/submontagens/${item.id}/componentes`);
      const result = await response.json();

      if (response.ok) {
        estruturasSubmontagemCache.set(item.id, result);
      }
    } catch (_) {
      // Mantem a tela resiliente se alguma estrutura falhar.
    }
  }));
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

function renderizarSugestoes(termo) {
  const filtro = normalizarBusca(termo);
  const itens = itensCache.filter((item) => {
    const disponibilidade = obterDisponibilidadeVenda(item);

    if (disponibilidade <= 0) {
      return false;
    }

    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.itemSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum item disponivel para venda na Expedicao.</div>';
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

function handleSugestaoClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.itemId.value = String(item.id);
  refs.itemBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoItem(item);
  esconderSugestoes();
}

function renderizarResumoItem(item) {
  if (!item) {
    refs.itemResumo.classList.add('selected-tags', 'empty');
    refs.itemResumo.textContent = 'Selecione um item para ver a disponibilidade atual na Expedicao.';
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
  openModal(refs.saidaModal);
}

function fecharModalSaida() {
  closeModal(refs.saidaModal);
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
  closeModal(refs.solicitacaoModal);
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
  const itens = itensCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.solicitacaoSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma peca encontrada.</div>';
    refs.solicitacaoSugestoes.classList.remove('hidden');
    return;
  }

  refs.solicitacaoSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`${item.classificacao} | Pacote: ${formatPackage(item.estoque_minimo)} | Origem: ${formatInteger(obterSaldoOrigemSolicitacao(item))}`)}</span>
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
    refs.solicitacaoResumo.textContent = 'Digite para ver a quantidade por pacote e o saldo na origem escolhida.';
    return;
  }

  const origemLabel = refs.solicitacaoOrigem.value === 'MONTAGEM' ? 'Saldo Montagem' : 'Saldo Almox';

  refs.solicitacaoResumo.classList.remove('empty');
  refs.solicitacaoResumo.classList.add('selected-tags');
  refs.solicitacaoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Qtd por pacote: ${formatPackage(item.estoque_minimo)}`)}</span>
    <span class="selected-tag">${escapeHtml(`${origemLabel}: ${formatInteger(obterSaldoOrigemSolicitacao(item))}`)}</span>
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

async function handleCriarSolicitacao(event) {
  event.preventDefault();

  try {
    if (!refs.solicitacaoItemId.value) {
      throw new Error('Selecione uma peca ou submontagem valida.');
    }

    const response = await fetch(solicitacoesApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_origem: 'EXPEDICAO',
        origem_atendimento: refs.solicitacaoOrigem.value,
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
    await carregarPedidosExpedicao();
  } catch (error) {
    refs.solicitacaoMensagem.textContent = error.message;
    refs.solicitacaoMensagem.className = 'message error';
    refs.solicitacaoMensagem.classList.remove('hidden');
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

function adicionarItemNaLista() {
  if (!refs.itemId.value) {
    mostrarMensagemSaida('Selecione um item valido da Expedicao.', 'error');
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(refs.itemId.value));
  if (!item) {
    mostrarMensagemSaida('Item nao encontrado para a saida.', 'error');
    return;
  }

  const quantidade = Number.parseInt(refs.quantidade.value, 10) || 0;
  if (quantidade <= 0) {
    mostrarMensagemSaida('A quantidade deve ser maior que zero.', 'error');
    return;
  }

  const disponivel = obterDisponibilidadeVenda(item);
  const existente = saidaLista.find((entry) => Number(entry.id_peca) === Number(item.id));
  const quantidadeTotal = quantidade + Number(existente ? existente.quantidade : 0);

  if (quantidadeTotal > disponivel) {
    mostrarMensagemSaida(`Disponivel insuficiente para ${item.codigo}.`, 'error');
    return;
  }

  if (existente) {
    existente.quantidade = quantidadeTotal;
  } else {
    saidaLista.push({
      id_peca: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade
    });
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

  try {
    const response = await fetch(saidaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: saidaLista.map((item) => ({
          id_peca: item.id_peca,
          quantidade: item.quantidade
        })),
        observacao: refs.observacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel registrar a saida.');
    }

    saidaLista = [];
    refs.observacao.value = '';
    renderizarLista();
    mostrarMensagemSaida('Saida registrada com sucesso.', 'success');
    await Promise.all([
      carregarEstoqueExpedicao(),
      carregarHistoricoSaidas()
    ]);
  } catch (error) {
    mostrarMensagemSaida(error.message, 'error');
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
      <td class="table-code">#${escapeHtml(item.id)}</td>
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

function renderizarLista() {
  document.getElementById('expedicao-lista-total').textContent = `${saidaLista.length} item(ns) na lista`;

  if (!saidaLista.length) {
    refs.listaTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum item na lista.</td></tr>';
    return;
  }

  refs.listaTbody.innerHTML = saidaLista.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td class="table-actions-cell">
        <button type="button" class="btn btn-neutral" data-remove-id="${item.id_peca}">Remover</button>
      </td>
    </tr>
  `).join('');
}

function renderizarPedidos() {
  document.getElementById('expedicao-pedidos-total').textContent = `${pedidosExpedicaoCache.length} registro(s) encontrado(s)`;

  if (!pedidosExpedicaoCache.length) {
    refs.pedidosTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum pedido da Expedicao encontrado.</td></tr>';
    return;
  }

  refs.pedidosTbody.innerHTML = pedidosExpedicaoCache.map((item) => `
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
    refs.estoqueTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum saldo na Expedicao.</td></tr>';
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
  return items.filter((item) => ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(String(item.status || '').toUpperCase())).length;
}

function setBadge(element, count) {
  if (!element) {
    return;
  }

  const safeCount = Number(count || 0);
  element.textContent = formatInteger(safeCount);
  element.classList.toggle('hidden', safeCount <= 0);
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

function calcularDisponibilidadeSubmontagem(item) {
  const componentes = estruturasSubmontagemCache.get(item.id) || [];
  const saldoPronto = obterSaldoExpedicao(item.id);

  if (!componentes.length) {
    return saldoPronto;
  }

  const capacidades = componentes.map((componente) => {
    const saldoComponente = obterSaldoExpedicao(componente.id_item_componente);
    return Math.floor(saldoComponente / Number(componente.quantidade || 1));
  });

  const capacidadeComponentes = capacidades.length ? Math.min(...capacidades) : 0;
  return saldoPronto + Math.max(0, capacidadeComponentes);
}

function obterDisponibilidadeVenda(item) {
  if (item.classificacao === 'SUBMONTAGEM') {
    return calcularDisponibilidadeSubmontagem(item);
  }

  return obterSaldoExpedicao(item.id);
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
  if (event.target.dataset.closeModal === 'expedicao-saida') fecharModalSaida();
  if (event.target.dataset.closeModal === 'expedicao-pedidos') fecharModalPedidos();
  if (event.target.dataset.closeModal === 'expedicao-historico') fecharModalHistorico();
  if (event.target.dataset.closeModal === 'expedicao-producao') fecharModalProducao();
  if (event.target.dataset.closeModal === 'expedicao-solicitacao') fecharModalSolicitacao();
  if (event.target.dataset.closeModal === 'expedicao-simulacao') fecharModalSimulacao();
  if (event.target.dataset.closeModal === 'expedicao-producao-solicitacao') fecharModalSolicitacaoProducao();
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

  if (!refs.historicoModal.classList.contains('hidden')) {
    fecharModalHistorico();
    return;
  }

  if (!refs.pedidosModal.classList.contains('hidden')) {
    fecharModalPedidos();
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
    refs.saidaModal,
    refs.pedidosModal,
    refs.historicoModal,
    refs.producaoModal,
    refs.solicitacaoModal,
    refs.simulacaoModal,
    refs.solicitacaoProducaoModal
  ].some((item) => !item.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
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
  if (normalized === 'EM_SEPARACAO') className += ' is-info';

  return `<span class="${className}">${escapeHtml(normalized || '-')}</span>`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
