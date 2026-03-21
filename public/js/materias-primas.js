// Script principal do modulo de materias-primas e de seus fornecedores vinculados.
const materiasPrimasApiBaseUrl = '/api/materias-primas';
const fornecedoresAutocompleteApiUrl = '/api/fornecedores-autocomplete';

let editingMateriaPrimaId = null;
let selectedMateriaPrimaId = null;
let editingVinculoId = null;
let fornecedoresCache = [];
let materiasPrimasCache = [];
let vinculosCache = [];
let filtroDebounceTimer = null;

const materiaPrimaForm = document.getElementById('materia-prima-form');
const materiaPrimaFiltroForm = document.getElementById('materia-prima-filtro-form');
const materiaPrimaMensagemBox = document.getElementById('materia-prima-mensagem');
const materiaPrimaModalMensagemBox = document.getElementById('materia-prima-modal-mensagem');
const materiaPrimaModal = document.getElementById('materia-prima-modal');
const materiaPrimaModalTitle = document.getElementById('materia-prima-modal-title');
const materiasPrimasTbody = document.getElementById('materias-primas-tbody');
const totalMateriasPrimas = document.getElementById('total-materias-primas');
const salvarMateriaPrimaButton = document.getElementById('btn-salvar-mp');
const atualizarMateriaPrimaButton = document.getElementById('btn-atualizar-mp');
const novaMateriaPrimaButton = document.getElementById('btn-nova-materia-prima');
const limparFiltrosMateriaPrimaButton = document.getElementById('btn-limpar-filtros-mp');
const cancelarModalMateriaPrimaButton = document.getElementById('btn-cancelar-modal-mp');
const fecharModalMateriaPrimaButton = document.getElementById('btn-fechar-modal-mp');
const mpFornecedoresModal = document.getElementById('mp-fornecedores-modal');
const mpFornecedoresMensagemBox = document.getElementById('mp-fornecedores-mensagem');
const mpFornecedoresTbody = document.getElementById('mp-fornecedores-tbody');
const mpFornecedorForm = document.getElementById('mp-fornecedor-form');
const mpFornecedorBuscaInput = document.getElementById('mp-fornecedor-busca');
const mpFornecedorIdInput = document.getElementById('mp-fornecedor-id');
const mpFornecedorVinculoIdInput = document.getElementById('mp-fornecedor-vinculo-id');
const mpFornecedorObservacaoInput = document.getElementById('mp-fornecedor-observacao');
const mpFornecedorSugestoes = document.getElementById('mp-fornecedor-sugestoes');
const salvarMpFornecedorButton = document.getElementById('btn-salvar-mp-fornecedor');
const atualizarMpFornecedorButton = document.getElementById('btn-atualizar-mp-fornecedor');
const limparMpFornecedorButton = document.getElementById('btn-limpar-mp-fornecedor');
const fecharModalMpFornecedoresButton = document.getElementById('btn-fechar-modal-mp-fornecedores');
const menuToggleButton = document.getElementById('menu-toggle');
const drawerCloseButton = document.getElementById('drawer-close');
const drawerScrim = document.getElementById('drawer-scrim');
const appDrawer = document.getElementById('app-drawer');

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await carregarFornecedoresAutocomplete();
  await carregarMateriasPrimas();
});

