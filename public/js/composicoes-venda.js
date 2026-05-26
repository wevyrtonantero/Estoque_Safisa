const composicoesApiBaseUrl = '/api/composicoes-venda';
const estoqueItensApiBaseUrl = '/api/estoque/itens';

let composicoesCache = [];
let itensCache = [];
let itemVendaSelecionado = null;
let itemAtendeSelecionado = null;

const refs = {
  mensagem: document.getElementById('composicao-page-message'),
  filtroForm: document.getElementById('composicao-filtro-form'),
  filtroBusca: document.getElementById('composicao-filtro-busca'),
  btnLimparFiltro: document.getElementById('composicao-btn-limpar-filtro'),
  btnNova: document.getElementById('composicao-btn-nova'),
  btnAtualizar: document.getElementById('composicao-btn-atualizar'),
  totalRegistros: document.getElementById('composicao-total-registros'),
  listaTbody: document.getElementById('composicao-lista-tbody'),
  modal: document.getElementById('composicao-modal'),
  btnFecharModal: document.getElementById('composicao-btn-fechar-modal'),
  form: document.getElementById('composicao-form'),
  formMessage: document.getElementById('composicao-form-message'),
  formTitle: document.getElementById('composicao-form-title'),
  formSubtitle: document.getElementById('composicao-form-subtitle'),
  composicaoId: document.getElementById('composicao-id'),
  itemVendaId: document.getElementById('composicao-item-venda-id'),
  itemAtendeId: document.getElementById('composicao-item-atende-id'),
  itemVendaBusca: document.getElementById('composicao-item-venda-busca'),
  itemAtendeBusca: document.getElementById('composicao-item-atende-busca'),
  itemVendaSugestoes: document.getElementById('composicao-item-venda-sugestoes'),
  itemAtendeSugestoes: document.getElementById('composicao-item-atende-sugestoes'),
  quantidade: document.getElementById('composicao-quantidade'),
  ordem: document.getElementById('composicao-ordem'),
  resumo: document.getElementById('composicao-resumo'),
  btnSalvar: document.getElementById('composicao-btn-salvar'),
  btnCancelarEdicao: document.getElementById('composicao-btn-cancelar-edicao')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();

  try {
    await Promise.all([carregarItens(), carregarComposicoes()]);
  } catch (error) {
    mostrarMensagem(error.message || 'Nao foi possivel carregar a tela de composicao de venda.', 'error');
  }
});

function bindEvents() {
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    renderizarComposicoes();
  });

  refs.filtroBusca.addEventListener('input', renderizarComposicoes);
  refs.btnLimparFiltro.addEventListener('click', () => {
    refs.filtroBusca.value = '';
    renderizarComposicoes();
  });

  refs.btnNova.addEventListener('click', () => {
    resetarFormulario();
    abrirModal();
  });

  refs.btnAtualizar.addEventListener('click', async () => {
    try {
      await carregarComposicoes();
      mostrarMensagem('Composicoes atualizadas com sucesso.', 'success');
    } catch (error) {
      mostrarMensagem(error.message || 'Nao foi possivel atualizar as composicoes.', 'error');
    }
  });

  refs.itemVendaBusca.addEventListener('input', () => {
    itemVendaSelecionado = null;
    refs.itemVendaId.value = '';
    renderizarResumo();
    renderizarSugestoes('venda', refs.itemVendaBusca.value.trim());
  });

  refs.itemAtendeBusca.addEventListener('input', () => {
    itemAtendeSelecionado = null;
    refs.itemAtendeId.value = '';
    renderizarResumo();
    renderizarSugestoes('atende', refs.itemAtendeBusca.value.trim());
  });

  refs.itemVendaBusca.addEventListener('focus', () => renderizarSugestoes('venda', refs.itemVendaBusca.value.trim()));
  refs.itemAtendeBusca.addEventListener('focus', () => renderizarSugestoes('atende', refs.itemAtendeBusca.value.trim()));
  refs.itemVendaSugestoes.addEventListener('click', (event) => handleSugestaoClick(event, 'venda'));
  refs.itemAtendeSugestoes.addEventListener('click', (event) => handleSugestaoClick(event, 'atende'));
  refs.form.addEventListener('submit', salvarComposicao);
  refs.btnCancelarEdicao.addEventListener('click', () => {
    resetarFormulario();
    fecharModal();
  });
  refs.listaTbody.addEventListener('click', handleListaActions);
  refs.btnFecharModal.addEventListener('click', fecharModal);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) {
      esconderSugestoes();
    }
  });

  document.querySelectorAll('[data-close-modal="composicao"]').forEach((element) => {
    element.addEventListener('click', fecharModal);
  });
}

async function carregarItens() {
  itensCache = await fetchJson(estoqueItensApiBaseUrl);
}

async function carregarComposicoes() {
  composicoesCache = await fetchJson(composicoesApiBaseUrl);
  renderizarComposicoes();
}

