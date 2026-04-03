// Script principal da tela compacta de pecas.
const apiBaseUrl = '/api/pecas';
const cadastroOptionsApiUrl = '/api/opcoes-cadastro';

let editingId = null;
let filtroDebounceTimer = null;
let selectedFornecedorIds = [];
let cadastroOptionsCache = {
  materias_primas: [],
  fornecedores: [],
  maquinas: []
};

const form = document.getElementById('peca-form');
const filtroForm = document.getElementById('filtro-form');
const mensagemBox = document.getElementById('mensagem');
const modalMensagemBox = document.getElementById('peca-modal-mensagem');
const tabelaBody = document.getElementById('pecas-tbody');
const totalRegistros = document.getElementById('total-registros');
const salvarButton = document.getElementById('btn-salvar');
const atualizarButton = document.getElementById('btn-atualizar');
const novaPecaButton = document.getElementById('btn-nova-peca');
const limparFiltrosButton = document.getElementById('btn-limpar-filtros');
const cancelarModalButton = document.getElementById('btn-cancelar-modal-peca');
const fecharModalButton = document.getElementById('btn-fechar-modal-peca');
const pecaModal = document.getElementById('peca-modal');
const menuToggleButton = document.getElementById('menu-toggle');
const drawerCloseButton = document.getElementById('drawer-close');
const drawerScrim = document.getElementById('drawer-scrim');
const appDrawer = document.getElementById('app-drawer');
const materiaPrimaIdInput = document.getElementById('id-materia-prima');
const fornecedorIdInput = document.getElementById('id-fornecedor');
const maquinaIdInput = document.getElementById('id-maquina');
const fornecedorSelect = document.getElementById('fornecedor-select');
const adicionarFornecedorButton = document.getElementById('btn-adicionar-fornecedor-peca');
const fornecedoresLista = document.getElementById('peca-fornecedores-lista');
const buscaMateriaPrimaInput = document.getElementById('busca-materia-prima');
const buscaMaquinaInput = document.getElementById('busca-maquina');
const sugestoesMateriaPrima = document.getElementById('sugestoes-materia-prima');
const sugestoesMaquina = document.getElementById('sugestoes-maquina');

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await carregarOpcoesCadastro();
  await carregarPecas();
});

// Conecta os eventos do menu, modal, filtros e autocompletes.
function bindEvents() {
  form.addEventListener('submit', handleCreate);
  atualizarButton.addEventListener('click', handleUpdate);
  novaPecaButton.addEventListener('click', abrirNovaPecaModal);
  cancelarModalButton.addEventListener('click', fecharModalPeca);
  fecharModalButton.addEventListener('click', fecharModalPeca);
  filtroForm.addEventListener('submit', handleFilter);
  limparFiltrosButton.addEventListener('click', clearFilters);
  tabelaBody.addEventListener('click', handleTableActions);
  adicionarFornecedorButton.addEventListener('click', adicionarFornecedorSelecionado);
  fornecedoresLista.addEventListener('click', handleFornecedorChipClick);
  menuToggleButton.addEventListener('click', abrirDrawer);
  drawerCloseButton.addEventListener('click', fecharDrawer);
  drawerScrim.addEventListener('click', fecharDrawer);
  pecaModal.addEventListener('click', handleModalBackdrop);
  document.addEventListener('keydown', handleKeyboardShortcuts);
  bindAutoFilterEvents();
  bindAutocompleteEvents();
}

function bindAutoFilterEvents() {
  filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
}

// Campos pesquisaveis dos relacionamentos da peca.
function bindAutocompleteEvents() {
  buscaMateriaPrimaInput.addEventListener('input', () => {
    materiaPrimaIdInput.value = '';
    renderizarSugestoes('materia-prima', buscaMateriaPrimaInput.value.trim());
  });
  buscaMaquinaInput.addEventListener('input', () => {
    maquinaIdInput.value = '';
    renderizarSugestoes('maquina', buscaMaquinaInput.value.trim());
  });
  buscaMateriaPrimaInput.addEventListener('focus', () => renderizarSugestoes('materia-prima', buscaMateriaPrimaInput.value.trim()));
  buscaMaquinaInput.addEventListener('focus', () => renderizarSugestoes('maquina', buscaMaquinaInput.value.trim()));
  sugestoesMateriaPrima.addEventListener('click', (event) => handleSugestaoClick(event, 'materia-prima'));
  sugestoesMaquina.addEventListener('click', (event) => handleSugestaoClick(event, 'maquina'));
  document.addEventListener('click', handleClickForaDoAutocomplete);
}