// Conecta os eventos das tabelas, modais, busca e menu lateral.
function bindEvents() {
  materiaPrimaForm.addEventListener('submit', handleCreateMateriaPrima);
  atualizarMateriaPrimaButton.addEventListener('click', handleUpdateMateriaPrima);
  novaMateriaPrimaButton.addEventListener('click', abrirNovaMateriaPrimaModal);
  limparFiltrosMateriaPrimaButton.addEventListener('click', limparFiltrosMateriaPrima);
  materiaPrimaFiltroForm.addEventListener('submit', handleFilterMateriaPrima);
  materiasPrimasTbody.addEventListener('click', handleMateriaPrimaTableActions);
  cancelarModalMateriaPrimaButton.addEventListener('click', fecharModalMateriaPrima);
  fecharModalMateriaPrimaButton.addEventListener('click', fecharModalMateriaPrima);
  materiaPrimaModal.addEventListener('click', handleModalBackdrop);
  mpFornecedoresModal.addEventListener('click', handleModalBackdrop);
  mpFornecedorForm.addEventListener('submit', handleCreateVinculoFornecedor);
  atualizarMpFornecedorButton.addEventListener('click', handleUpdateVinculoFornecedor);
  limparMpFornecedorButton.addEventListener('click', resetVinculoForm);
  mpFornecedoresTbody.addEventListener('click', handleVinculoTableActions);
  mpFornecedorBuscaInput.addEventListener('input', handleFornecedorBuscaInput);
  mpFornecedorBuscaInput.addEventListener('focus', handleFornecedorBuscaFocus);
  mpFornecedorSugestoes.addEventListener('click', handleFornecedorSugestaoClick);
  fecharModalMpFornecedoresButton.addEventListener('click', fecharModalFornecedores);
  menuToggleButton.addEventListener('click', abrirDrawer);
  drawerCloseButton.addEventListener('click', fecharDrawer);
  drawerScrim.addEventListener('click', fecharDrawer);
  document.addEventListener('click', handleClickForaDaBusca);
  document.addEventListener('keydown', handleKeyboardShortcuts);

  materiaPrimaFiltroForm.querySelectorAll('input').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
  });
}

async function carregarFornecedoresAutocomplete() {
  try {
    const response = await fetch(fornecedoresAutocompleteApiUrl);
    const fornecedores = await response.json();

    if (!response.ok) {
      throw new Error(fornecedores.message || 'Nao foi possivel carregar os fornecedores.');
    }

    fornecedoresCache = fornecedores;
  } catch (error) {
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

async function carregarMateriasPrimas() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-mp-codigo').value.trim();
  const nome = document.getElementById('filtro-mp-nome').value.trim();
  const geometria = document.getElementById('filtro-mp-geometria').value.trim();
  const bitola = document.getElementById('filtro-mp-bitola').value.trim();

  if (codigo) params.append('codigo', codigo);
  if (nome) params.append('nome', nome);
  if (geometria) params.append('geometria', geometria);
  if (bitola) params.append('bitola', bitola);

  try {
    const endpoint = params.toString() ? `${materiasPrimasApiBaseUrl}?${params}` : materiasPrimasApiBaseUrl;
    const response = await fetch(endpoint);
    const materiasPrimas = await response.json();

    if (!response.ok) {
      throw new Error(materiasPrimas.message || 'Nao foi possivel carregar as materias-primas.');
    }

    materiasPrimasCache = materiasPrimas;
    renderizarTabelaMateriasPrimas(materiasPrimas);
    atualizarIndicadores(materiasPrimas);
  } catch (error) {
    renderizarTabelaMateriasPrimas([]);
    atualizarIndicadores([]);
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarMateriasPrimas(), 220);
}

function abrirNovaMateriaPrimaModal() {
  resetMateriaPrimaForm();
  materiaPrimaModalTitle.textContent = 'Nova Materia-prima';
  abrirModal(materiaPrimaModal);
}

async function handleCreateMateriaPrima(event) {
  event.preventDefault();

  if (editingMateriaPrimaId) {
    mostrarMensagemModalMateriaPrima('Use o botao Atualizar para salvar a materia-prima em edicao.', 'error');
    return;
  }

  try {
    const response = await fetch(materiasPrimasApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadMateriaPrima())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    await carregarFornecedoresAutocomplete();
    fecharModalMateriaPrima();
    mostrarMensagemMateriaPrima('Materia-prima cadastrada com sucesso.', 'success');
    await carregarMateriasPrimas();
    await abrirModalFornecedores(result.id, 'Materia-prima cadastrada. Vincule um ou mais fornecedores.');
  } catch (error) {
    mostrarMensagemModalMateriaPrima(error.message, 'error');
  }
}

async function handleUpdateMateriaPrima() {
  if (!editingMateriaPrimaId) {
    mostrarMensagemModalMateriaPrima('Selecione uma materia-prima antes de atualizar.', 'error');
    return;
  }

  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${editingMateriaPrimaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadMateriaPrima())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalMateriaPrima();
    mostrarMensagemMateriaPrima('Materia-prima atualizada com sucesso.', 'success');
    await carregarMateriasPrimas();
  } catch (error) {
    mostrarMensagemModalMateriaPrima(error.message, 'error');
  }
}

