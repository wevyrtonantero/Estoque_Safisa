const painelApiBaseUrl = '/api/painel/resumo';
const estoqueApiBaseUrl = '/api/estoque/saldos';
const estoquePrioridadesApiBaseUrl = '/api/estoque/prioridades';
const estoqueMateriaPrimaApiBaseUrl = '/api/estoque-materias-primas/saldos';
const submontagensApiBaseUrl = '/api/submontagens';
const fornecedoresApiBaseUrl = '/api/fornecedores';
const AUTO_REFRESH_MS = 15000;

let painelCache = null;
let estoquesDetalhadosCache = [];
let estoquesPrioridadesCache = [];
let alertasAlmoxCache = [];
let materiasPrimasCache = [];
let submontagensCache = [];
let fornecedoresCache = [];
let autoRefreshHandle = null;

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
  indicadorRefugoHoje: document.getElementById('dashboard-indicador-refugo-hoje')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();

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

function bindEvents() {
  document.getElementById('btn-dashboard-estoques').addEventListener('click', () => openModal(refs.estoquesModal));
  document.getElementById('btn-dashboard-mp').addEventListener('click', () => openModal(refs.mpModal));
  document.getElementById('btn-dashboard-fornecedores').addEventListener('click', abrirModalFornecedores);
  document.getElementById('btn-dashboard-simulacao').addEventListener('click', () => openModal(refs.simulacaoModal));
  document.getElementById('btn-dashboard-indicadores').addEventListener('click', () => openModal(refs.indicadoresModal));

  document.getElementById('btn-fechar-modal-dashboard-estoques').addEventListener('click', () => closeModal(refs.estoquesModal));
  document.getElementById('btn-fechar-modal-dashboard-mp').addEventListener('click', () => closeModal(refs.mpModal));
  document.getElementById('btn-fechar-modal-dashboard-fornecedores').addEventListener('click', fecharModalFornecedores);
  document.getElementById('btn-fechar-modal-dashboard-simulacao').addEventListener('click', () => closeModal(refs.simulacaoModal));
  document.getElementById('btn-fechar-modal-dashboard-indicadores').addEventListener('click', () => closeModal(refs.indicadoresModal));
  document.getElementById('btn-limpar-modal-dashboard-estoques').addEventListener('click', limparFiltrosEstoque);
  document.getElementById('btn-limpar-modal-dashboard-mp').addEventListener('click', limparFiltrosMp);
  document.getElementById('btn-limpar-modal-dashboard-fornecedores').addEventListener('click', limparFiltrosFornecedores);

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

  refs.simulacaoForm.addEventListener('submit', handleSimulacaoSubmit);
  refs.simulacaoSubmontagemBusca.addEventListener('input', () => {
    refs.simulacaoSubmontagemId.value = '';
    renderizarSugestoesSubmontagem(refs.simulacaoSubmontagemBusca.value.trim());
  });
  refs.simulacaoSubmontagemBusca.addEventListener('focus', () => renderizarSugestoesSubmontagem(refs.simulacaoSubmontagemBusca.value.trim()));
  refs.simulacaoSugestoes.addEventListener('click', handleSugestaoSubmontagemClick);

  [refs.estoquesModal, refs.mpModal, refs.fornecedoresModal, refs.simulacaoModal, refs.indicadoresModal].forEach((modal) => {
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
  }).slice(0, 8);

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
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  if (!refs.indicadoresModal.classList.contains('hidden')) {
    closeModal(refs.indicadoresModal);
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
  const hasModal = [refs.estoquesModal, refs.mpModal, refs.fornecedoresModal, refs.simulacaoModal, refs.indicadoresModal]
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

  return `${formatDecimal(dias)}d | ${dataPrevista}`;
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
