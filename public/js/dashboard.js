const estoquesApiBaseUrl = '/api/estoques';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const estoqueMovimentacoesApiBaseUrl = '/api/estoque/movimentacoes';
const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';
const terceirizacaoApiBaseUrl = '/api/terceirizacao';
const estoqueMateriaPrimaApiBaseUrl = '/api/estoque-materias-primas';
const materiasPrimasAutocompleteApiBaseUrl = '/api/materias-primas-autocomplete';
const producaoApiBaseUrl = '/api/producao';
const AUTO_REFRESH_MS = 15000;

let estoquesCache = [];
let saldosAlmoxCache = [];
let solicitacoesCache = [];
let tratamentoCache = [];
let historicoCache = [];
let producaoCache = [];
let materiasPrimasCache = [];
let autoRefreshHandle = null;
const ACTIVE_REQUEST_STATUSES = ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'];
const CLOSED_REQUEST_STATUSES = ['ATENDIDA', 'CANCELADA'];

const refs = {
  mensagem: document.getElementById('almox-mensagem'),
  estoqueTbody: document.getElementById('almox-estoque-tbody'),
  estoqueTotal: document.getElementById('almox-estoque-total'),
  filtroCodigo: document.getElementById('almox-filtro-codigo'),
  filtroDescricao: document.getElementById('almox-filtro-descricao'),
  filtroClassificacao: document.getElementById('almox-filtro-classificacao'),
  filtroQuantidade: document.getElementById('almox-filtro-quantidade'),
  badgePedidos: document.getElementById('almox-badge-pedidos'),
  badgeTratamento: document.getElementById('almox-badge-tratamento'),
  badgeProducao: document.getElementById('almox-badge-producao'),
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
  refs.filtroClassificacao.addEventListener('change', renderizarEstoque);
  refs.filtroQuantidade.addEventListener('change', renderizarEstoque);
  document.getElementById('almox-btn-limpar-filtros').addEventListener('click', limparFiltrosEstoque);

  document.getElementById('almox-btn-pedidos').addEventListener('click', abrirModalPedidos);
  document.getElementById('almox-btn-tratamento').addEventListener('click', abrirModalTratamento);
  document.getElementById('almox-btn-mp').addEventListener('click', abrirModalMateriaPrima);
  document.getElementById('almox-btn-historico').addEventListener('click', abrirModalHistorico);
  document.getElementById('almox-btn-producao').addEventListener('click', abrirModalProducao);

  refs.pedidosFiltroQ.addEventListener('input', renderizarPedidos);
  refs.pedidosFiltroStatus.addEventListener('change', renderizarPedidos);
  refs.pedidosFiltroSituacao.addEventListener('change', renderizarPedidos);
  document.getElementById('almox-btn-limpar-pedidos').addEventListener('click', limparFiltrosPedidos);
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
}