// Carrega materia-prima, fornecedor e maquina do banco.
async function carregarOpcoesCadastro() {
  try {
    const response = await fetch(cadastroOptionsApiUrl);
    const opcoes = await response.json();

    if (!response.ok) {
      throw new Error(opcoes.message || 'Nao foi possivel carregar as opcoes do cadastro.');
    }

    cadastroOptionsCache = opcoes;
    preencherFiltrosRelacionamento();
    preencherFornecedorSelect();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

async function carregarPecas() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-codigo').value.trim();
  const descricao = document.getElementById('filtro-descricao').value.trim();
  const idMateriaPrima = document.getElementById('filtro-materia-prima').value;
  const idFornecedor = document.getElementById('filtro-fornecedor').value;
  const idMaquina = document.getElementById('filtro-maquina').value;
  if (codigo) params.append('codigo', codigo);
  if (descricao) params.append('descricao', descricao);
  if (idMateriaPrima) params.append('id_materia_prima', idMateriaPrima);
  if (idFornecedor) params.append('id_fornecedor', idFornecedor);
  if (idMaquina) params.append('id_maquina', idMaquina);

  try {
    const endpoint = params.toString() ? `${apiBaseUrl}?${params}` : apiBaseUrl;
    const response = await fetch(endpoint);
    const pecas = await response.json();
    if (!response.ok) throw new Error(pecas.message || 'Nao foi possivel carregar as pecas.');
    renderizarTabela(pecas);
    atualizarIndicadores(pecas);
  } catch (error) {
    renderizarTabela([]);
    atualizarIndicadores([]);
    mostrarMensagem(error.message, 'error');
  }
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarPecas(), 220);
}

function abrirNovaPecaModal() {
  resetForm();
  document.getElementById('peca-modal-title').textContent = 'Nova Peca';
  abrirModalPeca();
}

async function handleCreate(event) {
  event.preventDefault();
  if (editingId) {
    mostrarMensagemModal('Use o botao Atualizar para salvar a peca em edicao.', 'error');
    return;
  }

  try {
    const response = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadDoFormulario())
    });
    const result = await response.json();
    if (!response.ok) throw new Error(extractErrorMessage(result));
    fecharModalPeca();
    mostrarMensagem('Peca cadastrada com sucesso.', 'success');
    await carregarPecas();
  } catch (error) {
    mostrarMensagemModal(error.message, 'error');
  }
}

async function handleUpdate() {
  if (!editingId) {
    mostrarMensagemModal('Selecione uma peca na tabela antes de atualizar.', 'error');
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadDoFormulario())
    });
    const result = await response.json();
    if (!response.ok) throw new Error(extractErrorMessage(result));
    fecharModalPeca();
    mostrarMensagem('Peca atualizada com sucesso.', 'success');
    await carregarPecas();
  } catch (error) {
    mostrarMensagemModal(error.message, 'error');
  }
}

function handleFilter(event) {
  event.preventDefault();
  carregarPecas();
}

function clearFilters() {
  filtroForm.reset();
  carregarPecas();
}

function preencherFiltrosRelacionamento() {
  preencherSelectFiltro(
    document.getElementById('filtro-materia-prima'),
    cadastroOptionsCache.materias_primas,
    'Todas',
    (item) => `${item.codigo} - ${item.nome}`
  );
  preencherSelectFiltro(
    document.getElementById('filtro-fornecedor'),
    cadastroOptionsCache.fornecedores,
    'Todos',
    (item) => item.nome
  );
  preencherSelectFiltro(
    document.getElementById('filtro-maquina'),
    cadastroOptionsCache.maquinas,
    'Todas',
    (item) => item.nome
  );
}