function obterComposicoesFiltradas() {
  const busca = normalizarBusca(refs.filtroBusca.value.trim());
  if (!busca) {
    return composicoesCache;
  }

  return composicoesCache.filter((linha) => (
    normalizarBusca(linha.item_venda_codigo).includes(busca)
    || normalizarBusca(linha.item_venda_descricao).includes(busca)
    || normalizarBusca(linha.item_atende_codigo).includes(busca)
    || normalizarBusca(linha.item_atende_descricao).includes(busca)
  ));
}

function renderizarComposicoes() {
  const linhas = obterComposicoesFiltradas();
  refs.totalRegistros.textContent = `${formatInteger(linhas.length)} linha(s) encontrada(s)`;

  if (!linhas.length) {
    refs.listaTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma composicao encontrada.</td></tr>';
    return;
  }

  refs.listaTbody.innerHTML = linhas.map((linha) => `
    <tr>
      <td class="table-code">${escapeHtml(linha.item_venda_codigo)}</td>
      <td>${escapeHtml(linha.item_venda_descricao)}</td>
      <td class="table-code">${escapeHtml(linha.item_atende_codigo)}</td>
      <td>${escapeHtml(linha.item_atende_descricao)}</td>
      <td>${formatDecimal(linha.quantidade)}</td>
      <td>${formatInteger(linha.ordem)}</td>
      <td>
        <div class="table-actions-inline">
          <button class="icon-btn icon-btn-small" type="button" data-action="editar" data-id="${linha.id}" aria-label="Editar composicao">...</button>
          <button class="icon-btn icon-btn-small icon-btn-danger" type="button" data-action="excluir" data-id="${linha.id}" aria-label="Excluir composicao">X</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderizarSugestoes(tipo, search) {
  const normalized = normalizarBusca(search);
  const itens = normalized
    ? itensCache.filter((item) => (
      normalizarBusca(item.codigo).includes(normalized)
      || normalizarBusca(item.descricao).includes(normalized)
    ))
    : itensCache.slice(0, 12);

  const container = tipo === 'venda' ? refs.itemVendaSugestoes : refs.itemAtendeSugestoes;

  if (!itens.length) {
    container.innerHTML = '<div class="autocomplete-empty">Nenhum item encontrado.</div>';
    container.classList.remove('hidden');
    return;
  }

  container.innerHTML = itens.slice(0, 12).map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}" data-tipo="${tipo}">
      <strong>${escapeHtml(item.codigo)}</strong>
      <span>${escapeHtml(`${item.descricao} | ${item.classificacao}`)}</span>
    </button>
  `).join('');
  container.classList.remove('hidden');
}

function handleSugestaoClick(event, tipo) {
  const option = event.target.closest('.autocomplete-option[data-id]');
  if (!option) {
    return;
  }

  const item = itensCache.find((entry) => Number(entry.id) === Number(option.dataset.id));
  if (!item) {
    return;
  }

  if (tipo === 'venda') {
    itemVendaSelecionado = item;
    refs.itemVendaId.value = String(item.id);
    refs.itemVendaBusca.value = `${item.codigo} - ${item.descricao}`;
  } else {
    itemAtendeSelecionado = item;
    refs.itemAtendeId.value = String(item.id);
    refs.itemAtendeBusca.value = `${item.codigo} - ${item.descricao}`;
  }

  esconderSugestoes();
  renderizarResumo();
}

function esconderSugestoes() {
  refs.itemVendaSugestoes.classList.add('hidden');
  refs.itemAtendeSugestoes.classList.add('hidden');
}

function renderizarResumo() {
  if (!itemVendaSelecionado || !itemAtendeSelecionado) {
    refs.resumo.classList.add('empty');
    refs.resumo.innerHTML = 'Selecione os dois lados da composicao para salvar.';
    return;
  }

  refs.resumo.classList.remove('empty');
  refs.resumo.innerHTML = `
    <span class="selected-tag">Venda: ${escapeHtml(itemVendaSelecionado.codigo)}</span>
    <span class="selected-tag">Atende: ${escapeHtml(itemAtendeSelecionado.codigo)}</span>
    <span class="selected-tag">Qtd.: ${escapeHtml(String(refs.quantidade.value || '1'))}</span>
    <span class="selected-tag">Ordem: ${escapeHtml(String(refs.ordem.value || '0'))}</span>
  `;
}

