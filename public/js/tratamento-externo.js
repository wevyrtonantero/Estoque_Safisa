const tratamentoExternoApiBaseUrl = '/api/tratamento-externo';

let saldosCache = [];
let movimentacoesCache = [];
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('tratamento-externo-mensagem'),
  tabela: document.getElementById('tratamento-externo-tbody'),
  total: document.getElementById('total-tratamento-externo'),
  movimentacoesTabela: document.getElementById('tratamento-externo-movimentacoes-tbody'),
  totalMovimentacoes: document.getElementById('total-tratamento-externo-movimentacoes'),
  filtroForm: document.getElementById('tratamento-externo-filtro-form'),
  drawer: document.getElementById('app-drawer'),
  drawerScrim: document.getElementById('drawer-scrim')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarSaldos(), carregarMovimentacoes()]);
});

function bindEvents() {
  document.getElementById('menu-toggle').addEventListener('click', () => toggleDrawer(true));
  document.getElementById('drawer-close').addEventListener('click', () => toggleDrawer(false));
  refs.drawerScrim.addEventListener('click', () => toggleDrawer(false));
  document.getElementById('btn-limpar-filtros-te').addEventListener('click', limparFiltros);
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarSaldos();
  });
  refs.filtroForm.querySelectorAll('input').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
  });
}

async function carregarSaldos() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-te-codigo').value.trim();
  const descricao = document.getElementById('filtro-te-descricao').value.trim();

  if (codigo) params.append('codigo', codigo);
  if (descricao) params.append('descricao', descricao);

  try {
    const endpoint = params.toString()
      ? `${tratamentoExternoApiBaseUrl}/saldos?${params.toString()}`
      : `${tratamentoExternoApiBaseUrl}/saldos`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar o tratamento externo.');
    }

    saldosCache = result;
    renderizarSaldos();
    atualizarIndicadores();
  } catch (error) {
    saldosCache = [];
    renderizarSaldos();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

async function carregarMovimentacoes() {
  try {
    const response = await fetch(`${tratamentoExternoApiBaseUrl}/movimentacoes`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar as movimentacoes.');
    }

    movimentacoesCache = result;
    renderizarMovimentacoes();
    atualizarIndicadores();
  } catch (error) {
    movimentacoesCache = [];
    renderizarMovimentacoes();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarSaldos() {
  refs.total.textContent = `${saldosCache.length} registro(s) encontrado(s)`;

  if (saldosCache.length === 0) {
    refs.tabela.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma peca aguardando tratamento externo.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = saldosCache.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.maquina_nome)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td>${formatarData(item.updated_at)}</td>
    </tr>
  `).join('');
}

function renderizarMovimentacoes() {
  refs.totalMovimentacoes.textContent = `${movimentacoesCache.length} movimentacao(oes)`;

  if (movimentacoesCache.length === 0) {
    refs.movimentacoesTabela.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma movimentacao registrada.</td></tr>';
    return;
  }

  refs.movimentacoesTabela.innerHTML = movimentacoesCache.slice(0, 20).map((item) => `
    <tr>
      <td>${formatarData(item.data_movimentacao)}</td>
      <td>${escapeHtml(item.tipo_movimentacao)}</td>
      <td>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td class="table-quantity">${formatInteger(item.saldo_resultante || 0)}</td>
      <td>${item.id_producao_ordem ? `OP ${escapeHtml(item.id_producao_ordem)}` : '-'}</td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  const quantidadeTotal = saldosCache.reduce((total, item) => total + Number(item.quantidade || 0), 0);

  document.getElementById('metric-te-itens').textContent = String(saldosCache.length);
  document.getElementById('metric-te-quantidade').textContent = formatInteger(quantidadeTotal);
  document.getElementById('metric-te-movimentacoes').textContent = String(movimentacoesCache.length);
}

function limparFiltros() {
  refs.filtroForm.reset();
  carregarSaldos();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarSaldos(), 220);
}

function toggleDrawer(shouldOpen) {
  refs.drawer.classList.toggle('is-open', shouldOpen);
  refs.drawerScrim.classList.toggle('hidden', !shouldOpen);
  document.body.classList.toggle('has-drawer', shouldOpen);
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
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
