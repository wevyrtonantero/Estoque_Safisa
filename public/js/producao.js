const producaoApiBaseUrl = '/api/producao';
const solicitacoesProducaoApiBaseUrl = '/api/solicitacoes-producao';
const maquinasApiBaseUrl = '/api/maquinas';
const pecasApiBaseUrl = '/api/pecas?tipo=PRODUZIDA';
const materiasPrimasAutocompleteApiBaseUrl = '/api/materias-primas-autocomplete';
const estoqueMateriaPrimaApiBaseUrl = '/api/estoque-materias-primas';
const estoquesApiBaseUrl = '/api/estoques';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const AUTO_REFRESH_MS = 15000;
const ACTIVE_PRODUCTION_REQUEST_STATUSES = ['PENDENTE', 'EM_ANALISE', 'EM_PRODUCAO'];
const CLOSED_PRODUCTION_REQUEST_STATUSES = ['CONCLUIDA', 'CANCELADA'];

let producoesCache = [];
let solicitacoesProducaoCache = [];
let maquinasCache = [];
let pecasCache = [];
let materiasPrimasCache = [];
let materiasPrimasSaldosCache = new Map();
let estoquesSetorCache = [];
let almoxStockId = null;
let estoqueConsultaDebounceTimer = null;
let filtroDebounceTimer = null;
let autoRefreshHandle = null;

const refs = {
  mensagem: document.getElementById('producao-mensagem'),
  modalMensagem: document.getElementById('producao-modal-mensagem'),
  finalizacaoMensagem: document.getElementById('finalizacao-mensagem'),
  tabela: document.getElementById('producao-tbody'),
  total: document.getElementById('total-producao'),
  solicitacoesTotal: document.getElementById('total-solicitacoes-producao'),
  solicitacoesTbody: document.getElementById('solicitacoes-producao-tbody'),
  metricSolicitacoesPendentes: document.getElementById('metric-solicitacoes-pendentes'),
  badgeSolicitacoes: document.getElementById('producao-badge-solicitacoes'),
  metricRuptura: document.getElementById('metric-producao-ruptura'),
  metricRupturaInfo: document.getElementById('metric-producao-ruptura-info'),
  filtroForm: document.getElementById('producao-filtro-form'),
  estoquesModal: document.getElementById('producao-estoques-modal'),
  estoquesTotal: document.getElementById('producao-estoques-total'),
  estoquesTbody: document.getElementById('producao-estoques-tbody'),
  estoquesFiltroForm: document.getElementById('producao-estoques-filtro-form'),
  estoquesSetor: document.getElementById('producao-estoques-setor'),
  estoquesCodigo: document.getElementById('producao-estoques-codigo'),
  estoquesDescricao: document.getElementById('producao-estoques-descricao'),
  estoquesClassificacao: document.getElementById('producao-estoques-classificacao'),
  estoquesOrdem: document.getElementById('producao-estoques-ordem'),
  solicitacoesModal: document.getElementById('producao-solicitacoes-modal'),
  modal: document.getElementById('producao-modal'),
  finalizacaoModal: document.getElementById('finalizacao-modal'),
  pecaBusca: document.getElementById('producao-peca-busca'),
  pecaId: document.getElementById('producao-peca-id'),
  pecaSugestoes: document.getElementById('producao-peca-sugestoes'),
  maquinaSelect: document.getElementById('producao-maquina'),
  materiaPrimaSelect: document.getElementById('producao-materia-prima'),
  comprimentoInicialInput: document.getElementById('producao-comprimento-corte-inicial'),
  materiaPrimaResumoWrapper: document.getElementById('producao-mp-resumo-wrapper'),
  materiaPrimaResumoTitulo: document.getElementById('producao-mp-resumo-titulo'),
  materiaPrimaResumoSubtitulo: document.getElementById('producao-mp-resumo-subtitulo'),
  materiaPrimaLigaChip: document.getElementById('producao-mp-liga-chip'),
  materiaPrimaGeometriaChip: document.getElementById('producao-mp-geometria-chip'),
  materiaPrimaBitolaChip: document.getElementById('producao-mp-bitola-chip'),
  materiaPrimaEstoqueChip: document.getElementById('producao-mp-estoque-chip'),
  materiaPrimaBarrasChip: document.getElementById('producao-mp-barras-chip'),
  materiaPrimaConsumoChip: document.getElementById('producao-mp-consumo-chip'),
  materiaPrimaAlerta: document.getElementById('producao-mp-alerta'),
  finalizacaoComprimentoWrapper: document.getElementById('finalizacao-comprimento-wrapper'),
  finalizacaoComprimentoInput: document.getElementById('finalizacao-comprimento-corte'),
  finalizacaoComprimentoHint: document.getElementById('finalizacao-comprimento-hint'),
  finalizacaoEspecificacaoChip: document.getElementById('finalizacao-especificacao-chip')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarMaquinas(), carregarPecas(), carregarMateriasPrimas(), carregarEstoquesSetor()]);
  await Promise.all([carregarProducoes(), carregarSolicitacoesProducao(), carregarProximaRuptura()]);
  iniciarAtualizacaoAutomatica();
});