function preencherFornecedorSelect() {
  const valorAtual = fornecedorSelect.value;
  fornecedorSelect.innerHTML = `
    <option value="">Selecione</option>
    ${cadastroOptionsCache.fornecedores.map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}</option>`).join('')}
  `;
  fornecedorSelect.value = valorAtual;
}

function preencherSelectFiltro(selectElement, itens, placeholder, labelBuilder) {
  const valorAtual = selectElement.value;
  selectElement.innerHTML = `
    <option value="">${placeholder}</option>
    ${itens.map((item) => `<option value="${item.id}">${escapeHtml(labelBuilder(item))}</option>`).join('')}
  `;
  selectElement.value = valorAtual;
}

async function handleTableActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  const pecaId = Number.parseInt(actionButton.dataset.id, 10);
  if (action === 'edit') await carregarPecaParaEdicao(pecaId);
  if (action === 'delete') await excluirPeca(pecaId);
}

function montarPayloadDoFormulario() {
  const comprimento = parseOptionalNumber(document.getElementById('comprimento').value);
  const unidadeComprimento = document.getElementById('unidade-comprimento').value;
  const massa = parseOptionalNumber(document.getElementById('massa').value);
  const unidadeMassa = document.getElementById('unidade-massa').value;

  return {
    codigo: document.getElementById('codigo').value.trim(),
    descricao: document.getElementById('descricao').value.trim(),
    comprimento_mm: converterComprimentoParaMm(comprimento, unidadeComprimento),
    tipo: document.getElementById('tipo').value,
    id_materia_prima: normalizeOptionalValue(materiaPrimaIdInput.value),
    id_fornecedor: normalizeOptionalValue(fornecedorIdInput.value),
    fornecedores: selectedFornecedorIds,
    id_maquina: normalizeOptionalValue(maquinaIdInput.value),
    estoque_minimo: normalizeOptionalValue(document.getElementById('estoque-minimo').value),
    estoque_seguranca: normalizeOptionalValue(document.getElementById('estoque-seguranca').value),
    consumo_mensal: normalizeOptionalValue(document.getElementById('consumo-mensal').value),
    massa_kg: converterMassaParaKg(massa, unidadeMassa)
  };
}

async function carregarPecaParaEdicao(id) {
  try {
    const [response, fornecedoresResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/${id}`),
      fetch(`${apiBaseUrl}/${id}/fornecedores`)
    ]);
    const peca = await response.json();
    const fornecedores = await fornecedoresResponse.json();
    if (!response.ok) throw new Error(peca.message || 'Nao foi possivel carregar a peca.');
    if (!fornecedoresResponse.ok) throw new Error(fornecedores.message || 'Nao foi possivel carregar os fornecedores da peca.');

    editingId = peca.id;
    document.getElementById('peca-id').value = peca.id;
    document.getElementById('codigo').value = peca.codigo;
    document.getElementById('descricao').value = peca.descricao;
    document.getElementById('comprimento').value = formatOptionalNumber(peca.comprimento_mm);
    document.getElementById('unidade-comprimento').value = 'mm';
    document.getElementById('tipo').value = peca.tipo;
    preencherCampoRelacionamento('materia-prima', peca.id_materia_prima);
    preencherCampoRelacionamento('maquina', peca.id_maquina);
    selectedFornecedorIds = fornecedores.map((item) => Number(item.id_fornecedor));
    if (selectedFornecedorIds.length === 0 && peca.id_fornecedor) {
      selectedFornecedorIds = [Number(peca.id_fornecedor)];
    }
    sincronizarFornecedorPrincipal();
    renderizarFornecedoresSelecionados();
    document.getElementById('estoque-minimo').value = formatOptionalNumber(peca.estoque_minimo);
    document.getElementById('estoque-seguranca').value = formatOptionalNumber(peca.estoque_seguranca);
    document.getElementById('consumo-mensal').value = formatOptionalNumber(peca.consumo_mensal);
    document.getElementById('massa').value = formatOptionalNumber(peca.massa_kg);
    document.getElementById('unidade-massa').value = 'kg';
    atualizarButton.disabled = false;
    salvarButton.disabled = true;
    document.getElementById('peca-modal-title').textContent = `Editar ${peca.codigo}`;
    abrirModalPeca();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

