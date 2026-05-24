const consultaEstoquesApiBaseUrl = '/api/consulta-estoques/resumo';
const AUTO_REFRESH_MS = 60000;
const ESCOPOS = Object.freeze({
  GLOBAL: 'global',
  DIA: 'dia'
});

let consultaCache = [];
let autoRefreshHandle = null;
let filtroDebounceTimer = null;
let escopoAtual = ESCOPOS.GLOBAL;

const refs = {
  mensagem: document.getElementById('consulta-estoques-mensagem'),
  tbody: document.getElementById('consulta-estoques-tbody'),
  total: document.getElementById('consulta-estoques-total'),
  filtroForm: document.getElementById('consulta-estoques-filtro-form'),
  filtroCodigo: document.getElementById('consulta-filtro-codigo'),
  filtroDescricao: document.getElementById('consulta-filtro-descricao'),
  filtroFornecedor: document.getElementById('consulta-filtro-fornecedor'),
  filtroDuracao: document.getElementById('consulta-filtro-duracao'),
  cardItens: document.getElementById('consulta-card-itens'),
  cardSaldo: document.getElementById('consulta-card-saldo'),
  cardAlerta: document.getElementById('consulta-card-alerta'),
  cardSemConsumo: document.getElementById('consulta-card-sem-consumo'),
  btnGlobal: document.getElementById('consulta-btn-global'),
  btnDia: document.getElementById('consulta-btn-dia'),
  pageTitle: document.getElementById('consulta-page-title'),
  pageSubtitle: document.getElementById('consulta-page-subtitle')
};

document.addEventListener('DOMContentLoaded', async () => {
  escopoAtual = obterEscopoDaUrl();
  bindEvents();
  atualizarCabecalhoEscopo();
  atualizarEstadoBotoesEscopo();
  registrarSincronizacaoEntreAbas();
  await carregarConsulta();
  iniciarAtualizacaoAutomatica();
});

function bindEvents() {
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarConsulta();
  });

  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    const eventName = field.tagName === 'SELECT' || field.type === 'date' ? 'change' : 'input';
    field.addEventListener(eventName, agendarFiltroAutomatico);
  });

  document.getElementById('consulta-btn-atualizar').addEventListener('click', carregarConsulta);
  document.getElementById('consulta-btn-limpar').addEventListener('click', limparFiltros);
  document.getElementById('consulta-btn-tela-cheia').addEventListener('click', toggleTelaCheia);
  refs.btnGlobal.addEventListener('click', () => definirEscopo(ESCOPOS.GLOBAL));
  refs.btnDia.addEventListener('click', () => definirEscopo(ESCOPOS.DIA));
}