function bindEvents() {
  document.getElementById('btn-nova-producao').addEventListener('click', abrirModalProducao);
  document.getElementById('btn-estoques-producao-menu').addEventListener('click', abrirModalConsultaEstoques);
  document.getElementById('btn-fechar-modal-producao-estoques').addEventListener('click', fecharModalConsultaEstoques);
  document.getElementById('btn-limpar-filtros-producao-estoques').addEventListener('click', limparFiltrosConsultaEstoques);
  document.getElementById('btn-solicitacoes-producao-menu').addEventListener('click', abrirModalSolicitacoesProducao);
  document.getElementById('btn-fechar-modal-producao-solicitacoes').addEventListener('click', fecharModalSolicitacoesProducao);
  document.getElementById('btn-cancelar-modal-producao').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-fechar-modal-producao').addEventListener('click', fecharModalProducao);
  document.getElementById('btn-cancelar-modal-finalizacao').addEventListener('click', fecharModalFinalizacao);
  document.getElementById('btn-fechar-modal-finalizacao').addEventListener('click', fecharModalFinalizacao);
  document.getElementById('btn-limpar-filtros-producao').addEventListener('click', limparFiltros);
  refs.estoquesModal.addEventListener('click', handleBackdrop);
  refs.solicitacoesModal.addEventListener('click', handleBackdrop);
  refs.modal.addEventListener('click', handleBackdrop);
  refs.finalizacaoModal.addEventListener('click', handleBackdrop);
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarProducoes();
  });
  refs.estoquesFiltroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarConsultaEstoques();
  });
  [refs.estoquesSetor, refs.estoquesCodigo, refs.estoquesDescricao, refs.estoquesClassificacao, refs.estoquesOrdem].forEach((field) => {
    field.addEventListener('input', agendarConsultaEstoques);
    field.addEventListener('change', agendarConsultaEstoques);
  });
  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
  document.getElementById('filtro-solicitacoes-producao-situacao').addEventListener('change', renderizarSolicitacoesProducao);
  document.getElementById('producao-form').addEventListener('submit', handleCriarProducao);
  document.getElementById('finalizacao-form').addEventListener('submit', handleFinalizarProducao);
  refs.tabela.addEventListener('click', handleTabelaActions);
  refs.solicitacoesTbody.addEventListener('click', handleSolicitacoesProducaoActions);
  refs.pecaBusca.addEventListener('input', () => {
    refs.pecaId.value = '';
    refs.materiaPrimaSelect.value = '';
    refs.comprimentoInicialInput.value = '';
    renderizarResumoMateriaPrimaSelecionada();
    renderizarSugestoesPeca(refs.pecaBusca.value.trim());
  });
  refs.pecaBusca.addEventListener('focus', () => renderizarSugestoesPeca(refs.pecaBusca.value.trim()));
  refs.pecaSugestoes.addEventListener('click', handleSugestaoPecaClick);
  refs.materiaPrimaSelect.addEventListener('change', handleMateriaPrimaOrdemChange);
  document.getElementById('producao-quantidade-planejada').addEventListener('input', handlePlanejamentoMateriaPrimaChange);
  refs.comprimentoInicialInput.addEventListener('input', handlePlanejamentoMateriaPrimaChange);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarEstoquesSetor() {
  const response = await fetch(estoquesApiBaseUrl);
  const estoques = await response.json();

  if (!response.ok) {
    throw new Error(estoques.message || 'Nao foi possivel carregar os estoques.');
  }

  estoquesSetorCache = estoques.filter((item) => {
    const nome = normalizarBusca(item.nome);
    return nome.includes('almox') || nome.includes('mont') || nome.includes('exped');
  });

  const almox = estoquesSetorCache.find((item) => normalizarBusca(item.nome).includes('almox'));
  almoxStockId = almox ? Number(almox.id) : null;

  refs.estoquesSetor.innerHTML = estoquesSetorCache
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}</option>`)
    .join('');

  if (almoxStockId) {
    refs.estoquesSetor.value = String(almoxStockId);
  }
}

async function carregarSolicitacoesProducao() {
  try {
    const response = await fetch(solicitacoesProducaoApiBaseUrl);
    const solicitacoes = await response.json();

    if (!response.ok) {
      throw new Error(solicitacoes.message || 'Nao foi possivel carregar as solicitacoes de producao.');
    }

    solicitacoesProducaoCache = solicitacoes;
    renderizarSolicitacoesProducao();
    atualizarIndicadores();
  } catch (error) {
    solicitacoesProducaoCache = [];
    renderizarSolicitacoesProducao();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

async function carregarMaquinas() {
  const response = await fetch(maquinasApiBaseUrl);
  const maquinas = await response.json();

  if (!response.ok) {
    throw new Error(maquinas.message || 'Nao foi possivel carregar as maquinas.');
  }

  maquinasCache = maquinas;
  refs.maquinaSelect.innerHTML = `
    <option value="">Selecione</option>
    ${maquinasCache.map((maquina) => `<option value="${maquina.id}">${escapeHtml(maquina.nome)}</option>`).join('')}
  `;
}

async function carregarPecas() {
  const response = await fetch(pecasApiBaseUrl);
  const pecas = await response.json();

  if (!response.ok) {
    throw new Error(pecas.message || 'Nao foi possivel carregar as pecas produzidas.');
  }

  pecasCache = pecas.filter((peca) => peca.tipo === 'PRODUZIDA' && peca.classificacao === 'ITEM');
}

async function carregarMateriasPrimas() {
  const response = await fetch(materiasPrimasAutocompleteApiBaseUrl);
  const materiasPrimas = await response.json();

  if (!response.ok) {
    throw new Error(materiasPrimas.message || 'Nao foi possivel carregar as materias-primas.');
  }

  materiasPrimasCache = Array.isArray(materiasPrimas) ? materiasPrimas : [];
  refs.materiaPrimaSelect.innerHTML = `
    <option value="">Selecione</option>
    ${materiasPrimasCache.map((item) => `<option value="${item.id}">${escapeHtml(`${item.codigo} - ${item.nome}`)}</option>`).join('')}
  `;
}

async function carregarProducoes() {
  const params = new URLSearchParams();
  const q = document.getElementById('filtro-producao-q').value.trim();
  const status = document.getElementById('filtro-producao-status').value;

  if (q) params.append('q', q);
  if (status) params.append('status', status);

  try {
    const endpoint = params.toString() ? `${producaoApiBaseUrl}?${params.toString()}` : producaoApiBaseUrl;
    const response = await fetch(endpoint);
    const producoes = await response.json();

    if (!response.ok) {
      throw new Error(producoes.message || 'Nao foi possivel carregar as ordens de producao.');
    }

    producoesCache = producoes;
    renderizarTabela();
    atualizarIndicadores();
  } catch (error) {
    producoesCache = [];
    renderizarTabela();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarTabela() {
  refs.total.textContent = `${producoesCache.length} registro(s) encontrado(s)`;

  if (producoesCache.length === 0) {
    refs.tabela.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhuma ordem de producao encontrada.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = producoesCache.map((producao) => `
    <tr>
      <td>${renderStatusBadge(producao.status)}</td>
      <td>${escapeHtml(producao.maquina_nome)}</td>
      <td class="table-description">${escapeHtml(`${producao.peca_codigo} - ${producao.peca_descricao}`)}</td>
      <td class="table-quantity">${formatInteger(producao.quantidade_planejada)}</td>
      <td class="table-quantity">${formatInteger(producao.quantidade_produzida || 0)}</td>
      <td class="table-quantity">${formatInteger(producao.quantidade_refugo || 0)}</td>
      <td>${renderMateriaPrimaCelula(producao)}</td>
      <td>${escapeHtml(formatarConsumo(producao))}</td>
      <td>${formatarData(producao.data_inicio)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            ${producao.status === 'EM_ANDAMENTO'
              ? `<button type="button" class="row-menu-item" data-action="finalizar" data-id="${producao.id}">Finalizar</button>`
              : '<span class="row-menu-item">Finalizada</span>'}
            <button type="button" class="row-menu-item danger" data-action="excluir" data-id="${producao.id}">Excluir producao</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function renderizarSolicitacoesProducao() {
  const solicitacoesFiltradas = obterSolicitacoesProducaoFiltradas();
  refs.solicitacoesTotal.textContent = `${solicitacoesFiltradas.length} registro(s) encontrado(s)`;

  if (!solicitacoesProducaoCache.length) {
    refs.solicitacoesTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma solicitacao para a Producao.</td></tr>';
    return;
  }

  if (!solicitacoesFiltradas.length) {
    refs.solicitacoesTbody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(obterMensagemTimelineSolicitacao(document.getElementById('filtro-solicitacoes-producao-situacao').value))}</td></tr>`;
    return;
  }

  refs.solicitacoesTbody.innerHTML = solicitacoesFiltradas.map((item) => `
    <tr>
      <td>${escapeHtml(item.origem_nome || '-')}</td>
      <td class="table-description">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_solicitada)}</td>
      <td>${renderSolicitacaoStatusBadge(item.status)}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
      <td>${formatarData(item.data_solicitacao)}</td>
      <td class="table-actions-cell">
        ${renderizarAcoesSolicitacaoProducao(item)}
      </td>
    </tr>
  `).join('');
}

function renderizarAcoesSolicitacaoProducao(item) {
  const status = String(item.status || '').toUpperCase();

  if (['CONCLUIDA', 'CANCELADA'].includes(status)) {
    return `<span class="status-chip ${status === 'CONCLUIDA' ? 'is-success' : 'is-danger'}">${escapeHtml(status)}</span>`;
  }

  const actions = [];

  if (status === 'PENDENTE') {
    actions.push('<button type="button" class="row-menu-item" data-req-action="EM_ANALISE" data-id="' + item.id + '">Em analise</button>');
  }

  if (['PENDENTE', 'EM_ANALISE'].includes(status)) {
    actions.push('<button type="button" class="row-menu-item" data-req-action="EM_PRODUCAO" data-id="' + item.id + '">Em producao</button>');
  }

  if (['EM_ANALISE', 'EM_PRODUCAO'].includes(status)) {
    actions.push('<button type="button" class="row-menu-item" data-req-action="CONCLUIDA" data-id="' + item.id + '">Concluir</button>');
  }

  actions.push('<button type="button" class="row-menu-item danger" data-req-action="CANCELADA" data-id="' + item.id + '">Cancelar</button>');

  return `
    <details class="row-menu">
      <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
      <div class="row-menu-panel">
        ${actions.join('')}
      </div>
    </details>
  `;
}

function atualizarIndicadores() {
  const emAndamento = producoesCache.filter((item) => item.status === 'EM_ANDAMENTO').length;
  const finalizadas = producoesCache.filter((item) => item.status === 'FINALIZADA').length;
  const solicitacoesPendentes = solicitacoesProducaoCache.filter((item) => ACTIVE_PRODUCTION_REQUEST_STATUSES.includes(String(item.status || '').toUpperCase())).length;

  document.getElementById('metric-producao-andamento').textContent = String(emAndamento);
  document.getElementById('metric-producao-finalizada').textContent = String(finalizadas);
  refs.metricSolicitacoesPendentes.textContent = String(solicitacoesPendentes);
  setBadge(refs.badgeSolicitacoes, solicitacoesPendentes);
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

function obterSolicitacoesProducaoFiltradas() {
  const filtro = document.getElementById('filtro-solicitacoes-producao-situacao').value;

  return solicitacoesProducaoCache.filter((item) => {
    const normalized = String(item.status || '').toUpperCase();

    if (filtro === 'encerradas') {
      return CLOSED_PRODUCTION_REQUEST_STATUSES.includes(normalized);
    }

    if (filtro === 'todas') {
      return true;
    }

    return ACTIVE_PRODUCTION_REQUEST_STATUSES.includes(normalized);
  });
}

function obterMensagemTimelineSolicitacao(filtro) {
  if (filtro === 'encerradas') {
    return 'Nenhuma solicitacao encerrada para a Producao.';
  }

  if (filtro === 'todas') {
    return 'Nenhuma solicitacao encontrada para a Producao.';
  }

  return 'Nenhuma solicitacao ativa para a Producao.';
}

async function atualizarPainelAutomaticamente() {
  try {
    await Promise.all([carregarProducoes(), carregarSolicitacoesProducao(), carregarProximaRuptura()]);
  } catch (error) {
    console.error('Falha ao atualizar a tela de Producao:', error);
  }
}

async function carregarProximaRuptura() {
  try {
    const stockId = await obterIdAlmoxarifado();
    if (!stockId) {
      atualizarCardRuptura(null);
      return;
    }

    const response = await fetch(`${estoqueSaldosApiBaseUrl}?estoque=${stockId}&ordem_quantidade=ASC`);
    const saldos = await response.json();

    if (!response.ok) {
      throw new Error(saldos.message || 'Nao foi possivel carregar o estoque do Almoxarifado.');
    }

    const itemCritico = obterItemRupturaMaisProxima(saldos);
    atualizarCardRuptura(itemCritico);
  } catch (error) {
    console.error('Falha ao calcular a proxima ruptura do Almoxarifado:', error);
    atualizarCardRuptura(null);
  }
}

async function obterIdAlmoxarifado() {
  if (almoxStockId) {
    return almoxStockId;
  }

  await carregarEstoquesSetor();
  return almoxStockId;
}

function obterItemRupturaMaisProxima(saldos) {
  const candidatos = (Array.isArray(saldos) ? saldos : [])
    .map((item) => {
      const quantidade = Number(item.quantidade || 0);
      const consumoMensal = Number(item.consumo_mensal || 0);

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return null;
      }

      if (!Number.isFinite(consumoMensal) || consumoMensal <= 0) {
        return null;
      }

      const dias = Math.floor((quantidade / consumoMensal) * 30);
      const data = new Date();
      data.setDate(data.getDate() + dias);

      return {
        codigo: item.codigo,
        descricao: item.descricao,
        dias,
        dataPrevista: data
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dias - b.dias || String(a.codigo).localeCompare(String(b.codigo)));

  return candidatos[0] || null;
}

function atualizarCardRuptura(item) {
  if (!item) {
    refs.metricRuptura.textContent = '-';
    refs.metricRupturaInfo.textContent = 'Sem dados de consumo no Almoxarifado.';
    return;
  }

  refs.metricRuptura.textContent = item.codigo;
  refs.metricRupturaInfo.textContent = `${item.descricao} | ${item.dias} dia(s) | ate ${formatarDataCurta(item.dataPrevista)}`;
}

function renderizarSugestoesPeca(termo) {
  const filtro = termo.toLowerCase();
  const itens = pecasCache.filter((peca) => {
    if (!filtro) {
      return true;
    }

    return `${peca.codigo} ${peca.descricao}`.toLowerCase().includes(filtro);
  }).slice(0, 8);

  if (itens.length === 0) {
    refs.pecaSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma peca produzida encontrada.</div>';
    refs.pecaSugestoes.classList.remove('hidden');
    return;
  }

  refs.pecaSugestoes.innerHTML = itens.map((peca) => `
    <button type="button" class="autocomplete-option" data-peca-id="${peca.id}" data-peca-label="${escapeHtml(`${peca.codigo} - ${peca.descricao}`)}">
      <strong>${escapeHtml(`${peca.codigo} - ${peca.descricao}`)}</strong>
      <span>${escapeHtml(peca.materia_prima_nome ? `Materia-prima: ${peca.materia_prima_codigo} - ${peca.materia_prima_nome}` : 'Sem materia-prima vinculada')}</span>
      <span>${escapeHtml(peca.comprimento_mm ? `Corte atual: ${formatDecimal(peca.comprimento_mm)} mm` : 'Corte atual: nao definido')}</span>
    </button>
  `).join('');
  refs.pecaSugestoes.classList.remove('hidden');
}

function handleSugestaoPecaClick(event) {
  const option = event.target.closest('button[data-peca-id]');
  if (!option) {
    return;
  }

  refs.pecaId.value = option.dataset.pecaId;
  refs.pecaBusca.value = option.dataset.pecaLabel;
  preencherConfiguracaoInicialPeca(option.dataset.pecaId);
  esconderSugestoes();
}

async function handleMateriaPrimaOrdemChange() {
  await renderizarResumoMateriaPrimaSelecionada(refs.materiaPrimaSelect.value);
}

async function handlePlanejamentoMateriaPrimaChange() {
  await renderizarResumoMateriaPrimaSelecionada(refs.materiaPrimaSelect.value);
}

async function handleCriarProducao(event) {
  event.preventDefault();

  try {
    const response = await fetch(producaoApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_maquina: refs.maquinaSelect.value,
        id_peca: refs.pecaId.value,
        id_materia_prima: refs.materiaPrimaSelect.value,
        comprimento_corte_mm: refs.comprimentoInicialInput.value.trim(),
        quantidade_planejada: document.getElementById('producao-quantidade-planejada').value,
        observacao_inicio: document.getElementById('producao-observacao-inicio').value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalProducao();
    mostrarMensagem('Ordem de producao iniciada com sucesso.', 'success');
    await Promise.all([carregarProducoes(), carregarSolicitacoesProducao()]);
  } catch (error) {
    mostrarMensagemModal(error.message, 'error');
  }
}

async function handleFinalizarProducao(event) {
  event.preventDefault();
  const id = document.getElementById('finalizacao-id').value;

  try {
    const response = await fetch(`${producaoApiBaseUrl}/${id}/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidade_produzida: document.getElementById('finalizacao-quantidade-produzida').value,
        quantidade_refugo: document.getElementById('finalizacao-quantidade-refugo').value,
        comprimento_corte_mm: refs.finalizacaoComprimentoInput.value.trim(),
        observacao_fim: document.getElementById('finalizacao-observacao').value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalFinalizacao();
    mostrarMensagem('Ordem de producao finalizada com sucesso.', 'success');
    await Promise.all([carregarProducoes(), carregarSolicitacoesProducao()]);
  } catch (error) {
    mostrarMensagemFinalizacao(error.message, 'error');
  }
}

function handleTabelaActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) {
    return;
  }

  const producao = producoesCache.find((item) => Number(item.id) === Number(actionButton.dataset.id));
  if (!producao) {
    return;
  }

  if (actionButton.dataset.action === 'finalizar') {
    abrirModalFinalizacao(producao);
    return;
  }

  if (actionButton.dataset.action === 'excluir') {
    excluirProducao(producao);
  }
}

function handleSolicitacoesProducaoActions(event) {
  const actionButton = event.target.closest('button[data-req-action]');
  if (!actionButton) {
    return;
  }

  const solicitacao = solicitacoesProducaoCache.find((item) => Number(item.id) === Number(actionButton.dataset.id));
  if (!solicitacao) {
    return;
  }

  atualizarStatusSolicitacaoProducao(solicitacao, actionButton.dataset.reqAction);
}

function abrirModalProducao() {
  resetFormProducao();
  openModal(refs.modal);
}

async function abrirModalConsultaEstoques() {
  openModal(refs.estoquesModal);
  await carregarConsultaEstoques();
}

function fecharModalConsultaEstoques() {
  closeModal(refs.estoquesModal);
}

function abrirModalSolicitacoesProducao() {
  openModal(refs.solicitacoesModal);
}

function fecharModalSolicitacoesProducao() {
  closeModal(refs.solicitacoesModal);
}

