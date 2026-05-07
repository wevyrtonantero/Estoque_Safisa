const consultaEstoquesApiBaseUrl = '/api/consulta-estoques/resumo';
const AUTO_REFRESH_MS = 60000;

let consultaCache = [];
let autoRefreshHandle = null;
let filtroDebounceTimer = null;

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
  cardSemConsumo: document.getElementById('consulta-card-sem-consumo')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
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
}

async function carregarConsulta() {
  const params = new URLSearchParams();

  if (refs.filtroCodigo.value.trim()) params.append('codigo', refs.filtroCodigo.value.trim());
  if (refs.filtroDescricao.value.trim()) params.append('descricao', refs.filtroDescricao.value.trim());
  if (refs.filtroFornecedor.value.trim()) params.append('fornecedor', refs.filtroFornecedor.value.trim());
  if (refs.filtroDuracao.value) params.append('duracao', refs.filtroDuracao.value);

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
    refs.tbody.innerHTML = '<tr><td colspan="13" class="empty-state">Nenhuma peca encontrada para os filtros atuais.</td></tr>';
    return;
  }

  refs.tbody.innerHTML = consultaCache.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_almoxarifado)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_montagem)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_expedicao)}</td>
      <td class="table-quantity">${formatNumber(item.somatorio_operacional)}</td>
      <td class="table-quantity">${formatNumber(item.tratamento_externo)}</td>
      <td class="table-quantity">${formatNumber(item.pecas_inacabadas)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_producao)}</td>
      <td class="table-quantity">${formatNumber(item.retrabalho)}</td>
      <td class="table-quantity">${formatNumber(item.somatorio_total)}</td>
      <td class="table-quantity">${formatNumber(item.quantidade_saida_mes)}</td>
      <td>
        <span class="table-primary-line">${formatCoverageDate(item)}</span>
        <span class="table-note">${formatCoverageDays(item)}</span>
      </td>
    </tr>
  `).join('');
}

function renderizarIndicadores(indicadores) {
  refs.cardItens.textContent = formatInteger(indicadores.registros || 0);
  refs.cardSaldo.textContent = formatNumber(indicadores.saldo_total || 0);
  refs.cardAlerta.textContent = formatInteger(indicadores.ate_7 || 0);
  refs.cardSemConsumo.textContent = formatInteger(indicadores.sem_consumo || 0);
}

function formatCoverageDate(item) {
  if (!item.data_cobertura) {
    return '-';
  }

  return new Date(`${item.data_cobertura}T00:00:00`).toLocaleDateString('pt-BR');
}

function formatCoverageDays(item) {
  if (item.dias_cobertura === null || item.dias_cobertura === undefined) {
    return 'sem consumo';
  }

  return `${formatNumber(item.dias_cobertura)} dia(s)`;
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

function iniciarAtualizacaoAutomatica() {
  window.clearInterval(autoRefreshHandle);
  autoRefreshHandle = window.setInterval(() => {
    carregarConsulta().catch((error) => {
      console.error('Falha ao atualizar consulta consolidada:', error);
    });
  }, AUTO_REFRESH_MS);
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
