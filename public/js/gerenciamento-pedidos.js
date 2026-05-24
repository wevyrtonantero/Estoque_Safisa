const pedidosApiBaseUrl = '/api/pedidos-expedicao';
const estoqueItensApiBaseUrl = '/api/estoque/itens';
const submontagemSeriaisApiBaseUrl = '/api/submontagem-seriais';
const AUTO_REFRESH_MS = 15000;

let itensCache = [];
let clientesCache = [];
let pedidosCache = [];
let resumoSeriaisDisponiveis = { total_disponivel: 0, modelos: [] };
let pedidoItensDraft = [];
let itemDraftSelecionado = null;
let pedidoSelecionadoId = null;
let pedidoItemSerialSelecionadoId = null;
let serialDisponiveisContexto = null;
let autoRefreshHandle = null;

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
  detalheResumo: document.getElementById('pedido-detalhe-resumo'),
  detalheItensTbody: document.getElementById('pedido-detalhe-itens-tbody'),
  detalheNf: document.getElementById('pedido-detalhe-nf'),
  detalhePesoTotal: document.getElementById('pedido-detalhe-peso-total'),
  detalheVolumes: document.getElementById('pedido-detalhe-volumes'),
  detalheEditar: document.getElementById('pedido-btn-editar'),
  detalheSalvarDadosFinais: document.getElementById('pedido-btn-salvar-dados-finais'),
  detalheMarcarColetado: document.getElementById('pedido-btn-marcar-coletado'),

  seriaisModal: document.getElementById('pedido-seriais-modal'),
  seriaisMensagem: document.getElementById('pedido-seriais-mensagem'),
  seriaisTitulo: document.getElementById('pedido-seriais-titulo'),
  seriaisSubtitulo: document.getElementById('pedido-seriais-subtitulo'),
  seriaisResumo: document.getElementById('pedido-seriais-resumo'),
  seriaisVinculados: document.getElementById('pedido-seriais-vinculados'),
  seriaisTbody: document.getElementById('pedido-seriais-tbody'),

  faltasModal: document.getElementById('pedido-faltas-modal'),
  faltasTitulo: document.getElementById('pedido-faltas-titulo'),
  faltasSubtitulo: document.getElementById('pedido-faltas-subtitulo'),
  faltasTbody: document.getElementById('pedido-faltas-tbody'),

  historicoModal: document.getElementById('pedido-historico-modal'),
  historicoFiltroCliente: document.getElementById('pedido-historico-filtro-cliente'),
  historicoFiltroTransportadora: document.getElementById('pedido-historico-filtro-transportadora'),
  historicoFiltroPedido: document.getElementById('pedido-historico-filtro-pedido'),

  relatorioModal: document.getElementById('pedido-relatorio-modal'),
  relatorioTitulo: document.getElementById('pedido-relatorio-titulo'),
  relatorioSubtitulo: document.getElementById('pedido-relatorio-subtitulo'),
  relatorioResumo: document.getElementById('pedido-relatorio-resumo'),
  relatorioImprimir: document.getElementById('pedido-btn-imprimir-relatorio'),
  relatorioMontagemTbody: document.getElementById('pedido-relatorio-montagem-tbody'),
  relatorioKitsTbody: document.getElementById('pedido-relatorio-kits-tbody'),
  relatorioItensTbody: document.getElementById('pedido-relatorio-itens-tbody')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  registrarSincronizacaoEntreAbas();

  try {
    await carregarTudo();
    await abrirPedidoViaQueryString();
    iniciarAtualizacaoAutomatica();
  } catch (error) {
    mostrarMensagem(error.message || 'Nao foi possivel carregar a tela de pedidos.', 'error');
  }
});