function fecharModalProducao() {
  resetFormProducao();
  closeModal(refs.modal);
}

function abrirModalFinalizacao(producao) {
  document.getElementById('finalizacao-id').value = producao.id;
  document.getElementById('finalizacao-titulo').textContent = `${producao.peca_codigo} - ${producao.peca_descricao}`;
  document.getElementById('finalizacao-subtitulo').textContent = `${producao.maquina_nome} | ${formatarMateriaPrimaTitulo(producao)}`;
  document.getElementById('finalizacao-planejada-chip').textContent = `Planejada: ${formatInteger(producao.quantidade_planejada)}`;
  document.getElementById('finalizacao-mp-chip').textContent = `Materia-prima: ${formatarMateriaPrimaTitulo(producao)}`;
  refs.finalizacaoEspecificacaoChip.textContent = `Especificacao: ${formatarResumoTecnicoMateriaPrima(producao)}`;
  document.getElementById('finalizacao-regra-chip').textContent = `Regra: ${producao.materia_prima_geometria === 'FUNDIDO' ? 'consumo unitario' : 'consumo por comprimento'}`;
  document.getElementById('finalizacao-quantidade-produzida').value = '0';
  document.getElementById('finalizacao-quantidade-refugo').value = '0';
  refs.finalizacaoComprimentoInput.value = producao.comprimento_corte_mm ? formatInputDecimal(producao.comprimento_corte_mm) : '';
  refs.finalizacaoComprimentoWrapper.classList.toggle(
    'hidden',
    String(producao.materia_prima_geometria || '').toUpperCase() === 'FUNDIDO'
  );
  document.getElementById('finalizacao-observacao').value = '';
  esconderMensagemFinalizacao();
  openModal(refs.finalizacaoModal);
}