async function carregarConsulta() {
  const params = new URLSearchParams();

  if (refs.filtroCodigo.value.trim()) params.append('codigo', refs.filtroCodigo.value.trim());
  if (refs.filtroDescricao.value.trim()) params.append('descricao', refs.filtroDescricao.value.trim());
  if (refs.filtroFornecedor.value.trim()) params.append('fornecedor', refs.filtroFornecedor.value.trim());
  if (refs.filtroDuracao.value) params.append('duracao', refs.filtroDuracao.value);
  params.append('escopo', escopoAtual);
  params.append('base_cobertura', 'operacional');

  try {
    const endpoint = `${consultaEstoquesApiBaseUrl}?${params.toString()}`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    consultaCache = Array.isArray(result.itens) ? result.itens : [];
    renderizarConsulta();
    renderizarIndicadores(result.indicadores || {});
    esconderMensagem();
  } catch (error) {
    consultaCache = [];
    renderizarConsulta();
    renderizarIndicadores({});
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarConsulta() {
  refs.total.textContent = `${consultaCache.length} registro(s) encontrado(s)`;

  if (consultaCache.length === 0) {
    refs.tbody.innerHTML = '<tr><td colspan="12" class="empty-state">Nenhuma peca encontrada para os filtros atuais.</td></tr>';
    return;
  }

  refs.tbody.innerHTML = consultaCache.map((item) => `
    <tr class="${Number(item.saldo_util || 0) < 0 ? 'table-row-critical' : ''}">
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_almoxarifado)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_montagem)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_expedicao)}</td>
      <td class="table-quantity">${formatNumber(item.tratamento_externo)}</td>
      <td class="table-quantity">${formatNumber(item.pecas_inacabadas)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_producao)}</td>
      <td class="table-quantity">${formatNumber(item.retrabalho)}</td>
      <td class="table-quantity">${formatNumber(item.quantidade_pedidos_lancados)}</td>
      <td class="table-quantity ${Number(item.saldo_util || 0) < 0 ? 'table-balance-negative' : 'table-balance-positive'}">${formatNumber(item.saldo_util)}</td>
      <td class="table-coverage-cell">
        <span class="table-primary-line">${formatCoverageDate(item)}</span>
      </td>
    </tr>
  `).join('');
}

function renderizarIndicadores(indicadores) {
  refs.cardItens.textContent = formatInteger(indicadores.registros || 0);
  refs.cardSaldo.textContent = formatNumber(indicadores.saldo_util || 0);
  refs.cardAlerta.textContent = formatInteger(indicadores.com_devo || 0);
  refs.cardSemConsumo.textContent = formatNumber(indicadores.pedidos_lancados || 0);
}

function formatCoverageDate(item) {
  if (!item.data_cobertura || Number(item.saldo_util || 0) <= 0) {
    return '-';
  }

  const [year, month, day] = String(item.data_cobertura).split('-');
  if (!year || !month || !day) {
    return '-';
  }

  return `${day}/${month}`;
}

function limparFiltros() {
  refs.filtroForm.reset();
  refs.filtroDuracao.value = 'menor_duracao';
  carregarConsulta();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarConsulta(), 220);
}

function obterEscopoDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const escopo = String(params.get('escopo') || '').trim().toLowerCase();
  return Object.values(ESCOPOS).includes(escopo) ? escopo : ESCOPOS.GLOBAL;
}

function definirEscopo(escopo) {
  if (!Object.values(ESCOPOS).includes(escopo) || escopoAtual === escopo) {
    return;
  }

  escopoAtual = escopo;
  atualizarCabecalhoEscopo();
  atualizarEstadoBotoesEscopo();
  sincronizarEscopoNaUrl();
  carregarConsulta();
}

function atualizarCabecalhoEscopo() {
  if (escopoAtual === ESCOPOS.DIA) {
    refs.pageTitle.textContent = 'Consulta TV do Dia';
    refs.pageSubtitle.textContent = 'Somente pedidos programados para sair hoje, comparados com o saldo utilizavel.';
    return;
  }

  refs.pageTitle.textContent = 'Consulta TV Global';
  refs.pageSubtitle.textContent = 'Todos os pedidos ativos da fabrica, comparados com o saldo utilizavel.';
}

function atualizarEstadoBotoesEscopo() {
  const aplicarEstado = (button, ativo) => {
    button.classList.toggle('btn-primary', ativo);
    button.classList.toggle('btn-secondary', !ativo);
    button.setAttribute('aria-pressed', ativo ? 'true' : 'false');
  };

  aplicarEstado(refs.btnGlobal, escopoAtual === ESCOPOS.GLOBAL);
  aplicarEstado(refs.btnDia, escopoAtual === ESCOPOS.DIA);
}

function sincronizarEscopoNaUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('escopo', escopoAtual);
  window.history.replaceState({}, '', url.toString());
}

function iniciarAtualizacaoAutomatica() {
  window.clearInterval(autoRefreshHandle);
  autoRefreshHandle = window.setInterval(() => {
    carregarConsulta().catch((error) => {
      console.error('Falha ao atualizar consulta consolidada:', error);
    });
  }, AUTO_REFRESH_MS);
}

function registrarSincronizacaoEntreAbas() {
  if (!window.SafisaSync?.subscribe) {
    return;
  }

  let refreshTimer = null;
  const agendarRefresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      carregarConsulta().catch((error) => {
        console.error('Falha ao sincronizar Consulta TV entre abas:', error);
      });
    }, 180);
  };

  ['estoque', 'pedidos-expedicao', 'submontagem-seriais'].forEach((topic) => {
    window.SafisaSync.subscribe(topic, agendarRefresh);
  });
}

function toggleTelaCheia() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    return;
  }

  document.exitFullscreen?.();
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function esconderMensagem() {
  refs.mensagem.className = 'message hidden';
  refs.mensagem.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    maximumFractionDigits: 1
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
