const estoquesApiBaseUrl = '/api/estoques';
const estoqueSaldosApiBaseUrl = '/api/estoque/saldos';
const estoqueItensApiBaseUrl = '/api/estoque/itens';
const estoqueMovimentacoesApiBaseUrl = '/api/estoque/movimentacoes';
const solicitacoesApiBaseUrl = '/api/solicitacoes-estoque';
const saidaApiBaseUrl = '/api/estoque/saida';

let estoquesCache = [];
let itensCache = [];
let saldosExpedicaoCache = [];
let pedidosExpedicaoCache = [];
let historicoSaidasCache = [];
let saidaLista = [];
let estruturasSubmontagemCache = new Map();

const refs = {
  mensagem: document.getElementById('expedicao-mensagem'),
  saidaMensagem: document.getElementById('expedicao-saida-mensagem'),
  itemId: document.getElementById('expedicao-item-id'),
  itemBusca: document.getElementById('expedicao-item-busca'),
  itemSugestoes: document.getElementById('expedicao-item-sugestoes'),
  itemResumo: document.getElementById('expedicao-item-resumo'),
  quantidade: document.getElementById('expedicao-quantidade'),
  observacao: document.getElementById('expedicao-observacao'),
  listaTbody: document.getElementById('expedicao-lista-tbody'),
  pedidosTbody: document.getElementById('expedicao-pedidos-tbody'),
  historicoTbody: document.getElementById('expedicao-historico-tbody'),
  estoqueTbody: document.getElementById('expedicao-estoque-tbody')
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
  refs.itemBusca.addEventListener('input', () => {
    refs.itemId.value = '';
    renderizarResumoItem(null);
    renderizarSugestoes(refs.itemBusca.value.trim());
  });
  refs.itemBusca.addEventListener('focus', () => renderizarSugestoes(refs.itemBusca.value.trim()));
  refs.itemSugestoes.addEventListener('click', handleSugestaoClick);
  document.getElementById('expedicao-btn-adicionar').addEventListener('click', adicionarItemNaLista);
  document.getElementById('expedicao-btn-limpar-item').addEventListener('click', limparItemAtual);
  document.getElementById('expedicao-btn-baixar').addEventListener('click', baixarSaida);
  refs.listaTbody.addEventListener('click', handleListaActions);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) {
      esconderSugestoes();
    }
  });
}

async function carregarTudo() {
  await carregarEstoques();
  await carregarItens();
  await Promise.all([
    carregarEstoqueExpedicao(),
    carregarPedidosExpedicao(),
    carregarHistoricoSaidas()
  ]);
}

async function carregarEstoques() {
  const response = await fetch(estoquesApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os estoques.');
  }

  estoquesCache = result;
}

async function carregarItens() {
  const response = await fetch(estoqueItensApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os itens.');
  }

  itensCache = result;
  await preCarregarEstruturasSubmontagem();
}

async function preCarregarEstruturasSubmontagem() {
  const submontagens = itensCache.filter((item) => item.classificacao === 'SUBMONTAGEM');

  await Promise.all(submontagens.map(async (item) => {
    if (estruturasSubmontagemCache.has(item.id)) {
      return;
    }

    try {
      const response = await fetch(`/api/submontagens/${item.id}/componentes`);
      const result = await response.json();

      if (response.ok) {
        estruturasSubmontagemCache.set(item.id, result);
      }
    } catch (_) {
      // Mantem a tela resiliente mesmo se alguma estrutura falhar.
    }
  }));
}