function fecharModalFinalizacao() {
  document.getElementById('finalizacao-form').reset();
  document.getElementById('finalizacao-id').value = '';
  document.getElementById('finalizacao-titulo').textContent = 'Nenhuma ordem selecionada';
  document.getElementById('finalizacao-subtitulo').textContent = 'Selecione uma ordem em andamento na tabela.';
  document.getElementById('finalizacao-planejada-chip').textContent = 'Planejada: 0';
  document.getElementById('finalizacao-mp-chip').textContent = 'Materia-prima: -';
  refs.finalizacaoEspecificacaoChip.textContent = 'Especificacao: -';
  document.getElementById('finalizacao-regra-chip').textContent = 'Regra: aguardando';
  refs.finalizacaoComprimentoInput.value = '';
  refs.finalizacaoComprimentoWrapper.classList.remove('hidden');
  esconderMensagemFinalizacao();
  closeModal(refs.finalizacaoModal);
}

function resetFormProducao() {
  document.getElementById('producao-form').reset();
  refs.pecaId.value = '';
  refs.pecaBusca.value = '';
  document.getElementById('producao-quantidade-planejada').value = '1';
  refs.materiaPrimaSelect.value = '';
  refs.comprimentoInicialInput.value = '';
  materiasPrimasSaldosCache = new Map();
  renderizarResumoMateriaPrimaSelecionada();
  esconderSugestoes();
  esconderMensagemModal();
}

function preencherConfiguracaoInicialPeca(pecaId) {
  const peca = pecasCache.find((item) => Number(item.id) === Number(pecaId));
  if (!peca) {
    refs.materiaPrimaSelect.value = '';
    refs.comprimentoInicialInput.value = '';
    return;
  }

  refs.materiaPrimaSelect.value = peca.id_materia_prima ? String(peca.id_materia_prima) : '';
  refs.comprimentoInicialInput.value = peca.comprimento_mm ? formatInputDecimal(peca.comprimento_mm) : '';
  renderizarResumoMateriaPrimaSelecionada(refs.materiaPrimaSelect.value);
}