function handleFilterMateriaPrima(event) {
  event.preventDefault();
  carregarMateriasPrimas();
}

function limparFiltrosMateriaPrima() {
  materiaPrimaFiltroForm.reset();
  carregarMateriasPrimas();
}

async function handleMateriaPrimaTableActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const materiaPrimaId = Number.parseInt(actionButton.dataset.id, 10);

  if (action === 'edit') {
    await carregarMateriaPrimaParaEdicao(materiaPrimaId);
  }

  if (action === 'fornecedores') {
    await abrirModalFornecedores(materiaPrimaId);
  }

  if (action === 'delete') {
    await excluirMateriaPrima(materiaPrimaId);
  }
}

function montarPayloadMateriaPrima() {
  return {
    codigo: document.getElementById('mp-codigo').value.trim(),
    nome: document.getElementById('mp-nome').value.trim(),
    geometria: document.getElementById('mp-geometria').value.trim(),
    bitola: document.getElementById('mp-bitola').value.trim(),
    peso_por_metro: document.getElementById('mp-peso-por-metro').value,
    estoque_minimo: document.getElementById('mp-estoque-minimo').value
  };
}

async function carregarMateriaPrimaParaEdicao(id) {
  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${id}`);
    const materiaPrima = await response.json();

    if (!response.ok) {
      throw new Error(materiaPrima.message || 'Nao foi possivel carregar a materia-prima.');
    }

    editingMateriaPrimaId = materiaPrima.id;
    document.getElementById('materia-prima-id').value = materiaPrima.id;
    document.getElementById('mp-codigo').value = materiaPrima.codigo;
    document.getElementById('mp-nome').value = materiaPrima.nome;
    document.getElementById('mp-geometria').value = materiaPrima.geometria;
    document.getElementById('mp-bitola').value = materiaPrima.bitola;
    document.getElementById('mp-peso-por-metro').value = Number(materiaPrima.peso_por_metro);
    document.getElementById('mp-estoque-minimo').value = Number(materiaPrima.estoque_minimo);
    atualizarMateriaPrimaButton.disabled = false;
    salvarMateriaPrimaButton.disabled = true;
    materiaPrimaModalTitle.textContent = `Editar ${materiaPrima.nome}`;
    abrirModal(materiaPrimaModal);
  } catch (error) {
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

async function excluirMateriaPrima(id) {
  if (!window.confirm('Deseja realmente excluir esta materia-prima?')) {
    return;
  }

  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel excluir a materia-prima.');
    }

    if (editingMateriaPrimaId === id) {
      fecharModalMateriaPrima();
    }

    if (selectedMateriaPrimaId === id) {
      fecharModalFornecedores();
    }

    mostrarMensagemMateriaPrima('Materia-prima excluida com sucesso.', 'success');
    await carregarMateriasPrimas();
  } catch (error) {
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

async function abrirModalFornecedores(id, mensagemInicial = '') {
  const response = await fetch(`${materiasPrimasApiBaseUrl}/${id}`);
  const materiaPrima = await response.json();

  if (!response.ok) {
    mostrarMensagemMateriaPrima(materiaPrima.message || 'Nao foi possivel carregar a materia-prima.', 'error');
    return;
  }

  selectedMateriaPrimaId = materiaPrima.id;
  await carregarFornecedoresAutocomplete();
  document.getElementById('mp-fornecedores-modal-title').textContent = `Fornecedores de ${materiaPrima.codigo}`;
  document.getElementById('mp-fornecedores-titulo').textContent = `${materiaPrima.codigo} - ${materiaPrima.nome}`;
  document.getElementById('mp-fornecedores-subtitulo').textContent = `${materiaPrima.geometria} | ${materiaPrima.bitola}`;
  resetVinculoForm();
  esconderMensagemMpFornecedores();
  await carregarVinculosFornecedor(id);
  abrirModal(mpFornecedoresModal);
  if (mensagemInicial) {
    mostrarMensagemMpFornecedores(mensagemInicial, 'success');
  }
}

async function carregarVinculosFornecedor(materiaPrimaId) {
  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${materiaPrimaId}/fornecedores`);
    const vinculos = await response.json();

    if (!response.ok) {
      throw new Error(vinculos.message || 'Nao foi possivel carregar os fornecedores vinculados.');
    }

    vinculosCache = vinculos;
    renderizarTabelaVinculos(vinculos);
  } catch (error) {
    vinculosCache = [];
    renderizarTabelaVinculos([]);
    mostrarMensagemMpFornecedores(error.message, 'error');
  }
}

