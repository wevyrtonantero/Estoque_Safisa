const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';
const estoquesApiBaseUrl = '/api/estoques';
const estoqueItensApiBaseUrl = '/api/estoque/itens';

let estoquesCache = [];
let itensCache = [];
let solicitacoesCache = [];
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('relatorios-mensagem'),
  total: document.getElementById('relatorios-total'),
  tabela: document.getElementById('relatorios-tbody'),
  filtroForm: document.getElementById('relatorios-filtro-form'),
  solicitacaoMensagem: document.getElementById('solicitacao-mensagem'),
  solicitacaoForm: document.getElementById('solicitacao-form'),
  solicitacaoArea: document.getElementById('solicitacao-area'),
  solicitacaoItemId: document.getElementById('solicitacao-item-id'),
  solicitacaoItemBusca: document.getElementById('solicitacao-item-busca'),
  solicitacaoSugestoes: document.getElementById('solicitacao-item-sugestoes'),
  solicitacaoResumo: document.getElementById('solicitacao-item-resumo'),
  solicitacaoQuantidade: document.getElementById('solicitacao-quantidade'),
  solicitacaoObservacao: document.getElementById('solicitacao-observacao')
};

const areaInicial = normalizarBusca(new URLSearchParams(window.location.search).get('area'));

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  try {
    await Promise.all([carregarEstoques(), carregarItens(), carregarSolicitacoes()]);
    aplicarAreaInicial();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
});

function bindEvents() {
  refs.solicitacaoForm.addEventListener('submit', handleCreateSolicitacao);
  refs.solicitacaoItemBusca.addEventListener('input', () => {
    refs.solicitacaoItemId.value = '';
    renderizarResumoItem(null);
    renderizarSugestoes(refs.solicitacaoItemBusca.value.trim());
  });
  refs.solicitacaoItemBusca.addEventListener('focus', () => renderizarSugestoes(refs.solicitacaoItemBusca.value.trim()));
  refs.solicitacaoSugestoes.addEventListener('click', handleSugestaoClick);

  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarSolicitacoes();
  });

  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltro);
    field.addEventListener('change', agendarFiltro);
  });

  document.getElementById('btn-relatorios-limpar').addEventListener('click', () => {
    refs.filtroForm.reset();
    carregarSolicitacoes();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) {
      esconderSugestoes();
    }
  });
}

async function carregarEstoques() {
  const response = await fetch(estoquesApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os estoques.');
  }

  estoquesCache = result.filter((stock) => {
    const normalized = normalizarBusca(stock.nome);
    return normalized.includes('mont') || normalized.includes('exped');
  });

  const options = `
    <option value="">Selecione</option>
    ${estoquesCache.map((stock) => `<option value="${stock.id}">${escapeHtml(stock.nome)}</option>`).join('')}
  `;

  refs.solicitacaoArea.innerHTML = options;
  document.getElementById('filtro-relatorios-area').innerHTML = `
    <option value="">Todos</option>
    ${estoquesCache.map((stock) => `<option value="${stock.id}">${escapeHtml(stock.nome)}</option>`).join('')}
  `;
}

async function carregarItens() {
  const response = await fetch(estoqueItensApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as pecas.');
  }

  itensCache = result;
}

async function carregarSolicitacoes() {
  const params = new URLSearchParams();
  const q = document.getElementById('filtro-relatorios-q').value.trim();
  const status = document.getElementById('filtro-relatorios-status').value;
  const areaStockId = document.getElementById('filtro-relatorios-area').value;

  if (q) params.append('q', q);
  if (status) params.append('status', status);

  const area = buildAreaFromStockId(areaStockId);
  if (area) params.append('area_origem', area);

  const response = await fetch(`${solicitacoesApiBaseUrl}?${params.toString()}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as solicitacoes.');
  }

  solicitacoesCache = result;
  renderizarTabela();
}

function renderizarSugestoes(termo) {
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
      <span>${escapeHtml(`${item.classificacao} | Pacote: ${formatPackage(item.estoque_minimo)} | Almox: ${formatInteger(item.saldo_almoxarifado)}`)}</span>
    </button>
  `).join('');
  refs.solicitacaoSugestoes.classList.remove('hidden');
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

  refs.solicitacaoItemId.value = String(item.id);
  refs.solicitacaoItemBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoItem(item);
  esconderSugestoes();
}

