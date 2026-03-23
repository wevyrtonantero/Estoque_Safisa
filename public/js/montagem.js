const estoquesApiBaseUrl = '/api/estoques';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const transferenciaApiBaseUrl = '/api/estoque/transferencia';
const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';

let estoquesCache = [];
let saldosMontagemCache = [];
let pedidosMontagemCache = [];

const refs = {
  mensagem: document.getElementById('montagem-mensagem'),
  transferenciaMensagem: document.getElementById('montagem-transferencia-mensagem'),
  transferenciaForm: document.getElementById('montagem-transferencia-form'),
  itemId: document.getElementById('montagem-item-id'),
  itemBusca: document.getElementById('montagem-item-busca'),
  itemSugestoes: document.getElementById('montagem-item-sugestoes'),
  itemResumo: document.getElementById('montagem-item-resumo'),
  quantidade: document.getElementById('montagem-quantidade'),
  observacao: document.getElementById('montagem-observacao'),
  pedidosTbody: document.getElementById('montagem-pedidos-tbody'),
  estoqueTbody: document.getElementById('montagem-estoque-tbody')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();

  try {
    await carregarTudo();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
});

function bindEvents() {
  refs.transferenciaForm.addEventListener('submit', handleTransferencia);
  refs.itemBusca.addEventListener('input', () => {
    refs.itemId.value = '';
    renderizarResumoItem(null);
    renderizarSugestoes(refs.itemBusca.value.trim());
  });
  refs.itemBusca.addEventListener('focus', () => renderizarSugestoes(refs.itemBusca.value.trim()));
  refs.itemSugestoes.addEventListener('click', handleSugestaoClick);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) {
      esconderSugestoes();
    }
  });
}

async function carregarTudo() {
  await carregarEstoques();
  await Promise.all([carregarEstoqueMontagem(), carregarPedidosMontagem()]);
}

async function carregarEstoques() {
  const response = await fetch(estoquesApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os estoques.');
  }

  estoquesCache = result;
}

async function carregarEstoqueMontagem() {
  const montagem = obterEstoquePorNome('mont');
  if (!montagem) {
    throw new Error('Estoque da Montagem nao encontrado.');
  }

  const response = await fetch(`${estoqueSaldosApiBaseUrl}?estoque=${montagem.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o estoque da Montagem.');
  }

  saldosMontagemCache = result;
  renderizarEstoque();
  atualizarIndicadores();
}

async function carregarPedidosMontagem() {
  const response = await fetch(`${solicitacoesApiBaseUrl}?area_origem=MONTAGEM`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os pedidos da Montagem.');
  }

  pedidosMontagemCache = result;
  renderizarPedidos();
  atualizarIndicadores();
}

function renderizarSugestoes(termo) {
  const filtro = normalizarBusca(termo);
  const itens = saldosMontagemCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.itemSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum item disponivel na Montagem.</div>';
    refs.itemSugestoes.classList.remove('hidden');
    return;
  }

  refs.itemSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id_peca}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`${item.classificacao} | Saldo: ${formatInteger(item.quantidade)}`)}</span>
    </button>
  `).join('');
  refs.itemSugestoes.classList.remove('hidden');
}

function handleSugestaoClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = saldosMontagemCache.find((entry) => Number(entry.id_peca) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.itemId.value = String(item.id_peca);
  refs.itemBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoItem(item);
  esconderSugestoes();
}

function renderizarResumoItem(item) {
  if (!item) {
    refs.itemResumo.className = 'selected-tags empty';
    refs.itemResumo.textContent = 'Selecione um item para ver o saldo disponivel na Montagem.';
    return;
  }

  refs.itemResumo.className = 'selected-tags';
  refs.itemResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo na Montagem: ${formatInteger(item.quantidade)}`)}</span>
  `;
}

async function handleTransferencia(event) {
  event.preventDefault();

  try {
    const montagem = obterEstoquePorNome('mont');
    const expedicao = obterEstoquePorNome('exped');

    if (!montagem || !expedicao) {
      throw new Error('Nao foi possivel identificar Montagem e Expedicao.');
    }

    if (!refs.itemId.value) {
      throw new Error('Selecione um item valido da Montagem.');
    }

    const response = await fetch(transferenciaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: refs.itemId.value,
        id_estoque_origem: montagem.id,
        id_estoque_destino: expedicao.id,
        quantidade: refs.quantidade.value,
        observacao: refs.observacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel transferir para a Expedicao.');
    }

    refs.transferenciaForm.reset();
    refs.quantidade.value = '1';
    refs.itemId.value = '';
    renderizarResumoItem(null);
    esconderSugestoes();
    mostrarMensagemTransferencia('Transferencia realizada com sucesso.', 'success');
    await carregarEstoqueMontagem();
  } catch (error) {
    mostrarMensagemTransferencia(error.message, 'error');
  }
}

function renderizarPedidos() {
  document.getElementById('montagem-pedidos-total').textContent = `${pedidosMontagemCache.length} registro(s) encontrado(s)`;

  if (!pedidosMontagemCache.length) {
    refs.pedidosTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum pedido da Montagem encontrado.</td></tr>';
    return;
  }

  refs.pedidosTbody.innerHTML = pedidosMontagemCache.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatPackage(item.quantidade_pacote)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_solicitada)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_pendente)}</td>
      <td>${renderStatus(item.status)}</td>
      <td>${formatDate(item.data_solicitacao)}</td>
    </tr>
  `).join('');
}

function renderizarEstoque() {
  document.getElementById('montagem-estoque-total').textContent = `${saldosMontagemCache.length} registro(s) encontrado(s)`;

  if (!saldosMontagemCache.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum saldo na Montagem.</td></tr>';
    return;
  }

  refs.estoqueTbody.innerHTML = saldosMontagemCache.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.tipo)}</td>
      <td>${escapeHtml(item.classificacao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  document.getElementById('montagem-card-itens').textContent = String(saldosMontagemCache.length);
  document.getElementById('montagem-card-quantidade').textContent = formatInteger(
    saldosMontagemCache.reduce((total, item) => total + Number(item.quantidade || 0), 0)
  );
  document.getElementById('montagem-card-pedidos').textContent = String(
    pedidosMontagemCache.filter((item) => ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(item.status)).length
  );
}

function obterEstoquePorNome(chave) {
  return estoquesCache.find((estoque) => normalizarBusca(estoque.nome).includes(chave)) || null;
}

function esconderSugestoes() {
  refs.itemSugestoes.classList.add('hidden');
  refs.itemSugestoes.innerHTML = '';
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

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemTransferencia(texto, tipo) {
  refs.transferenciaMensagem.textContent = texto;
  refs.transferenciaMensagem.className = `message ${tipo}`;
  refs.transferenciaMensagem.classList.remove('hidden');
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