async function handleCreateVinculoFornecedor(event) {
  event.preventDefault();

  if (!selectedMateriaPrimaId) {
    mostrarMensagemMpFornecedores('Abra uma materia-prima antes de vincular fornecedores.', 'error');
    return;
  }

  if (editingVinculoId) {
    mostrarMensagemMpFornecedores('Use o botao Atualizar para salvar o vinculo em edicao.', 'error');
    return;
  }

  const payload = montarPayloadVinculo();
  if (!payload) return;

  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${selectedMateriaPrimaId}/fornecedores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    resetVinculoForm();
    mostrarMensagemMpFornecedores('Fornecedor vinculado com sucesso.', 'success');
    await carregarVinculosFornecedor(selectedMateriaPrimaId);
  } catch (error) {
    mostrarMensagemMpFornecedores(error.message, 'error');
  }
}

async function handleUpdateVinculoFornecedor() {
  if (!selectedMateriaPrimaId || !editingVinculoId) {
    mostrarMensagemMpFornecedores('Selecione um vinculo antes de atualizar.', 'error');
    return;
  }

  const payload = montarPayloadVinculo();
  if (!payload) return;

  try {
    const response = await fetch(
      `${materiasPrimasApiBaseUrl}/${selectedMateriaPrimaId}/fornecedores/${editingVinculoId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    resetVinculoForm();
    mostrarMensagemMpFornecedores('Vinculo atualizado com sucesso.', 'success');
    await carregarVinculosFornecedor(selectedMateriaPrimaId);
  } catch (error) {
    mostrarMensagemMpFornecedores(error.message, 'error');
  }
}

async function handleVinculoTableActions(event) {
  const actionButton = event.target.closest('button[data-vinculo-action]');
  if (!actionButton) return;

  const action = actionButton.dataset.vinculoAction;
  const vinculoId = Number.parseInt(actionButton.dataset.vinculoId, 10);

  if (action === 'edit') {
    carregarVinculoParaEdicao(vinculoId);
  }

  if (action === 'delete') {
    await excluirVinculoFornecedor(vinculoId);
  }
}

function montarPayloadVinculo() {
  const fornecedorId = Number.parseInt(mpFornecedorIdInput.value, 10);

  if (!Number.isInteger(fornecedorId)) {
    mostrarMensagemMpFornecedores('Escolha um fornecedor valido na busca antes de salvar.', 'error');
    return null;
  }

  return {
    id_fornecedor: fornecedorId,
    observacao: mpFornecedorObservacaoInput.value.trim()
  };
}

function carregarVinculoParaEdicao(vinculoId) {
  const vinculo = vinculosCache.find((item) => Number(item.id) === Number(vinculoId));

  if (!vinculo) {
    mostrarMensagemMpFornecedores('Vinculo nao encontrado.', 'error');
    return;
  }

  editingVinculoId = vinculo.id;
  mpFornecedorVinculoIdInput.value = vinculo.id;
  mpFornecedorIdInput.value = vinculo.id_fornecedor;
  mpFornecedorBuscaInput.value = vinculo.fornecedor_nome;
  mpFornecedorObservacaoInput.value = vinculo.observacao ?? '';
  atualizarMpFornecedorButton.disabled = false;
  salvarMpFornecedorButton.disabled = true;
  esconderSugestoesFornecedor();
  mostrarMensagemMpFornecedores(`Editando o vinculo com ${vinculo.fornecedor_nome}.`, 'success');
}

async function excluirVinculoFornecedor(vinculoId) {
  if (!window.confirm('Deseja realmente excluir este vinculo?')) {
    return;
  }

  try {
    const response = await fetch(
      `${materiasPrimasApiBaseUrl}/${selectedMateriaPrimaId}/fornecedores/${vinculoId}`,
      { method: 'DELETE' }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel excluir o vinculo.');
    }

    if (editingVinculoId === vinculoId) {
      resetVinculoForm();
    }

    mostrarMensagemMpFornecedores('Vinculo excluido com sucesso.', 'success');
    await carregarVinculosFornecedor(selectedMateriaPrimaId);
  } catch (error) {
    mostrarMensagemMpFornecedores(error.message, 'error');
  }
}

function handleFornecedorBuscaInput() {
  mpFornecedorIdInput.value = '';
  renderizarSugestoesFornecedor(mpFornecedorBuscaInput.value.trim());
}

function handleFornecedorBuscaFocus() {
  renderizarSugestoesFornecedor(mpFornecedorBuscaInput.value.trim());
}

function handleFornecedorSugestaoClick(event) {
  const option = event.target.closest('button[data-fornecedor-id]');
  if (!option) return;

  mpFornecedorIdInput.value = option.dataset.fornecedorId;
  mpFornecedorBuscaInput.value = option.dataset.fornecedorNome;
  esconderSugestoesFornecedor();
}

function handleClickForaDaBusca(event) {
  if (!event.target.closest('.autocomplete')) {
    esconderSugestoesFornecedor();
  }
}

// Filtra fornecedores por nome, contato, telefone ou cidade.
function renderizarSugestoesFornecedor(term) {
  const filtro = term.toLowerCase();
  const fornecedoresFiltrados = fornecedoresCache.filter((fornecedor) => {
    if (!filtro) return true;

    return (
      String(fornecedor.nome).toLowerCase().includes(filtro) ||
      String(fornecedor.contato || '').toLowerCase().includes(filtro) ||
      String(fornecedor.telefone || '').toLowerCase().includes(filtro) ||
      String(fornecedor.cidade || '').toLowerCase().includes(filtro)
    );
  }).slice(0, 8);

  if (fornecedoresFiltrados.length === 0) {
    mpFornecedorSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum fornecedor encontrado para a busca informada.</div>';
    mpFornecedorSugestoes.classList.remove('hidden');
    return;
  }

  mpFornecedorSugestoes.innerHTML = fornecedoresFiltrados.map((fornecedor) => `
    <button type="button" class="autocomplete-option" data-fornecedor-id="${fornecedor.id}" data-fornecedor-nome="${escapeHtml(fornecedor.nome)}">
      <strong>${escapeHtml(fornecedor.nome)}</strong>
      <span>${escapeHtml(fornecedor.contato || '-')} | ${escapeHtml(fornecedor.telefone || '-')} | ${escapeHtml(fornecedor.cidade || '-')}</span>
    </button>
  `).join('');
  mpFornecedorSugestoes.classList.remove('hidden');
}

function esconderSugestoesFornecedor() {
  mpFornecedorSugestoes.classList.add('hidden');
  mpFornecedorSugestoes.innerHTML = '';
}

function resetMateriaPrimaForm() {
  materiaPrimaForm.reset();
  editingMateriaPrimaId = null;
  document.getElementById('materia-prima-id').value = '';
  atualizarMateriaPrimaButton.disabled = true;
  salvarMateriaPrimaButton.disabled = false;
  esconderMensagemModalMateriaPrima();
}

function resetVinculoForm() {
  mpFornecedorForm.reset();
  editingVinculoId = null;
  mpFornecedorVinculoIdInput.value = '';
  mpFornecedorIdInput.value = '';
  atualizarMpFornecedorButton.disabled = true;
  salvarMpFornecedorButton.disabled = false;
  esconderSugestoesFornecedor();
}

function abrirModal(modalElement) {
  modalElement.classList.remove('hidden');
  modalElement.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModalMateriaPrima() {
  resetMateriaPrimaForm();
  materiaPrimaModal.classList.add('hidden');
  materiaPrimaModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function fecharModalFornecedores() {
  selectedMateriaPrimaId = null;
  vinculosCache = [];
  resetVinculoForm();
  esconderMensagemMpFornecedores();
  mpFornecedoresTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Abra uma materia-prima para visualizar os fornecedores vinculados.</td></tr>';
  mpFornecedoresModal.classList.add('hidden');
  mpFornecedoresModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'materia-prima') {
    fecharModalMateriaPrima();
  }

  if (event.target.dataset.closeModal === 'mp-fornecedores') {
    fecharModalFornecedores();
  }
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
    esconderSugestoesFornecedor();

    if (!materiaPrimaModal.classList.contains('hidden')) {
      fecharModalMateriaPrima();
    }

    if (!mpFornecedoresModal.classList.contains('hidden')) {
      fecharModalFornecedores();
    }

    if (appDrawer.classList.contains('is-open')) {
      fecharDrawer();
    }
  }
}

function renderizarTabelaMateriasPrimas(materiasPrimas) {
  totalMateriasPrimas.textContent = `${materiasPrimas.length} registro(s) encontrado(s)`;

  if (materiasPrimas.length === 0) {
    materiasPrimasTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma materia-prima encontrada para os filtros informados.</td></tr>';
    return;
  }

  materiasPrimasTbody.innerHTML = materiasPrimas.map((materiaPrima) => `
    <tr>
      <td class="table-code">${escapeHtml(materiaPrima.codigo)}</td>
      <td class="table-description">${escapeHtml(materiaPrima.nome)}</td>
      <td>${escapeHtml(materiaPrima.geometria)}</td>
      <td>${escapeHtml(materiaPrima.bitola)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="edit" data-id="${materiaPrima.id}">Editar</button>
            <button type="button" class="row-menu-item" data-action="fornecedores" data-id="${materiaPrima.id}">Fornecedores</button>
            <button type="button" class="row-menu-item danger" data-action="delete" data-id="${materiaPrima.id}">Excluir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function renderizarTabelaVinculos(vinculos) {
  if (vinculos.length === 0) {
    mpFornecedoresTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum fornecedor vinculado a esta materia-prima.</td></tr>';
    return;
  }

  mpFornecedoresTbody.innerHTML = vinculos.map((vinculo) => `
    <tr>
      <td class="table-description">${escapeHtml(vinculo.fornecedor_nome)}</td>
      <td>${escapeHtml(vinculo.fornecedor_contato || '-')}</td>
      <td>${escapeHtml(vinculo.fornecedor_telefone || '-')}</td>
      <td>${escapeHtml(vinculo.observacao || '-')}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-vinculo-action="edit" data-vinculo-id="${vinculo.id}">Editar</button>
            <button type="button" class="row-menu-item danger" data-vinculo-action="delete" data-vinculo-id="${vinculo.id}">Excluir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores(materiasPrimas) {
  const geometrias = new Set(materiasPrimas.map((item) => item.geometria)).size;
  const pesoMedio = materiasPrimas.length > 0
    ? materiasPrimas.reduce((acc, item) => acc + Number(item.peso_por_metro), 0) / materiasPrimas.length
    : 0;

  document.getElementById('metric-total-materias-primas').textContent = String(materiasPrimas.length);
  document.getElementById('metric-geometrias').textContent = String(geometrias);
  document.getElementById('metric-peso-medio').textContent = formatarNumero(pesoMedio, 4);
}

function mostrarMensagemMateriaPrima(texto, tipo) {
  materiaPrimaMensagemBox.textContent = texto;
  materiaPrimaMensagemBox.className = `message ${tipo}`;
  materiaPrimaMensagemBox.classList.remove('hidden');
}

function mostrarMensagemModalMateriaPrima(texto, tipo) {
  materiaPrimaModalMensagemBox.textContent = texto;
  materiaPrimaModalMensagemBox.className = `message ${tipo}`;
  materiaPrimaModalMensagemBox.classList.remove('hidden');
}

function esconderMensagemModalMateriaPrima() {
  materiaPrimaModalMensagemBox.className = 'message hidden';
  materiaPrimaModalMensagemBox.textContent = '';
}

function mostrarMensagemMpFornecedores(texto, tipo) {
  mpFornecedoresMensagemBox.textContent = texto;
  mpFornecedoresMensagemBox.className = `message ${tipo}`;
  mpFornecedoresMensagemBox.classList.remove('hidden');
}

function esconderMensagemMpFornecedores() {
  mpFornecedoresMensagemBox.className = 'message hidden';
  mpFornecedoresMensagemBox.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function formatarNumero(valor, casasDecimais) {
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais
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