async function excluirPeca(id) {
  if (!window.confirm('Deseja realmente excluir esta peca?')) return;

  try {
    const response = await fetch(`${apiBaseUrl}/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(buildDeleteErrorMessage(result));
    }
    if (editingId === id) fecharModalPeca();
    mostrarMensagem('Peca excluida com sucesso.', 'success');
    await carregarPecas();
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

// Preenche o campo pesquisÃ¡vel com base no ID salvo no banco.
function preencherCampoRelacionamento(tipo, id) {
  const config = getAutocompleteConfig(tipo);
  const item = config.lista.find((registro) => Number(registro.id) === Number(id));
  config.hidden.value = id ?? '';
  config.input.value = item ? config.label(item) : (id ? `ID ${id}` : '');
}

function resetForm() {
  form.reset();
  editingId = null;
  document.getElementById('peca-id').value = '';
  document.getElementById('unidade-comprimento').value = 'mm';
  document.getElementById('unidade-massa').value = 'kg';
  materiaPrimaIdInput.value = '';
  fornecedorIdInput.value = '';
  maquinaIdInput.value = '';
  selectedFornecedorIds = [];
  buscaMateriaPrimaInput.value = '';
  buscaMaquinaInput.value = '';
  fornecedorSelect.value = '';
  renderizarFornecedoresSelecionados();
  atualizarButton.disabled = true;
  salvarButton.disabled = false;
  esconderMensagemModal();
  esconderTodasSugestoes();
}

function abrirModalPeca() {
  pecaModal.classList.remove('hidden');
  pecaModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModalPeca() {
  resetForm();
  pecaModal.classList.add('hidden');
  pecaModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'peca') fecharModalPeca();
}

function abrirDrawer() {
  appDrawer.classList.add('is-open');
  drawerScrim.classList.remove('hidden');
  document.body.classList.add('has-drawer');
}

function fecharDrawer() {
  appDrawer.classList.remove('is-open');
  drawerScrim.classList.add('hidden');
  document.body.classList.remove('has-drawer');
}

function handleKeyboardShortcuts(event) {
  if (event.key === 'Escape') {
    esconderTodasSugestoes();
    if (!pecaModal.classList.contains('hidden')) fecharModalPeca();
    if (appDrawer.classList.contains('is-open')) fecharDrawer();
  }
}

// Filtra os relacionamentos digitando, sem select gigante.
function renderizarSugestoes(tipo, termo) {
  const config = getAutocompleteConfig(tipo);
  const filtro = termo.toLowerCase();
  const itens = config.lista.filter((item) => {
    if (!filtro) return true;
    return config.search(item).includes(filtro);
  }).slice(0, 8);

  if (itens.length === 0) {
    config.panel.innerHTML = '<div class="autocomplete-empty">Nenhum registro encontrado para a busca informada.</div>';
    config.panel.classList.remove('hidden');
    return;
  }

  config.panel.innerHTML = itens.map((item) => `
    <button type="button" class="autocomplete-option" data-id="${item.id}" data-tipo="${tipo}">
      <strong>${escapeHtml(config.label(item))}</strong>
      <span>${escapeHtml(config.secondary(item))}</span>
    </button>
  `).join('');
  config.panel.classList.remove('hidden');
}

function handleSugestaoClick(event, tipo) {
  const option = event.target.closest('button[data-id]');
  if (!option) return;
  const config = getAutocompleteConfig(tipo);
  const item = config.lista.find((registro) => Number(registro.id) === Number(option.dataset.id));
  if (!item) return;
  config.hidden.value = item.id;
  config.input.value = config.label(item);
  config.panel.classList.add('hidden');
  config.panel.innerHTML = '';
}

function handleClickForaDoAutocomplete(event) {
  if (!event.target.closest('.autocomplete')) esconderTodasSugestoes();
}

function esconderTodasSugestoes() {
  [sugestoesMateriaPrima, sugestoesMaquina].forEach((panel) => {
    panel.classList.add('hidden');
    panel.innerHTML = '';
  });
}

function getAutocompleteConfig(tipo) {
  if (tipo === 'materia-prima') {
    return {
      lista: cadastroOptionsCache.materias_primas,
      input: buscaMateriaPrimaInput,
      hidden: materiaPrimaIdInput,
      panel: sugestoesMateriaPrima,
      label: (item) => `${item.codigo} - ${item.nome}`,
      secondary: (item) => `${item.geometria} | ${item.bitola}`,
      search: (item) => `${item.codigo || ''} ${item.nome} ${item.geometria} ${item.bitola}`.toLowerCase()
    };
  }

  return {
    lista: cadastroOptionsCache.maquinas,
    input: buscaMaquinaInput,
    hidden: maquinaIdInput,
    panel: sugestoesMaquina,
    label: (item) => item.nome,
    secondary: (item) => item.tipo,
    search: (item) => `${item.nome} ${item.tipo}`.toLowerCase()
  };
}

function adicionarFornecedorSelecionado() {
  const fornecedorId = Number.parseInt(fornecedorSelect.value, 10);

  if (!Number.isInteger(fornecedorId)) {
    return mostrarMensagemModal('Selecione um fornecedor antes de adicionar.', 'error');
  }

  if (selectedFornecedorIds.includes(fornecedorId)) {
    return mostrarMensagemModal('Esse fornecedor ja foi adicionado.', 'error');
  }

  selectedFornecedorIds.push(fornecedorId);
  sincronizarFornecedorPrincipal();
  renderizarFornecedoresSelecionados();
  esconderMensagemModal();
}

function handleFornecedorChipClick(event) {
  const removeButton = event.target.closest('button[data-remove-fornecedor-id]');
  if (!removeButton) return;

  const fornecedorId = Number.parseInt(removeButton.dataset.removeFornecedorId, 10);
  selectedFornecedorIds = selectedFornecedorIds.filter((id) => id !== fornecedorId);
  sincronizarFornecedorPrincipal();
  renderizarFornecedoresSelecionados();
}

function sincronizarFornecedorPrincipal() {
  fornecedorIdInput.value = selectedFornecedorIds.length > 0 ? String(selectedFornecedorIds[0]) : '';
}

function renderizarFornecedoresSelecionados() {
  if (selectedFornecedorIds.length === 0) {
    fornecedoresLista.className = 'span-12 selected-tags empty';
    fornecedoresLista.innerHTML = '<span>Nenhum fornecedor selecionado.</span>';
    return;
  }

  fornecedoresLista.className = 'span-12 selected-tags';
  fornecedoresLista.innerHTML = selectedFornecedorIds
    .map((fornecedorId) => cadastroOptionsCache.fornecedores.find((item) => Number(item.id) === fornecedorId))
    .filter(Boolean)
    .map((fornecedor) => `
      <span class="selected-tag">
        ${escapeHtml(fornecedor.nome)}
        <button type="button" data-remove-fornecedor-id="${fornecedor.id}" aria-label="Remover fornecedor">X</button>
      </span>
    `)
    .join('');
}

function renderizarTabela(pecas) {
  totalRegistros.textContent = `${pecas.length} registro(s) encontrado(s)`;
  if (pecas.length === 0) {
    tabelaBody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma peca encontrada para os filtros informados.</td></tr>';
    return;
  }

  tabelaBody.innerHTML = pecas.map((peca) => `
    <tr>
      <td class="table-code">${escapeHtml(peca.codigo)}</td>
      <td class="table-description">${escapeHtml(peca.descricao)}</td>
      <td>${formatMetricValue(peca.estoque_minimo)}</td>
      <td>${formatMetricValue(peca.consumo_mensal)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="edit" data-id="${peca.id}">Editar</button>
            <button type="button" class="row-menu-item danger" data-action="delete" data-id="${peca.id}">Excluir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores(pecas) {
  const compradas = pecas.filter((peca) => peca.tipo === 'COMPRADA').length;
  const produzidas = pecas.filter((peca) => peca.tipo === 'PRODUZIDA').length;
  document.getElementById('metric-total-pecas').textContent = String(pecas.length);
  document.getElementById('metric-compradas').textContent = String(compradas);
  document.getElementById('metric-produzidas').textContent = String(produzidas);
}

function mostrarMensagem(texto, tipo) {
  mensagemBox.textContent = texto;
  mensagemBox.className = `message ${tipo}`;
  mensagemBox.classList.remove('hidden');
}

function mostrarMensagemModal(texto, tipo) {
  modalMensagemBox.textContent = texto;
  modalMensagemBox.className = `message ${tipo}`;
  modalMensagemBox.classList.remove('hidden');
}

function esconderMensagemModal() {
  modalMensagemBox.className = 'message hidden';
  modalMensagemBox.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) return result.errors.join(' ');
  return result.message || 'Operacao nao concluida.';
}

// Monta uma mensagem mais clara quando a peca esta em uso em submontagens.
function buildDeleteErrorMessage(result) {
  const baseMessage = result.message || 'Nao foi possivel excluir a peca.';

  if (!Array.isArray(result.submontagens) || result.submontagens.length === 0) {
    return baseMessage;
  }

  const lista = result.submontagens
    .slice(0, 6)
    .map((submontagem) => `${submontagem.codigo} (${submontagem.descricao})`)
    .join(', ');

  const complemento = result.submontagens.length > 6 ? '...' : '';
  return `${baseMessage} Vinculada em: ${lista}${complemento}`;
}

function converterComprimentoParaMm(value, unit) {
  if (!Number.isFinite(value)) return value;
  return unit === 'm' ? value * 1000 : value;
}

function converterMassaParaKg(value, unit) {
  if (!Number.isFinite(value)) return value;
  return unit === 'g' ? value / 1000 : value;
}

function normalizeOptionalValue(value) {
  return value === '' ? null : value;
}

function parseOptionalNumber(value) {
  if (value === '') return null;
  return Number.parseFloat(value);
}

function formatOptionalNumber(value) {
  return value === null || value === undefined ? '' : Number(value);
}

function formatMetricValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
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
