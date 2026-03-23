const submontagensApiBaseUrl = '/api/submontagens';

let submontagensCache = [];

const refs = {
  mensagem: document.getElementById('simulacao-mensagem'),
  form: document.getElementById('simulacao-form'),
  submontagemId: document.getElementById('simulacao-submontagem-id'),
  submontagemBusca: document.getElementById('simulacao-submontagem-busca'),
  sugestoes: document.getElementById('simulacao-submontagem-sugestoes'),
  quantidade: document.getElementById('simulacao-quantidade'),
  titulo: document.getElementById('simulacao-titulo'),
  subtitulo: document.getElementById('simulacao-subtitulo'),
  resumo: document.getElementById('simulacao-resumo'),
  tbody: document.getElementById('simulacao-tbody')
};

const origemInicial = normalizarBusca(new URLSearchParams(window.location.search).get('origem'));

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  configurarNavegacao();
  try {
    await carregarSubmontagens();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
});

function bindEvents() {
  refs.form.addEventListener('submit', handleSubmit);
  refs.submontagemBusca.addEventListener('input', () => {
    refs.submontagemId.value = '';
    renderizarSugestoes(refs.submontagemBusca.value.trim());
  });
  refs.submontagemBusca.addEventListener('focus', () => renderizarSugestoes(refs.submontagemBusca.value.trim()));
  refs.sugestoes.addEventListener('click', handleSugestaoClick);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) {
      esconderSugestoes();
    }
  });
}

function configurarNavegacao() {
  const botaoVoltar = document.getElementById('simulacao-btn-voltar');
  if (!botaoVoltar || !origemInicial) {
    return;
  }

  if (origemInicial.includes('mont')) {
    botaoVoltar.href = '/pagina-montagem';
    botaoVoltar.textContent = 'Montagem';
    return;
  }

  if (origemInicial.includes('exped')) {
    botaoVoltar.href = '/pagina-expedicao';
    botaoVoltar.textContent = 'Expedicao';
  }
}

async function carregarSubmontagens() {
  const response = await fetch(submontagensApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar as submontagens.');
  }

  submontagensCache = result;
}

function renderizarSugestoes(termo) {
  const filtro = normalizarBusca(termo);
  const itens = submontagensCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return normalizarBusca(`${item.codigo} ${item.descricao}`).includes(filtro);
  }).slice(0, 8);

  if (!itens.length) {
    refs.sugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma submontagem encontrada.</div>';
    refs.sugestoes.classList.remove('hidden');
    return;
  }

  refs.sugestoes.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}">
      <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
      <span>${escapeHtml(`Componentes: ${item.total_componentes || 0} | Massa: ${formatDecimal(item.massa_kg)} kg`)}</span>
    </button>
  `).join('');
  refs.sugestoes.classList.remove('hidden');
}

function handleSugestaoClick(event) {
  const option = event.target.closest('button[data-id]');
  if (!option) {
    return;
  }

  const item = submontagensCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  refs.submontagemId.value = String(item.id);
  refs.submontagemBusca.value = `${item.codigo} - ${item.descricao}`;
  esconderSugestoes();
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!refs.submontagemId.value) {
    mostrarMensagem('Selecione uma submontagem valida.', 'error');
    return;
  }

  try {
    const quantidade = Math.max(1, Number.parseInt(refs.quantidade.value, 10) || 1);
    const response = await fetch(`${submontagensApiBaseUrl}/${refs.submontagemId.value}/simulacao?quantidade=${quantidade}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel gerar a simulacao.');
    }

    renderizarResultado(result);
    mostrarMensagem('Simulacao atualizada.', 'success');
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarResultado(result) {
  document.getElementById('simulacao-card-pronto').textContent = formatInteger(result.saldo_pronto_total);
  document.getElementById('simulacao-card-capacidade').textContent = formatInteger(result.capacidade_total);
  document.getElementById('simulacao-card-status').textContent = result.pode_montar_quantidade_desejada ? 'Sim' : 'Nao';
  refs.titulo.textContent = `${result.submontagem.codigo} - ${result.submontagem.descricao}`;
  refs.subtitulo.textContent = `Quantidade desejada: ${formatInteger(result.quantidade_desejada)} | Massa: ${formatDecimal(result.submontagem.massa_kg)} kg`;

  refs.resumo.className = 'selected-tags';
  refs.resumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`Saldo pronto: ${formatInteger(result.saldo_pronto_total)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Capacidade total: ${formatInteger(result.capacidade_total)}`)}</span>
    <span class="selected-tag">${escapeHtml(`Consegue montar: ${result.pode_montar_quantidade_desejada ? 'SIM' : 'NAO'}`)}</span>
    <span class="selected-tag">${escapeHtml(buildLimitanteLabel(result.componente_limitante))}</span>
  `;

  if (!result.componentes.length) {
    refs.tbody.innerHTML = '<tr><td colspan="9" class="empty-state">A submontagem nao possui componentes.</td></tr>';
    return;
  }

  refs.tbody.innerHTML = result.componentes.map((item) => {
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

function esconderSugestoes() {
  refs.sugestoes.classList.add('hidden');
  refs.sugestoes.innerHTML = '';
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
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

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