async function carregarSaldoMateriaPrimaSelecionada(materiaPrimaId) {
  const numericId = Number(materiaPrimaId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  if (materiasPrimasSaldosCache.has(numericId)) {
    return materiasPrimasSaldosCache.get(numericId);
  }

  const response = await fetch(`${estoqueMateriaPrimaApiBaseUrl}/saldos/${numericId}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o saldo da materia-prima.');
  }

  materiasPrimasSaldosCache.set(numericId, result);
  return result;
}

async function renderizarResumoMateriaPrimaSelecionada(materiaPrimaId = refs.materiaPrimaSelect.value) {
  const materiaPrima = materiasPrimasCache.find((item) => Number(item.id) === Number(materiaPrimaId));

  if (!materiaPrima) {
    refs.materiaPrimaResumoWrapper.classList.add('hidden');
    refs.materiaPrimaResumoTitulo.textContent = 'Nenhuma materia-prima selecionada';
    refs.materiaPrimaResumoSubtitulo.textContent = 'Selecione uma materia-prima para ver a especificacao tecnica usada nesta ordem.';
    refs.materiaPrimaLigaChip.textContent = 'Liga: -';
    refs.materiaPrimaGeometriaChip.textContent = 'Geometria: -';
    refs.materiaPrimaBitolaChip.textContent = 'Bitola: -';
    refs.materiaPrimaEstoqueChip.textContent = 'Saldo: -';
    refs.materiaPrimaBarrasChip.textContent = 'Barras: -';
    refs.materiaPrimaConsumoChip.textContent = 'Consumo previsto: -';
    setPlanejamentoMateriaPrimaAlert('', '');
    return;
  }

  try {
    const saldo = await carregarSaldoMateriaPrimaSelecionada(materiaPrima.id);
    const quantidadePlanejada = Number.parseInt(document.getElementById('producao-quantidade-planejada').value || '0', 10) || 0;
    const comprimentoCorteMm = Number.parseFloat(String(refs.comprimentoInicialInput.value || '').replace(',', '.')) || 0;
    const comprimentoPadraoMm = Number(saldo?.comprimento_padrao_mm || materiaPrima.comprimento_padrao_mm || 3000);
    const pesoPorBarraKg = Number(materiaPrima.peso_por_metro || saldo?.peso_por_metro || 0) * (comprimentoPadraoMm / 1000);
    const saldoQuantidade = Number(saldo?.quantidade || 0);
    const barrasEquivalentes = pesoPorBarraKg > 0 ? saldoQuantidade / pesoPorBarraKg : null;
    const consumoPrevisto = calcularConsumoPrevistoMateriaPrima(materiaPrima, quantidadePlanejada, comprimentoCorteMm, comprimentoPadraoMm);

    refs.materiaPrimaResumoWrapper.classList.remove('hidden');
    refs.materiaPrimaResumoTitulo.textContent = formatarMateriaPrimaTitulo(materiaPrima);
    refs.materiaPrimaResumoSubtitulo.textContent = materiaPrima.material || 'Sem descricao tecnica cadastrada.';
    refs.materiaPrimaLigaChip.textContent = `Liga: ${materiaPrima.liga || '-'}`;
    refs.materiaPrimaGeometriaChip.textContent = `Geometria: ${materiaPrima.geometria || '-'}`;
    refs.materiaPrimaBitolaChip.textContent = `Bitola: ${formatarBitolaMateriaPrima(materiaPrima)}`;
    refs.materiaPrimaEstoqueChip.textContent = `Saldo: ${formatarSaldoMateriaPrimaPlanejamento(materiaPrima, saldoQuantidade)}`;
    refs.materiaPrimaBarrasChip.textContent = `Barras: ${formatarEquivalenciaBarras(barrasEquivalentes, comprimentoPadraoMm, materiaPrima)}`;
    refs.materiaPrimaConsumoChip.textContent = `Consumo previsto: ${formatarConsumoPrevistoPlanejamento(consumoPrevisto)}`;

    const alertaPlanejamento = construirAlertaPlanejamentoMateriaPrima({
      materiaPrima,
      saldoQuantidade,
      consumoPrevisto,
      barrasEquivalentes
    });

    setPlanejamentoMateriaPrimaAlert(alertaPlanejamento.message, alertaPlanejamento.tone);
  } catch (error) {
    refs.materiaPrimaResumoWrapper.classList.remove('hidden');
    refs.materiaPrimaResumoTitulo.textContent = formatarMateriaPrimaTitulo(materiaPrima);
    refs.materiaPrimaResumoSubtitulo.textContent = materiaPrima.material || 'Sem descricao tecnica cadastrada.';
    refs.materiaPrimaLigaChip.textContent = `Liga: ${materiaPrima.liga || '-'}`;
    refs.materiaPrimaGeometriaChip.textContent = `Geometria: ${materiaPrima.geometria || '-'}`;
    refs.materiaPrimaBitolaChip.textContent = `Bitola: ${formatarBitolaMateriaPrima(materiaPrima)}`;
    refs.materiaPrimaEstoqueChip.textContent = 'Saldo: indisponivel';
    refs.materiaPrimaBarrasChip.textContent = 'Barras: indisponivel';
    refs.materiaPrimaConsumoChip.textContent = 'Consumo previsto: -';
    setPlanejamentoMateriaPrimaAlert(error.message, 'warning');
  }
}

function limparFiltros() {
  refs.filtroForm.reset();
  carregarProducoes();
}

function limparFiltrosConsultaEstoques() {
  refs.estoquesCodigo.value = '';
  refs.estoquesDescricao.value = '';
  refs.estoquesClassificacao.value = '';
  refs.estoquesOrdem.value = '';
  if (almoxStockId) {
    refs.estoquesSetor.value = String(almoxStockId);
  }
  carregarConsultaEstoques();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarProducoes(), 220);
}

function agendarConsultaEstoques() {
  window.clearTimeout(estoqueConsultaDebounceTimer);
  estoqueConsultaDebounceTimer = window.setTimeout(() => carregarConsultaEstoques(), 220);
}

async function carregarConsultaEstoques() {
  if (!refs.estoquesSetor.value) {
    refs.estoquesTotal.textContent = '0 registro(s) encontrado(s)';
    refs.estoquesTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Selecione um estoque para consultar.</td></tr>';
    return;
  }

  const params = new URLSearchParams({ estoque: refs.estoquesSetor.value });

  if (refs.estoquesCodigo.value.trim()) {
    params.append('codigo', refs.estoquesCodigo.value.trim());
  }

  if (refs.estoquesDescricao.value.trim()) {
    params.append('descricao', refs.estoquesDescricao.value.trim());
  }

  if (refs.estoquesClassificacao.value) {
    params.append('classificacao', refs.estoquesClassificacao.value);
  }

  if (refs.estoquesOrdem.value) {
    params.append('ordem_quantidade', refs.estoquesOrdem.value);
  }

  try {
    const response = await fetch(`${estoqueSaldosApiBaseUrl}?${params.toString()}`);
    const saldos = await response.json();

    if (!response.ok) {
      throw new Error(saldos.message || 'Nao foi possivel carregar o estoque selecionado.');
    }

    refs.estoquesTotal.textContent = `${saldos.length} registro(s) encontrado(s)`;

    if (!saldos.length) {
      refs.estoquesTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum saldo encontrado para os filtros informados.</td></tr>';
      return;
    }

    refs.estoquesTbody.innerHTML = saldos.map((item) => `
      <tr>
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(item.descricao)}</td>
        <td>${escapeHtml(item.tipo)}</td>
        <td>${escapeHtml(item.classificacao)}</td>
        <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      </tr>
    `).join('');
  } catch (error) {
    refs.estoquesTotal.textContent = '0 registro(s) encontrado(s)';
    refs.estoquesTbody.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

function handleGlobalClick(event) {
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
  }

  if (!event.target.closest('.autocomplete')) {
    esconderSugestoes();
  }

  if (!event.target.closest('.row-menu')) {
    closeAllRowMenus();
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

function esconderSugestoes() {
  refs.pecaSugestoes.classList.add('hidden');
  refs.pecaSugestoes.innerHTML = '';
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'producao-estoques') {
    fecharModalConsultaEstoques();
  }

  if (event.target.dataset.closeModal === 'producao-solicitacoes') {
    fecharModalSolicitacoesProducao();
  }

  if (event.target.dataset.closeModal === 'producao') {
    fecharModalProducao();
  }

  if (event.target.dataset.closeModal === 'finalizacao') {
    fecharModalFinalizacao();
  }
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  esconderSugestoes();
  closeAllRowMenus();

  if (!refs.estoquesModal.classList.contains('hidden')) {
    fecharModalConsultaEstoques();
    return;
  }

  if (!refs.solicitacoesModal.classList.contains('hidden')) {
    fecharModalSolicitacoesProducao();
    return;
  }

  if (!refs.finalizacaoModal.classList.contains('hidden')) {
    fecharModalFinalizacao();
    return;
  }

  if (!refs.modal.classList.contains('hidden')) {
    fecharModalProducao();
    return;
  }
}

async function excluirProducao(producao) {
  const confirmed = window.confirm(
    `Excluir a ordem ${producao.id} de ${producao.peca_codigo} - ${producao.peca_descricao}?`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${producaoApiBaseUrl}/${producao.id}`, {
      method: 'DELETE'
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    mostrarMensagem('Ordem de producao excluida com sucesso.', 'success');
    await Promise.all([carregarProducoes(), carregarSolicitacoesProducao()]);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

async function atualizarStatusSolicitacaoProducao(solicitacao, status) {
  try {
    const response = await fetch(`${solicitacoesProducaoApiBaseUrl}/${solicitacao.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        observacao: solicitacao.observacao || null
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    mostrarMensagem(`Solicitacao ${solicitacao.codigo} atualizada para ${status}.`, 'success');
    await carregarSolicitacoesProducao();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
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
  const hasModal = [refs.estoquesModal, refs.solicitacoesModal, refs.modal, refs.finalizacaoModal].some((item) => !item.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

function setBadge(element, count) {
  if (!element) {
    return;
  }

  const safeCount = Math.max(0, Number(count || 0));
  element.textContent = String(safeCount);
  element.classList.toggle('hidden', safeCount <= 0);
}

function normalizarBusca(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemModal(texto, tipo) {
  refs.modalMensagem.textContent = texto;
  refs.modalMensagem.className = `message ${tipo}`;
  refs.modalMensagem.classList.remove('hidden');
}

function esconderMensagemModal() {
  refs.modalMensagem.className = 'message hidden';
  refs.modalMensagem.textContent = '';
}

function mostrarMensagemFinalizacao(texto, tipo) {
  refs.finalizacaoMensagem.textContent = texto;
  refs.finalizacaoMensagem.className = `message ${tipo}`;
  refs.finalizacaoMensagem.classList.remove('hidden');
}

function esconderMensagemFinalizacao() {
  refs.finalizacaoMensagem.className = 'message hidden';
  refs.finalizacaoMensagem.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function renderStatusBadge(status) {
  const normalized = String(status || '').toUpperCase();
  let cssClass = 'status-chip';

  if (normalized === 'FINALIZADA') {
    cssClass += ' is-success';
  } else if (normalized === 'EM_ANDAMENTO') {
    cssClass += ' is-warning';
  } else if (normalized === 'CANCELADA') {
    cssClass += ' is-danger';
  }

  return `<span class="${cssClass}">${escapeHtml(status || '-')}</span>`;
}

function renderSolicitacaoStatusBadge(status) {
  const normalized = String(status || '').toUpperCase();
  let cssClass = 'status-chip';

  if (normalized === 'CONCLUIDA') {
    cssClass += ' is-success';
  } else if (normalized === 'EM_PRODUCAO') {
    cssClass += ' is-info';
  } else if (normalized === 'EM_ANALISE') {
    cssClass += ' is-warning';
  } else if (normalized === 'CANCELADA') {
    cssClass += ' is-danger';
  } else if (normalized === 'PENDENTE') {
    cssClass += ' is-danger';
  }

  return `<span class="${cssClass}">${escapeHtml(normalized || '-')}</span>`;
}

function renderMateriaPrimaCelula(producao) {
  const titulo = formatarMateriaPrimaTitulo(producao);
  const resumoTecnico = formatarResumoTecnicoMateriaPrima(producao);

  return `
    <div class="table-stack">
      <strong class="table-primary-line">${escapeHtml(titulo)}</strong>
      <span class="table-secondary-line">${escapeHtml(resumoTecnico)}</span>
    </div>
  `;
}

function formatarMateriaPrimaTitulo(item) {
  const codigo = item.materia_prima_codigo || item.codigo || '';
  const nome = item.materia_prima_nome || item.nome || '';

  if (codigo && nome) {
    return `${codigo} - ${nome}`;
  }

  if (codigo) {
    return codigo;
  }

  if (nome) {
    return nome;
  }

  return 'Sem materia-prima';
}

function formatarResumoTecnicoMateriaPrima(item) {
  const liga = item.materia_prima_liga || item.liga || '';
  const geometria = item.materia_prima_geometria || item.geometria || '';
  const bitola = formatarBitolaMateriaPrima(item);
  const partes = [liga, geometria, bitola].filter((parte) => parte && parte !== '-');

  return partes.length ? partes.join(' | ') : '-';
}

function formatarBitolaMateriaPrima(item) {
  const bitola = item.materia_prima_bitola || item.bitola || '';
  const bitolaMmRaw = item.materia_prima_bitola_mm ?? item.bitola_mm ?? null;
  const bitolaMm = Number(bitolaMmRaw);

  if (bitola && Number.isFinite(bitolaMm) && bitolaMm > 0) {
    return `${bitola} | ${formatDecimal(bitolaMm)} mm`;
  }

  if (bitola) {
    return bitola;
  }

  if (Number.isFinite(bitolaMm) && bitolaMm > 0) {
    return `${formatDecimal(bitolaMm)} mm`;
  }

  return '-';
}

function calcularConsumoPrevistoMateriaPrima(materiaPrima, quantidadePlanejada, comprimentoCorteMm, comprimentoPadraoMm = 3000) {
  const categoria = String(materiaPrima.categoria || '').toUpperCase();

  if (!Number.isFinite(quantidadePlanejada) || quantidadePlanejada <= 0) {
    return null;
  }

  if (categoria === 'FUNDIDO') {
    return {
      quantidade: quantidadePlanejada,
      unidade: 'UN',
      barras: null,
      comprimentoBarraM: null,
      pesoKg: Number.isFinite(Number(materiaPrima.peso_unitario_kg))
        ? Number((quantidadePlanejada * Number(materiaPrima.peso_unitario_kg)).toFixed(4))
        : null
    };
  }

  const pesoPorMetro = Number(materiaPrima.peso_por_metro || 0);
  if (!Number.isFinite(comprimentoCorteMm) || comprimentoCorteMm <= 0 || pesoPorMetro <= 0) {
    return null;
  }

  const metros = Number((((quantidadePlanejada * comprimentoCorteMm) / 1000)).toFixed(4));
  const pesoKg = Number((metros * pesoPorMetro).toFixed(4));
  const comprimentoBarraM = Number(comprimentoPadraoMm || 3000) / 1000;
  const barras = comprimentoBarraM > 0 ? Number((metros / comprimentoBarraM).toFixed(4)) : null;

  return {
    quantidade: metros,
    unidade: 'M',
    barras,
    comprimentoBarraM,
    pesoKg
  };
}

function formatarSaldoMateriaPrimaPlanejamento(materiaPrima, quantidade) {
  const unidade = String(materiaPrima.unidade_estoque || '').toUpperCase() || 'UN';
  return `${formatDecimal(quantidade)} ${unidade}`;
}

function formatarEquivalenciaBarras(barrasEquivalentes, comprimentoPadraoMm, materiaPrima) {
  if (String(materiaPrima.categoria || '').toUpperCase() === 'FUNDIDO') {
    return 'nao se aplica';
  }

  if (!Number.isFinite(barrasEquivalentes)) {
    return 'nao calculada';
  }

  const comprimentoMetros = Number(comprimentoPadraoMm || 3000) / 1000;
  return `${formatDecimal(barrasEquivalentes)} barra(s) de ${formatDecimal(comprimentoMetros)} m`;
}

function formatarConsumoPrevistoPlanejamento(consumoPrevisto) {
  if (!consumoPrevisto) {
    return 'preencha quantidade e corte';
  }

  if (consumoPrevisto.unidade === 'UN') {
    if (Number.isFinite(consumoPrevisto.pesoKg)) {
      return `${formatInteger(consumoPrevisto.quantidade)} UN | ${formatDecimal(consumoPrevisto.pesoKg)} kg`;
    }

    return `${formatInteger(consumoPrevisto.quantidade)} UN`;
  }

  const partes = [
    `${formatDecimal(consumoPrevisto.quantidade)} m`,
    `${formatDecimal(consumoPrevisto.pesoKg || 0)} kg`
  ];

  if (Number.isFinite(consumoPrevisto.barras)) {
    partes.push(`${formatDecimal(consumoPrevisto.barras)} barra(s)`);
  }

  return partes.join(' | ');
}

function construirAlertaPlanejamentoMateriaPrima({ materiaPrima, saldoQuantidade, consumoPrevisto, barrasEquivalentes }) {
  if (!consumoPrevisto) {
    if (String(materiaPrima.categoria || '').toUpperCase() === 'FUNDIDO') {
      return {
        message: 'Planejamento em modo de acompanhamento. A finalizacao nao sera bloqueada por falta de saldo.',
        tone: 'info'
      };
    }

    return {
      message: 'ATENCAO: defina o comprimento de corte para ver a previsao de consumo desta ordem. A finalizacao nao sera bloqueada por falta de saldo.',
      tone: 'warning'
    };
  }

  const saldoComparavel = String(materiaPrima.categoria || '').toUpperCase() === 'FUNDIDO'
    ? saldoQuantidade
    : saldoQuantidade;
  const consumoComparavel = String(materiaPrima.categoria || '').toUpperCase() === 'FUNDIDO'
    ? Number(consumoPrevisto.quantidade || 0)
    : Number(consumoPrevisto.pesoKg || 0);

  if (consumoComparavel > saldoComparavel) {
    return {
      message: 'ATENCAO: a previsao desta ordem consome mais do que o saldo atual. O sistema vai permitir finalizar mesmo assim e o estoque da MP podera ficar negativo ate a reposicao.',
      tone: 'warning'
    };
  }

  if (Number.isFinite(barrasEquivalentes) && barrasEquivalentes < 1) {
    return {
      message: 'ATENCAO: o saldo atual nao fecha uma barra padrao completa. Revise o planejamento desta ordem.',
      tone: 'warning'
    };
  }

  return {
    message: 'Saldo suficiente para a previsao desta ordem no planejamento atual.',
    tone: 'success'
  };
}

function setPlanejamentoMateriaPrimaAlert(message, tone = '') {
  refs.materiaPrimaAlerta.textContent = message || '';
  refs.materiaPrimaAlerta.classList.toggle('hidden', !message);
  refs.materiaPrimaAlerta.classList.remove('is-warning', 'is-success', 'is-info');

  if (message && tone) {
    refs.materiaPrimaAlerta.classList.add(`is-${tone}`);
  }
}

function formatInteger(value) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDecimal(value) {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatInputDecimal(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }

  return String(Number(numeric.toFixed(2)));
}

function formatarDataCurta(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleDateString('pt-BR');
}

function formatarConsumo(producao) {
  if (!producao.quantidade_consumida_materia_prima || !producao.unidade_consumo) {
    return '-';
  }

  return `${Number(producao.quantidade_consumida_materia_prima).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  })} ${producao.unidade_consumo}`;
}

function formatarData(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