function bindEvents() {
  document.getElementById('pedidos-btn-novo').addEventListener('click', abrirModalCriacao);
  document.getElementById('pedidos-btn-atualizar').addEventListener('click', () => {
    carregarTudo().catch((error) => mostrarMensagem(error.message, 'error'));
  });
  document.getElementById('pedidos-btn-historico').addEventListener('click', abrirModalHistoricoPedidos);
  document.getElementById('pedidos-btn-relatorio-dia').addEventListener('click', () => abrirModalRelatorio('dia'));
  document.getElementById('pedidos-btn-relatorio-geral').addEventListener('click', () => abrirModalRelatorio('geral'));

  refs.filtroBusca.addEventListener('input', renderizarPedidos);

  refs.pedidosHojeLista.addEventListener('click', handleListaPedidosActions);
  refs.prioridadeLista.addEventListener('click', handleListaPedidosActions);
  refs.historicoTbody.addEventListener('click', handleHistoricoActions);
  refs.historicoFiltroCliente.addEventListener('input', () => renderizarHistoricoPedidos(obterHistoricoFiltrado()));
  refs.historicoFiltroTransportadora.addEventListener('input', () => renderizarHistoricoPedidos(obterHistoricoFiltrado()));
  refs.historicoFiltroPedido.addEventListener('input', () => renderizarHistoricoPedidos(obterHistoricoFiltrado()));
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
  refs.detalheEditar.addEventListener('click', abrirEdicaoPedidoSelecionado);
  refs.detalheSalvarDadosFinais.addEventListener('click', salvarDadosFinaisPedido);
  document.getElementById('pedido-btn-marcar-coletado').addEventListener('click', marcarPedidoColetado);
  refs.detalheItensTbody.addEventListener('click', handleDetalheItemActions);
  refs.detalheItensTbody.addEventListener('change', handleDetalheItemChanges);

  document.getElementById('btn-fechar-modal-pedido-seriais').addEventListener('click', fecharModalSeriais);
  document.getElementById('btn-cancelar-modal-pedido-seriais').addEventListener('click', fecharModalSeriais);
  document.getElementById('pedido-btn-vincular-seriais').addEventListener('click', vincularSeriaisSelecionados);
  refs.seriaisTbody.addEventListener('click', handleSeriaisModalClick);
  refs.seriaisTbody.addEventListener('change', handleSeriaisModalChange);
  refs.seriaisVinculados.addEventListener('click', handleSeriaisVinculadosActions);

  document.getElementById('btn-fechar-modal-pedido-faltas').addEventListener('click', fecharModalFaltas);
  document.getElementById('btn-fechar-modal-pedido-historico').addEventListener('click', fecharModalHistoricoPedidos);
  document.getElementById('btn-fechar-modal-pedido-relatorio').addEventListener('click', fecharModalRelatorio);
  refs.relatorioImprimir.addEventListener('click', imprimirRelatorioAtual);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) {
      esconderSugestoesItemPedido();
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

  return `
    <article
      class="pedido-prioridade-card ${pedido.pode_atender ? 'is-ready' : 'is-pending'}"
      data-id="${pedido.id}"
      data-lane="${lane}"
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
  renderizarHistoricoPedidos(obterHistoricoFiltrado());
}

function obterHistoricoFiltrado() {
  const filtroCliente = normalizarBusca(refs.historicoFiltroCliente?.value?.trim());
  const filtroTransportadora = normalizarBusca(refs.historicoFiltroTransportadora?.value?.trim());
  const filtroPedido = normalizarBusca(refs.historicoFiltroPedido?.value?.trim());

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

  openModal(refs.relatorioModal);
}

function fecharModalRelatorio() {
  closeModal(refs.relatorioModal);
}

function construirRelatorioOperacional(pedidos) {
  const montagemMap = new Map();
  const kitsMap = new Map();
  const itensMap = new Map();

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

          const targetMap = String(componente.codigo || '').toUpperCase().startsWith('KT-')
            ? kitsMap
            : itensMap;

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
    montagem: ordenarRelatorio(montagemMap),
    kits: ordenarRelatorio(kitsMap),
    itens: ordenarRelatorio(itensMap)
  };
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
  notificarAtualizacaoOperacional(['pedidos-expedicao']);
  mostrarMensagem(
    programadoHoje
      ? `Pedido ${pedido.codigo_pedido} adicionado em Sai hoje.`
      : `Pedido ${pedido.codigo_pedido} removido de Sai hoje.`,
    'success'
  );
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
  refs.criacaoSubtitulo.textContent = 'Atualize os dados do pedido. Se a montagem ja começou, a estrutura dos itens fica preservada.';
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
    ))
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

  refs.detalheResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(pedido.status)}</span>
    <span class="selected-tag">Itens: ${formatInteger(pedido.itens_concluidos || 0)}/${formatInteger(pedido.total_itens || 0)}</span>
    <span class="selected-tag">Massa total: ${formatDecimal(pedido.massa_total_kg || 0)} kg</span>
    <span class="selected-tag">${pedido.possui_nota_fiscal ? 'Com NF' : 'Sem NF'}</span>
    <span class="selected-tag">Seriais vinculados: ${formatInteger(contarSeriaisPedido(pedido))}</span>
  `;

  renderizarItensPedidoDetalhe(pedido);
  openModal(refs.detalheModal);
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
        <td class="table-code">${escapeHtml(item.codigo)}</td>
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
            <button class="icon-btn pedido-print-btn" type="button" title="Imprimir item" aria-label="Imprimir item">&#128424;</button>
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
    notificarAtualizacaoOperacional(['pedidos-expedicao']);
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
  refs.seriaisSubtitulo.textContent = `Modelo serial: ${result.item.modelo_serial_codigo} | Necessario: ${formatInteger(result.item.quantidade_seriais_necessarios || result.item.quantidade)} | Vinculados: ${formatInteger(result.vinculados.length)}`;
  refs.seriaisResumo.innerHTML = `
    <span class="selected-tag">Pedido: ${escapeHtml((obterPedidoSelecionado() || {}).codigo_pedido || '-')}</span>
    <span class="selected-tag">Item: ${escapeHtml(result.item.codigo)}</span>
    <span class="selected-tag">Serial: ${escapeHtml(result.item.modelo_serial_codigo || '-')}</span>
    <span class="selected-tag">Disponiveis: ${formatInteger(result.disponiveis.length)}</span>
  `;

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

async function marcarPedidoColetado() {
  const pedido = obterPedidoSelecionado();
  if (!pedido) {
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
    await abrirDetalhePedido(atualizado.id);
  } catch (error) {
    mostrarMensagemDetalhe(error.message, 'error');
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
    refs.faltasModal,
    refs.historicoModal,
    refs.relatorioModal
  ].some((item) => !item.classList.contains('hidden'));

  document.body.classList.toggle('has-modal', algumModalAberto);
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'pedido-criacao') fecharModalCriacao();
  if (event.target.dataset.closeModal === 'pedido-detalhe') fecharModalDetalhe();
  if (event.target.dataset.closeModal === 'pedido-seriais') fecharModalSeriais();
  if (event.target.dataset.closeModal === 'pedido-faltas') fecharModalFaltas();
  if (event.target.dataset.closeModal === 'pedido-historico') fecharModalHistoricoPedidos();
  if (event.target.dataset.closeModal === 'pedido-relatorio') fecharModalRelatorio();
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

  if (!refs.faltasModal.classList.contains('hidden')) {
    fecharModalFaltas();
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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isNumeroSerieModel(item) {
  const codigo = String(item?.codigo || '').toUpperCase();
  const descricao = String(item?.descricao || '').toUpperCase();
  if (['600', '550', '401RB', '401', '500', '450', '400', '350', '300', '250', '150', '100', '001'].includes(codigo)) {
    return true;
  }

  return ['VF', 'MC', 'AL', 'BR', 'SAF', 'CJ', 'MBF'].some((keyword) => codigo.includes(keyword))
    && descricao.includes('SERVO');
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

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
}

function formatarDataCurta(value) {
  if (!value) {
    return '-';
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