async function salvarComposicao(event) {
  event.preventDefault();
  refs.formMessage.className = 'message hidden';
  refs.formMessage.textContent = '';

  const payload = {
    id_item_venda: Number(refs.itemVendaId.value),
    id_item_atende: Number(refs.itemAtendeId.value),
    quantidade: refs.quantidade.value,
    ordem: refs.ordem.value
  };

  if (!Number.isInteger(payload.id_item_venda)) {
    mostrarMensagemFormulario('Selecione um item de venda valido.', 'error');
    return;
  }

  if (!Number.isInteger(payload.id_item_atende)) {
    mostrarMensagemFormulario('Selecione um item atendido valido.', 'error');
    return;
  }

  const composicaoId = Number.parseInt(refs.composicaoId.value, 10);
  const isEdicao = Number.isInteger(composicaoId);

  try {
    const composicao = await fetchJson(
      isEdicao ? `${composicoesApiBaseUrl}/${composicaoId}` : composicoesApiBaseUrl,
      {
        method: isEdicao ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (isEdicao) {
      composicoesCache = composicoesCache.map((linha) => (Number(linha.id) === Number(composicao.id) ? composicao : linha));
    } else {
      composicoesCache.push(composicao);
    }

    renderizarComposicoes();
    fecharModal();
    resetarFormulario();
    mostrarMensagem(isEdicao ? 'Composicao atualizada com sucesso.' : 'Composicao criada com sucesso.', 'success');
  } catch (error) {
    mostrarMensagemFormulario(error.message || 'Nao foi possivel salvar a composicao.', 'error');
  }
}

function handleListaActions(event) {
  const button = event.target.closest('button[data-action][data-id]');
  if (!button) {
    return;
  }

  const linha = composicoesCache.find((entry) => Number(entry.id) === Number(button.dataset.id));
  if (!linha) {
    return;
  }

  if (button.dataset.action === 'editar') {
    preencherFormularioEdicao(linha);
    abrirModal();
    return;
  }

  if (button.dataset.action === 'excluir') {
    excluirComposicao(linha);
  }
}

function preencherFormularioEdicao(linha) {
  refs.composicaoId.value = String(linha.id);
  refs.formTitle.textContent = 'Editar linha de composicao';
  refs.formSubtitle.textContent = 'Atualize a linha selecionada e salve para refletir no fluxo de venda.';
  refs.btnSalvar.textContent = 'Salvar alteracoes';
  refs.btnCancelarEdicao.classList.remove('hidden');

  itemVendaSelecionado = {
    id: linha.id_item_venda,
    codigo: linha.item_venda_codigo,
    descricao: linha.item_venda_descricao
  };
  itemAtendeSelecionado = {
    id: linha.id_item_atende,
    codigo: linha.item_atende_codigo,
    descricao: linha.item_atende_descricao
  };

  refs.itemVendaId.value = String(linha.id_item_venda);
  refs.itemAtendeId.value = String(linha.id_item_atende);
  refs.itemVendaBusca.value = `${linha.item_venda_codigo} - ${linha.item_venda_descricao}`;
  refs.itemAtendeBusca.value = `${linha.item_atende_codigo} - ${linha.item_atende_descricao}`;
  refs.quantidade.value = formatDecimalInput(linha.quantidade);
  refs.ordem.value = String(linha.ordem || 0);
  renderizarResumo();
}

function resetarFormulario() {
  refs.form.reset();
  refs.composicaoId.value = '';
  refs.itemVendaId.value = '';
  refs.itemAtendeId.value = '';
  refs.quantidade.value = '1';
  refs.ordem.value = '0';
  refs.formTitle.textContent = 'Nova linha de composicao';
  refs.formSubtitle.textContent = 'Escolha o item de venda, o item que atende e defina quantidade e ordem.';
  refs.btnSalvar.textContent = 'Salvar linha';
  refs.btnCancelarEdicao.classList.add('hidden');
  itemVendaSelecionado = null;
  itemAtendeSelecionado = null;
  renderizarResumo();
  refs.formMessage.className = 'message hidden';
  refs.formMessage.textContent = '';
  esconderSugestoes();
}

async function excluirComposicao(linha) {
  const confirmado = window.confirm(`Excluir a composicao ${linha.item_venda_codigo} -> ${linha.item_atende_codigo}?`);
  if (!confirmado) {
    return;
  }

  try {
    await fetchJson(`${composicoesApiBaseUrl}/${linha.id}`, {
      method: 'DELETE'
    });

    composicoesCache = composicoesCache.filter((entry) => Number(entry.id) !== Number(linha.id));
    renderizarComposicoes();
    if (Number(refs.composicaoId.value) === Number(linha.id)) {
      resetarFormulario();
      fecharModal();
    }
    mostrarMensagem('Composicao excluida com sucesso.', 'success');
  } catch (error) {
    mostrarMensagem(error.message || 'Nao foi possivel excluir a composicao.', 'error');
  }
}

function abrirModal() {
  refs.modal.classList.remove('hidden');
  refs.modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModal() {
  refs.modal.classList.add('hidden');
  refs.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function mostrarMensagem(texto, type = 'success') {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${type}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemFormulario(texto, type = 'error') {
  refs.formMessage.textContent = texto;
  refs.formMessage.className = `message ${type}`;
  refs.formMessage.classList.remove('hidden');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || 'Erro na comunicacao com o servidor.');
  }

  return data;
}

function normalizarBusca(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function formatDecimalInput(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : String(number).replace('.', ',');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