async function carregarEstoqueExpedicao() {
  const expedicao = obterEstoquePorNome('exped');
  if (!expedicao) {
    throw new Error('Estoque da Expedicao nao encontrado.');
  }

  const response = await fetch(`${estoqueSaldosApiBaseUrl}?estoque=${expedicao.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o estoque da Expedicao.');
  }

  saldosExpedicaoCache = result;
  renderizarEstoque();
  atualizarIndicadores();
}

async function carregarPedidosExpedicao() {
  const response = await fetch(`${solicitacoesApiBaseUrl}?area_origem=EXPEDICAO`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os pedidos da Expedicao.');
  }

  pedidosExpedicaoCache = result;
  renderizarPedidos();
  atualizarIndicadores();
}

async function carregarHistoricoSaidas() {
  const expedicao = obterEstoquePorNome('exped');
  if (!expedicao) {
    throw new Error('Estoque da Expedicao nao encontrado.');
  }

  const response = await fetch(`${estoqueMovimentacoesApiBaseUrl}?estoque=${expedicao.id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar o historico de saidas.');
  }

  historicoSaidasCache = result
    .filter((item) => String(item.tipo_movimentacao || '').toUpperCase() === 'SAIDA')
    .slice(0, 30);
  renderizarHistorico();
}

function renderizarSugestoes(termo) {
  const filtro = normalizarBusca(termo);
  const itens = itensCache.filter((item) => {
    const disponibilidade = obterDisponibilidadeVenda(item);

    if (disponibilidade <= 0) {
      return false;
    }

    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao} ${item.classificacao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.itemSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum item disponivel para venda na Expedicao.</div>';
    refs.itemSugestoes.classList.remove('hidden');
    return;
  }

  refs.itemSugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`${item.classificacao} | Disponivel: ${formatInteger(obterDisponibilidadeVenda(item))}`)}</span>
    </button>
  `).join('');
  refs.itemSugestoes.classList.remove('hidden');
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

  refs.itemId.value = String(item.id);
  refs.itemBusca.value = `${item.codigo} - ${item.descricao}`;
  renderizarResumoItem(item);
  esconderSugestoes();
}

function renderizarResumoItem(item) {
  if (!item) {
    refs.itemResumo.className = 'selected-tags empty';
    refs.itemResumo.textContent = 'Selecione um item para ver a disponibilidade atual na Expedicao.';
    return;
  }

  refs.itemResumo.className = 'selected-tags';
  refs.itemResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(item.codigo)}</span>
    <span class="selected-tag">${escapeHtml(item.descricao)}</span>
    <span class="selected-tag">${escapeHtml(`Classificacao: ${item.classificacao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Disponivel para venda: ${formatInteger(obterDisponibilidadeVenda(item))}`)}</span>
  `;
}

function adicionarItemNaLista() {
  if (!refs.itemId.value) {
    mostrarMensagemSaida('Selecione um item valido da Expedicao.', 'error');
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(refs.itemId.value));
  if (!item) {
    mostrarMensagemSaida('Item nao encontrado para a saida.', 'error');
    return;
  }

  const quantidade = Number.parseInt(refs.quantidade.value, 10) || 0;
  if (quantidade <= 0) {
    mostrarMensagemSaida('A quantidade deve ser maior que zero.', 'error');
    return;
  }

  const disponivel = obterDisponibilidadeVenda(item);
  const existente = saidaLista.find((entry) => Number(entry.id_peca) === Number(item.id));
  const quantidadeTotal = quantidade + Number(existente ? existente.quantidade : 0);

  if (quantidadeTotal > disponivel) {
    mostrarMensagemSaida(`Disponivel insuficiente para ${item.codigo}.`, 'error');
    return;
  }

  if (existente) {
    existente.quantidade = quantidadeTotal;
  } else {
    saidaLista.push({
      id_peca: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade
    });
  }

  limparItemAtual();
  renderizarLista();
  mostrarMensagemSaida('Item adicionado na lista de saida.', 'success');
}

function limparItemAtual() {
  refs.itemId.value = '';
  refs.itemBusca.value = '';
  refs.quantidade.value = '1';
  renderizarResumoItem(null);
  esconderSugestoes();
}

function handleListaActions(event) {
  const button = event.target.closest('button[data-remove-id]');
  if (!button) {
    return;
  }

  saidaLista = saidaLista.filter((item) => Number(item.id_peca) !== Number(button.dataset.removeId));
  renderizarLista();
}

async function baixarSaida() {
  if (!saidaLista.length) {
    mostrarMensagemSaida('Adicione ao menos um item na lista de saida.', 'error');
    return;
  }

  try {
    const response = await fetch(saidaApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: saidaLista.map((item) => ({
          id_peca: item.id_peca,
          quantidade: item.quantidade
        })),
        observacao: refs.observacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel registrar a saida.');
    }

    saidaLista = [];
    refs.observacao.value = '';
    renderizarLista();
    mostrarMensagemSaida('Saida registrada com sucesso.', 'success');
    await Promise.all([
      carregarEstoqueExpedicao(),
      carregarHistoricoSaidas()
    ]);
  } catch (error) {
    mostrarMensagemSaida(error.message, 'error');
  }
}

function renderizarLista() {
  document.getElementById('expedicao-lista-total').textContent = `${saidaLista.length} item(ns) na lista`;

  if (!saidaLista.length) {
    refs.listaTbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum item na lista.</td></tr>';
    return;
  }

  refs.listaTbody.innerHTML = saidaLista.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td class="table-actions-cell">
        <button type="button" class="btn btn-neutral" data-remove-id="${item.id_peca}">Remover</button>
      </td>
    </tr>
  `).join('');
}

function renderizarPedidos() {
  document.getElementById('expedicao-pedidos-total').textContent = `${pedidosExpedicaoCache.length} registro(s) encontrado(s)`;

  if (!pedidosExpedicaoCache.length) {
    refs.pedidosTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum pedido da Expedicao encontrado.</td></tr>';
    return;
  }

  refs.pedidosTbody.innerHTML = pedidosExpedicaoCache.map((item) => `
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

function renderizarHistorico() {
  document.getElementById('expedicao-historico-total').textContent = `${historicoSaidasCache.length} registro(s) encontrado(s)`;

  if (!historicoSaidasCache.length) {
    refs.historicoTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma saida registrada na Expedicao.</td></tr>';
    return;
  }

  refs.historicoTbody.innerHTML = historicoSaidasCache.map((item) => `
    <tr>
      <td>${formatDate(item.data_movimentacao)}</td>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
    </tr>
  `).join('');
}

function renderizarEstoque() {
  document.getElementById('expedicao-estoque-total').textContent = `${saldosExpedicaoCache.length} registro(s) encontrado(s)`;

  if (!saldosExpedicaoCache.length) {
    refs.estoqueTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum saldo na Expedicao.</td></tr>';
    return;
  }

  refs.estoqueTbody.innerHTML = saldosExpedicaoCache.map((item) => `
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
  document.getElementById('expedicao-card-itens').textContent = String(saldosExpedicaoCache.length);
  document.getElementById('expedicao-card-quantidade').textContent = formatInteger(
    saldosExpedicaoCache.reduce((total, item) => total + Number(item.quantidade || 0), 0)
  );
  document.getElementById('expedicao-card-pedidos').textContent = String(
    pedidosExpedicaoCache.filter((item) => ['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(item.status)).length
  );
}

function obterEstoquePorNome(chave) {
  return estoquesCache.find((estoque) => normalizarBusca(estoque.nome).includes(chave)) || null;
}

function obterSaldoExpedicao(idPeca) {
  const saldo = saldosExpedicaoCache.find((item) => Number(item.id_peca) === Number(idPeca));
  return saldo ? Number(saldo.quantidade || 0) : 0;
}

function calcularDisponibilidadeSubmontagem(item) {
  const componentes = estruturasSubmontagemCache.get(item.id) || [];
  const saldoPronto = obterSaldoExpedicao(item.id);

  if (!componentes.length) {
    return saldoPronto;
  }

  const capacidades = componentes.map((componente) => {
    const saldoComponente = obterSaldoExpedicao(componente.id_item_componente);
    return Math.floor(saldoComponente / Number(componente.quantidade || 1));
  });

  const capacidadeComponentes = capacidades.length ? Math.min(...capacidades) : 0;
  return saldoPronto + Math.max(0, capacidadeComponentes);
}

function obterDisponibilidadeVenda(item) {
  if (item.classificacao === 'SUBMONTAGEM') {
    return calcularDisponibilidadeSubmontagem(item);
  }

  return obterSaldoExpedicao(item.id);
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

function mostrarMensagemSaida(texto, tipo) {
  refs.saidaMensagem.textContent = texto;
  refs.saidaMensagem.className = `message ${tipo}`;
  refs.saidaMensagem.classList.remove('hidden');
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