async function carregarTudoInicial() {
  await carregarEstoques();
  await Promise.all([
    carregarEstoqueAlmox(),
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

  const response = await fetch(`${estoqueSaldosApiBaseUrl}?estoque=${almox.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o estoque do Almoxarifado.');
  }

  saldosAlmoxCache = result;
  renderizarEstoque();
  atualizarIndicadores();
}

async function carregarSolicitacoes() {
  const response = await fetch(`${solicitacoesApiBaseUrl}?origem_atendimento=ALMOXARIFADO`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as solicitacoes.');
  }

  solicitacoesCache = result;
  renderizarPedidos();
  atualizarIndicadores();
  atualizarBadgesMenu();
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

function renderizarEstoque() {
  const saldosFiltrados = obterSaldosFiltrados();
  refs.estoqueTotal.textContent = `${saldosFiltrados.length} registro(s) encontrado(s)`;

  if (!saldosAlmoxCache.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum saldo no Almoxarifado.</td></tr>';
    return;
  }

  if (!saldosFiltrados.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum item encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.estoqueTbody.innerHTML = saldosFiltrados.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.tipo)}</td>
      <td>${escapeHtml(item.classificacao)}</td>
      <td class="table-quantity">${renderizarQuantidadeEstoque(item)}</td>
      <td>${renderizarAlertaEstoque(item)}</td>
      <td>${escapeHtml(renderizarCoberturaConsumo(item))}</td>
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
              ? `<button type="button" class="row-menu-item" data-action="iniciar" data-id="${item.id}">Iniciar separacao</button>`
              : ''}
            ${['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(item.status)
              ? `<button type="button" class="row-menu-item" data-action="atender" data-id="${item.id}">Atender</button>`
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
    refs.tratamentoTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma peca aguardando retorno do tratamento externo.</td></tr>';
    return;
  }

  if (!registrosFiltrados.length) {
    refs.tratamentoTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma peca encontrada com os filtros informados.</td></tr>';
    return;
  }

  refs.tratamentoTbody.innerHTML = registrosFiltrados.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.nome_empresa || '-')}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente)}</td>
      <td>${escapeHtml(`Remessa #${item.id_remessa}`)}</td>
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
  document.getElementById('almox-card-alertas').textContent = String(
    saldosAlmoxCache.filter((item) => isItemEmAlerta(item)).length
  );
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
  const filtroClassificacao = refs.filtroClassificacao.value.trim().toUpperCase();
  const ordenacaoQuantidade = refs.filtroQuantidade.value;

  const registros = saldosAlmoxCache.filter((item) => {
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

async function abrirModalPedidos() {
  try {
    await carregarSolicitacoes();
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
  refs.atendimentoQuantidade.value = '1';
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
  refs.atendimentoResumo.textContent = 'Selecione uma solicitacao para atender.';
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
  refs.recebimentoQuantidade.value = '1';
  refs.recebimentoQuantidade.max = String(Math.max(1, Number(item.quantidade_pendente || 0)));
  refs.recebimentoObservacao.value = '';
  refs.recebimentoResumo.classList.remove('empty');
  refs.recebimentoResumo.classList.add('selected-tags');
  refs.recebimentoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Empresa: ${item.nome_empresa || '-'}`)}</span>
    <span class="selected-tag">${escapeHtml(`Pendente: ${formatInteger(item.quantidade_pendente)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Remessa #${item.id_remessa}`)}</span>
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
    executarAcaoPedido(`${solicitacoesApiBaseUrl}/${item.id}/iniciar-separacao`, 'Separacao iniciada com sucesso.');
    return;
  }

  if (button.dataset.action === 'atender') {
    abrirModalAtendimento(item);
  }
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
    mostrarMensagem('Solicitacao atendida com sucesso.', 'success');
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
    const response = await fetch(`${terceirizacaoApiBaseUrl}/retorno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_item: refs.recebimentoIdPeca.value,
        id_estoque_destino: refs.recebimentoDestino.value,
        quantidade_retorno: refs.recebimentoQuantidade.value,
        observacao: refs.recebimentoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalRecebimento();
    mostrarMensagem('Retorno da terceirizacao registrado com sucesso.', 'success');
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
  refs.recebimentoDestino.innerHTML = `
    <option value="">Selecione</option>
    ${estoquesCache.map((estoque) => `<option value="${estoque.id}">${escapeHtml(estoque.nome)}</option>`).join('')}
  `;
}

function limparFiltrosEstoque() {
  refs.filtroCodigo.value = '';
  refs.filtroDescricao.value = '';
  refs.filtroClassificacao.value = '';
  refs.filtroQuantidade.value = '';
  renderizarEstoque();
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

function getLimiteAlerta(item) {
  const estoqueSeguranca = Number(item.estoque_seguranca || 0);
  const estoqueMinimo = Number(item.estoque_minimo || 0);
  return estoqueSeguranca > 0 ? estoqueSeguranca : estoqueMinimo;
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

function renderizarStatus(status) {
  const normalized = String(status || '').toUpperCase();
  let cssClass = 'status-chip';

  if (normalized === 'ATENDIDA') cssClass += ' is-success';
  if (normalized === 'ATENDIDA_PARCIAL') cssClass += ' is-warning';
  if (normalized === 'PENDENTE') cssClass += ' is-danger';
  if (normalized === 'EM_SEPARACAO') cssClass += ' is-info';

  return `<span class="${cssClass}">${escapeHtml(normalized || '-')}</span>`;
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
    esconderSugestoesMateriaPrima();
  }
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  closeAllRowMenus();
  if (!refs.producaoModal.classList.contains('hidden')) fecharModalProducao();
  else if (!refs.historicoModal.classList.contains('hidden')) fecharModalHistorico();
  else if (!refs.mpModal.classList.contains('hidden')) fecharModalMateriaPrima();
  else if (!refs.recebimentoModal.classList.contains('hidden')) fecharModalRecebimento();
  else if (!refs.tratamentoModal.classList.contains('hidden')) fecharModalTratamento();
  else if (!refs.atendimentoModal.classList.contains('hidden')) fecharModalAtendimento();
  else if (!refs.pedidosModal.classList.contains('hidden')) fecharModalPedidos();
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
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
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