function renderizarResumoItem(item) {
  if (!item) {
    refs.solicitacaoResumo.className = 'selected-tags empty';
    refs.solicitacaoResumo.textContent = 'Digite para ver a quantidade por pacote e o saldo atual no Almoxarifado.';
    return;
  }

  refs.solicitacaoResumo.className = 'selected-tags';
  refs.solicitacaoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Qtd por pacote: ${formatPackage(item.estoque_minimo)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo Almox: ${formatInteger(item.saldo_almoxarifado)}`)}</span>
  `;
}

async function handleCreateSolicitacao(event) {
  event.preventDefault();

  try {
    const area = buildAreaFromStockId(refs.solicitacaoArea.value);
    if (!area) {
      throw new Error('Selecione o estoque de destino.');
    }

    const response = await fetch(solicitacoesApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_origem: area,
        id_peca: refs.solicitacaoItemId.value,
        quantidade_solicitada: refs.solicitacaoQuantidade.value,
        observacao: refs.solicitacaoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel criar a solicitacao.');
    }

    refs.solicitacaoForm.reset();
    refs.solicitacaoQuantidade.value = '1';
    refs.solicitacaoItemId.value = '';
    renderizarResumoItem(null);
    esconderSugestoes();
    mostrarMensagemSolicitacao('Solicitacao enviada com sucesso.', 'success');
    await carregarSolicitacoes();
  } catch (error) {
    mostrarMensagemSolicitacao(error.message, 'error');
  }
}

function renderizarTabela() {
  refs.total.textContent = `${solicitacoesCache.length} registro(s) encontrado(s)`;

  if (!solicitacoesCache.length) {
    refs.tabela.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma solicitacao encontrada.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = solicitacoesCache.map((item) => `
    <tr>
      <td>${escapeHtml(formatAreaName(item.area_origem))}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatPackage(item.quantidade_pacote)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_solicitada)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente)}</td>
      <td class="table-quantity">${formatInteger(item.saldo_almoxarifado)}</td>
      <td>${renderStatus(item.status)}</td>
      <td>${formatDate(item.data_solicitacao)}</td>
    </tr>
  `).join('');
}

function aplicarAreaInicial() {
  if (!areaInicial) {
    return;
  }

  const stock = estoquesCache.find((entry) => {
    const normalized = normalizarBusca(entry.nome);
    return areaInicial.includes('mont') ? normalized.includes('mont') : normalized.includes('exped');
  });

  if (!stock) {
    return;
  }

  refs.solicitacaoArea.value = String(stock.id);
  document.getElementById('filtro-relatorios-area').value = String(stock.id);

  const botaoVoltar = document.getElementById('relatorios-btn-voltar');
  if (botaoVoltar) {
    const isMontagem = areaInicial.includes('mont');
    botaoVoltar.href = isMontagem ? '/pagina-montagem' : '/pagina-expedicao';
    botaoVoltar.textContent = isMontagem ? 'Montagem' : 'Expedicao';
  }

  carregarSolicitacoes();
}

function buildAreaFromStockId(stockId) {
  const stock = estoquesCache.find((entry) => Number(entry.id) === Number(stockId));
  if (!stock) {
    return '';
  }

  return normalizarBusca(stock.nome).includes('mont') ? 'MONTAGEM' : 'EXPEDICAO';
}

function formatAreaName(area) {
  return String(area || '').toUpperCase() === 'MONTAGEM' ? 'Montagem' : 'Expedicao';
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

function esconderSugestoes() {
  refs.solicitacaoSugestoes.classList.add('hidden');
  refs.solicitacaoSugestoes.innerHTML = '';
}

function agendarFiltro() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarSolicitacoes(), 220);
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemSolicitacao(texto, tipo) {
  refs.solicitacaoMensagem.textContent = texto;
  refs.solicitacaoMensagem.className = `message ${tipo}`;
  refs.solicitacaoMensagem.classList.remove('hidden');
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
