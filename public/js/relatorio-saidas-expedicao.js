const saidasApiBaseUrl = '/api/expedicao/saidas';
const submontagensApiBaseUrl = '/api/submontagens';

const TIPO_SAIDA_LABELS = {
  VENDA: 'Venda',
  GARANTIA: 'Garantia',
  CORTESIA: 'Cortesia',
  USO_INTERNO: 'Uso interno',
  OUTROS: 'Outros'
};

const TIPO_SAIDA_ORDEM = ['VENDA', 'GARANTIA', 'CORTESIA', 'USO_INTERNO', 'OUTROS'];

let saidasCache = [];
let linhasRelatorioCache = [];
let estruturasSubmontagemCache = new Map();
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('relatorio-saidas-mensagem'),
  filtros: document.getElementById('relatorio-saidas-filtros'),
  dataInicio: document.getElementById('relatorio-saidas-data-inicio'),
  dataFim: document.getElementById('relatorio-saidas-data-fim'),
  tipo: document.getElementById('relatorio-saidas-tipo'),
  classificacao: document.getElementById('relatorio-saidas-classificacao'),
  forma: document.getElementById('relatorio-saidas-forma'),
  codigo: document.getElementById('relatorio-saidas-codigo'),
  descricao: document.getElementById('relatorio-saidas-descricao'),
  observacao: document.getElementById('relatorio-saidas-observacao'),
  total: document.getElementById('relatorio-saidas-total'),
  cardRegistros: document.getElementById('relatorio-saidas-card-registros'),
  cardTipos: document.getElementById('relatorio-saidas-card-tipos'),
  cardQuantidade: document.getElementById('relatorio-saidas-card-quantidade'),
  tbody: document.getElementById('relatorio-saidas-tbody'),
  limpar: document.getElementById('relatorio-saidas-limpar'),
  estruturaModal: document.getElementById('relatorio-saidas-estrutura-modal'),
  estruturaMensagem: document.getElementById('relatorio-saidas-estrutura-mensagem'),
  estruturaTitulo: document.getElementById('relatorio-saidas-estrutura-titulo'),
  estruturaSubtitulo: document.getElementById('relatorio-saidas-estrutura-subtitulo'),
  estruturaTbody: document.getElementById('relatorio-saidas-estrutura-tbody'),
  estruturaFechar: document.getElementById('btn-fechar-relatorio-saidas-estrutura')
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  carregarSaidas();
});

function bindEvents() {
  refs.filtros.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarSaidas();
  });

  refs.limpar.addEventListener('click', limparFiltros);
  refs.tbody.addEventListener('click', handleTabelaActions);
  refs.estruturaFechar.addEventListener('click', fecharModalEstrutura);
  refs.estruturaModal.addEventListener('click', handleBackdrop);

  refs.filtros.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarConsulta);
    field.addEventListener('change', agendarConsulta);
  });
}

function agendarConsulta() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarSaidas(), 250);
}

function montarParametros() {
  const params = new URLSearchParams({ limit: '500' });
  const valores = {
    data_inicio: refs.dataInicio.value,
    data_fim: refs.dataFim.value,
    tipo_saida: refs.tipo.value,
    classificacao: refs.classificacao.value,
    forma_atendimento: refs.forma.value,
    codigo: refs.codigo.value.trim(),
    descricao: refs.descricao.value.trim(),
    observacao: refs.observacao.value.trim()
  };

  Object.entries(valores).forEach(([key, value]) => {
    if (value) {
      params.append(key, value);
    }
  });

  return params;
}

