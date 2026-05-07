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
  filtroClassificacao: document.getElementById('consulta-filtro-classificacao'),
  filtroBase: document.getElementById('consulta-filtro-base'),
  filtroEstado: document.getElementById('consulta-filtro-estado'),
  filtroData: document.getElementById('consulta-filtro-data'),
  filtroSaldo: document.getElementById('consulta-filtro-saldo'),
  filtroOrdem: document.getElementById('consulta-filtro-ordem'),
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
  if (refs.filtroClassificacao.value) params.append('classificacao', refs.filtroClassificacao.value);
  if (refs.filtroBase.value) params.append('base_cobertura', refs.filtroBase.value);
  if (refs.filtroEstado.value) params.append('estado', refs.filtroEstado.value);
  if (refs.filtroData.value) params.append('data_ate', refs.filtroData.value);
  if (refs.filtroSaldo.value) params.append('somente_com_saldo', refs.filtroSaldo.value);
  if (refs.filtroOrdem.value) params.append('ordem', refs.filtroOrdem.value);

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
    refs.tbody.innerHTML = '<tr><td colspan="14" class="empty-state">Nenhuma peca encontrada para os filtros atuais.</td></tr>';
    return;
  }

  refs.tbody.innerHTML = consultaCache.map((item) => `
    <tr class="${getRowClass(item.estado_cobertura)}">
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_almoxarifado)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_producao)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_montagem)}</td>
      <td class="table-quantity">${formatNumber(item.estoque_expedicao)}</td>
      <td class="table-quantity">${formatNumber(item.somatorio_operacional)}</td>
      <td class="table-quantity">${formatNumber(item.tratamento_externo)}</td>
      <td class="table-quantity">${formatNumber(item.pecas_inacabadas)}</td>
      <td class="table-quantity">${formatNumber(item.retrabalho)}</td>
      <td class="table-quantity">${formatNumber(item.somatorio_total)}</td>
      <td class="table-quantity">${formatNumber(item.quantidade_saida_mes)}</td>
      <td>
        <span class="table-primary-line">${formatCoverageDate(item)}</span>
        <span class="table-note">${formatCoverageDays(item)}</span>
      </td>
      <td>${renderEstado(item.estado_cobertura)}</td>
    </tr>
  `).join('');
}

function renderizarIndicadores(indicadores) {
  refs.cardItens.textContent = formatInteger(indicadores.registros || 0);
  refs.cardSaldo.textContent = formatNumber(indicadores.saldo_total || 0);
  refs.cardAlerta.textContent = formatInteger(indicadores.ate_7 || 0);
  refs.cardSemConsumo.textContent = formatInteger(indicadores.sem_consumo || 0);
}

function renderEstado(estado) {
  const normalized = String(estado || '').toUpperCase();
  const labels = {
    SEM_CONSUMO: 'Sem qtd/mes',
    ZERADO: 'Zerado',
    ATE_7: 'Ate 7 dias',
    ATE_15: 'Ate 15 dias',
    ATE_30: 'Ate 30 dias',
    OK: 'OK'
  };
  const classes = {
    SEM_CONSUMO: '',
    ZERADO: 'is-danger',
    ATE_7: 'is-danger',
    ATE_15: 'is-warning',
    ATE_30: 'is-warning',
    OK: 'is-success'
  };

  return `<span class="status-chip ${classes[normalized] || ''}">${escapeHtml(labels[normalized] || '-')}</span>`;
}

function getRowClass(estado) {
  const normalized = String(estado || '').toUpperCase();
  if (normalized === 'ZERADO' || normalized === 'ATE_7') {
    return 'table-row-critical';
  }

  if (normalized === 'ATE_15' || normalized === 'ATE_30') {
    return 'table-row-attention';
  }

  return '';
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
  refs.filtroBase.value = 'total';
  refs.filtroSaldo.value = '1';
  refs.filtroOrdem.value = 'cobertura';
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