async function carregarSaidas() {
  refs.mensagem.className = 'message hidden';
  refs.mensagem.textContent = '';

  try {
    const response = await fetch(`${saidasApiBaseUrl}?${montarParametros().toString()}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar as saidas da Expedicao.');
    }

    saidasCache = Array.isArray(result) ? result : [];
    renderizarSaidas();
  } catch (error) {
    saidasCache = [];
    renderizarSaidas();
    refs.mensagem.textContent = error.message;
    refs.mensagem.className = 'message error';
    refs.mensagem.classList.remove('hidden');
  }
}

function limparFiltros() {
  refs.filtros.reset();
  carregarSaidas();
}

function renderizarSaidas() {
  linhasRelatorioCache = obterLinhasRelatorio();
  const totalQuantidade = linhasRelatorioCache.reduce((sum, item) => sum + Number(item.quantidade_solicitada || 0), 0);

  refs.total.textContent = `${linhasRelatorioCache.length} registro(s) encontrado(s)`;
  refs.cardRegistros.textContent = String(linhasRelatorioCache.length);
  renderizarCardTipos(linhasRelatorioCache);
  refs.cardQuantidade.textContent = formatDecimal(totalQuantidade);

  if (!linhasRelatorioCache.length) {
    refs.tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma saida encontrada para os filtros informados.</td></tr>';
    return;
  }

  refs.tbody.innerHTML = linhasRelatorioCache.map((item) => `
    <tr>
      <td>${formatDate(item.data_saida)}</td>
      <td>${escapeHtml(formatTipoSaida(item.tipo_saida))}</td>
      <td>
        ${renderCodDescricao(item)}
      </td>
      <td class="table-quantity">${formatDecimal(item.quantidade_solicitada)}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
    </tr>
  `).join('');
}

function renderCodDescricao(item) {
  const conteudo = `
    <strong class="table-code">${escapeHtml(item.codigo_solicitado)}</strong>
    <span class="table-muted">${escapeHtml(item.descricao_solicitada)}</span>
  `;

  if (String(item.classificacao_solicitada || '').toUpperCase() !== 'SUBMONTAGEM') {
    return conteudo;
  }

  return `
    <a href="#" class="table-link" data-action="estrutura" data-id="${item.id_peca_solicitada}">
      ${conteudo}
    </a>
  `;
}

function obterLinhasRelatorio() {
  const linhasPorItem = new Map();

  saidasCache.forEach((item) => {
    const key = Number(item.id_saida_item);

    if (!linhasPorItem.has(key)) {
      linhasPorItem.set(key, item);
    }
  });

  return Array.from(linhasPorItem.values());
}

function obterTotaisPorTipo(linhas) {
  const totaisPorTipo = new Map();

  linhas.forEach((item) => {
    const tipo = String(item.tipo_saida || 'VENDA').toUpperCase();
    const quantidade = Number(item.quantidade_solicitada || 0);
    totaisPorTipo.set(tipo, (totaisPorTipo.get(tipo) || 0) + quantidade);
  });

  const tiposConhecidos = new Set(TIPO_SAIDA_ORDEM);
  const tiposOrdenados = TIPO_SAIDA_ORDEM
    .map((tipo) => ({
      tipo,
      label: formatTipoSaida(tipo),
      quantidade: totaisPorTipo.get(tipo) || 0
    }))
    .filter((item) => item.quantidade > 0);
  const tiposExtras = Array.from(totaisPorTipo.entries())
    .filter(([tipo, quantidade]) => !tiposConhecidos.has(tipo) && quantidade > 0)
    .map(([tipo, quantidade]) => ({
      tipo,
      label: formatTipoSaida(tipo),
      quantidade
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return tiposOrdenados.concat(tiposExtras);
}

function renderizarCardTipos(linhas) {
  const totais = obterTotaisPorTipo(linhas);

  if (!totais.length) {
    refs.cardTipos.innerHTML = '<small>Sem saidas</small>';
    return;
  }

  refs.cardTipos.innerHTML = totais.map((item) => `
    <div class="summary-list-row">
      <span>${escapeHtml(item.label)}</span>
      <strong>${formatDecimal(item.quantidade)}</strong>
    </div>
  `).join('');
}

async function handleTabelaActions(event) {
  const trigger = event.target.closest('[data-action="estrutura"][data-id]');
  if (!trigger) {
    return;
  }

  event.preventDefault();
  await abrirModalEstrutura(Number(trigger.dataset.id));
}

async function abrirModalEstrutura(submontagemId) {
  const item = linhasRelatorioCache.find((entry) => Number(entry.id_peca_solicitada) === Number(submontagemId));

  refs.estruturaMensagem.className = 'message hidden';
  refs.estruturaMensagem.textContent = '';
  refs.estruturaTitulo.textContent = item
    ? `Estrutura de ${item.codigo_solicitado}`
    : 'Estrutura da submontagem';
  refs.estruturaSubtitulo.textContent = item
    ? `${item.descricao_solicitada} | Componentes da submontagem.`
    : 'Veja os componentes que entram nesta submontagem.';
  refs.estruturaTbody.innerHTML = '<tr><td colspan="3" class="empty-state">Carregando estrutura...</td></tr>';
  openModal(refs.estruturaModal);

  try {
    const componentes = await carregarEstruturaSubmontagem(submontagemId);

    if (!componentes.length) {
      refs.estruturaTbody.innerHTML = '<tr><td colspan="3" class="empty-state">Esta submontagem nao possui componentes cadastrados.</td></tr>';
      return;
    }

    refs.estruturaTbody.innerHTML = componentes.map((componente) => `
      <tr>
        <td class="table-code">${escapeHtml(componente.codigo_componente)}</td>
        <td class="table-description">${escapeHtml(componente.descricao_componente)}</td>
        <td class="table-quantity">${formatDecimal(componente.quantidade)}</td>
      </tr>
    `).join('');
  } catch (error) {
    refs.estruturaMensagem.textContent = error.message;
    refs.estruturaMensagem.className = 'message error';
    refs.estruturaMensagem.classList.remove('hidden');
    refs.estruturaTbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nao foi possivel carregar a estrutura.</td></tr>';
  }
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

  estruturasSubmontagemCache.set(submontagemId, Array.isArray(result) ? result : []);
  return estruturasSubmontagemCache.get(submontagemId);
}

function fecharModalEstrutura() {
  closeModal(refs.estruturaModal);
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'relatorio-saidas-estrutura') {
    fecharModalEstrutura();
  }
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function formatTipoSaida(value) {
  return TIPO_SAIDA_LABELS[String(value || '').toUpperCase()] || value || '-';
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
