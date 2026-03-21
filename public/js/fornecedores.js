// Script principal do modulo de fornecedores.
const fornecedoresApiBaseUrl = '/api/fornecedores';

let editingFornecedorId = null;
let filtroDebounceTimer = null;

const fornecedorForm = document.getElementById('fornecedor-form');
const fornecedorFiltroForm = document.getElementById('fornecedor-filtro-form');
const fornecedorMensagemBox = document.getElementById('fornecedor-mensagem');
const fornecedorModalMensagemBox = document.getElementById('fornecedor-modal-mensagem');
const fornecedoresTbody = document.getElementById('fornecedores-tbody');
const totalFornecedores = document.getElementById('total-fornecedores');
const salvarFornecedorButton = document.getElementById('btn-salvar-fornecedor');
const atualizarFornecedorButton = document.getElementById('btn-atualizar-fornecedor');
const novoFornecedorButton = document.getElementById('btn-novo-fornecedor');
const limparFiltrosFornecedorButton = document.getElementById('btn-limpar-filtros-fornecedor');
const cancelarModalFornecedorButton = document.getElementById('btn-cancelar-modal-fornecedor');
const fecharModalFornecedorButton = document.getElementById('btn-fechar-modal-fornecedor');
const fornecedorModal = document.getElementById('fornecedor-modal');
const menuToggleButton = document.getElementById('menu-toggle');
const drawerCloseButton = document.getElementById('drawer-close');
const drawerScrim = document.getElementById('drawer-scrim');
const appDrawer = document.getElementById('app-drawer');

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  carregarFornecedores();
});

// Conecta os eventos da tela, do modal e do menu lateral.
function bindEvents() {
  fornecedorForm.addEventListener('submit', handleCreateFornecedor);
  atualizarFornecedorButton.addEventListener('click', handleUpdateFornecedor);
  novoFornecedorButton.addEventListener('click', abrirNovoFornecedorModal);
  limparFiltrosFornecedorButton.addEventListener('click', limparFiltrosFornecedor);
  fornecedorFiltroForm.addEventListener('submit', handleFilterFornecedor);
  fornecedoresTbody.addEventListener('click', handleFornecedorTableActions);
  cancelarModalFornecedorButton.addEventListener('click', fecharModalFornecedor);
  fecharModalFornecedorButton.addEventListener('click', fecharModalFornecedor);
  fornecedorModal.addEventListener('click', handleModalBackdrop);
  menuToggleButton.addEventListener('click', abrirDrawer);
  drawerCloseButton.addEventListener('click', fecharDrawer);
  drawerScrim.addEventListener('click', fecharDrawer);
  document.addEventListener('keydown', handleKeyboardShortcuts);

  fornecedorFiltroForm.querySelectorAll('input').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
  });
}

// Busca os fornecedores com filtros opcionais.
async function carregarFornecedores() {
  const params = new URLSearchParams();
  const nome = document.getElementById('filtro-fornecedor-nome').value.trim();
  const contato = document.getElementById('filtro-fornecedor-contato').value.trim();
  const cidade = document.getElementById('filtro-fornecedor-cidade').value.trim();

  if (nome) params.append('nome', nome);
  if (contato) params.append('contato', contato);
  if (cidade) params.append('cidade', cidade);

  try {
    const endpoint = params.toString() ? `${fornecedoresApiBaseUrl}?${params}` : fornecedoresApiBaseUrl;
    const response = await fetch(endpoint);
    const fornecedores = await response.json();

    if (!response.ok) {
      throw new Error(fornecedores.message || 'Nao foi possivel carregar os fornecedores.');
    }

    renderizarTabelaFornecedores(fornecedores);
    atualizarIndicadores(fornecedores);
  } catch (error) {
    renderizarTabelaFornecedores([]);
    atualizarIndicadores([]);
    mostrarMensagemFornecedor(error.message, 'error');
  }
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarFornecedores(), 220);
}

// Abre o modal para novo fornecedor.
function abrirNovoFornecedorModal() {
  resetFornecedorForm();
  document.getElementById('fornecedor-modal-title').textContent = 'Novo Fornecedor';
  abrirModalFornecedor();
}

async function handleCreateFornecedor(event) {
  event.preventDefault();

  if (editingFornecedorId) {
    mostrarMensagemModalFornecedor('Use o botao Atualizar para salvar o fornecedor em edicao.', 'error');
    return;
  }

  try {
    const response = await fetch(fornecedoresApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadFornecedor())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalFornecedor();
    mostrarMensagemFornecedor('Fornecedor cadastrado com sucesso.', 'success');
    await carregarFornecedores();
  } catch (error) {
    mostrarMensagemModalFornecedor(error.message, 'error');
  }
}

async function handleUpdateFornecedor() {
  if (!editingFornecedorId) {
    mostrarMensagemModalFornecedor('Selecione um fornecedor antes de atualizar.', 'error');
    return;
  }

  try {
    const response = await fetch(`${fornecedoresApiBaseUrl}/${editingFornecedorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadFornecedor())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalFornecedor();
    mostrarMensagemFornecedor('Fornecedor atualizado com sucesso.', 'success');
    await carregarFornecedores();
  } catch (error) {
    mostrarMensagemModalFornecedor(error.message, 'error');
  }
}

function handleFilterFornecedor(event) {
  event.preventDefault();
  carregarFornecedores();
}

function limparFiltrosFornecedor() {
  fornecedorFiltroForm.reset();
  carregarFornecedores();
}

// Trata as acoes da tabela via menu de tres pontinhos.
async function handleFornecedorTableActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const fornecedorId = Number.parseInt(actionButton.dataset.id, 10);

  if (action === 'edit') {
    await carregarFornecedorParaEdicao(fornecedorId);
  }

  if (action === 'delete') {
    await excluirFornecedor(fornecedorId);
  }
}

function montarPayloadFornecedor() {
  return {
    nome: document.getElementById('fornecedor-nome').value.trim(),
    telefone: document.getElementById('fornecedor-telefone').value.trim(),
    contato: document.getElementById('fornecedor-contato').value.trim(),
    email: document.getElementById('fornecedor-email').value.trim(),
    cep: document.getElementById('fornecedor-cep').value.trim(),
    endereco: document.getElementById('fornecedor-endereco').value.trim(),
    cidade: document.getElementById('fornecedor-cidade').value.trim(),
    observacao: document.getElementById('fornecedor-observacao').value.trim()
  };
}

// Carrega um fornecedor no modal de edicao.
async function carregarFornecedorParaEdicao(id) {
  try {
    const response = await fetch(`${fornecedoresApiBaseUrl}/${id}`);
    const fornecedor = await response.json();

    if (!response.ok) {
      throw new Error(fornecedor.message || 'Nao foi possivel carregar o fornecedor.');
    }

    editingFornecedorId = fornecedor.id;
    document.getElementById('fornecedor-id').value = fornecedor.id;
    document.getElementById('fornecedor-nome').value = fornecedor.nome;
    document.getElementById('fornecedor-telefone').value = fornecedor.telefone ?? '';
    document.getElementById('fornecedor-contato').value = fornecedor.contato ?? '';
    document.getElementById('fornecedor-email').value = fornecedor.email ?? '';
    document.getElementById('fornecedor-cep').value = fornecedor.cep ?? '';
    document.getElementById('fornecedor-endereco').value = fornecedor.endereco ?? '';
    document.getElementById('fornecedor-cidade').value = fornecedor.cidade ?? '';
    document.getElementById('fornecedor-observacao').value = fornecedor.observacao ?? '';
    atualizarFornecedorButton.disabled = false;
    salvarFornecedorButton.disabled = true;
    document.getElementById('fornecedor-modal-title').textContent = `Editar ${fornecedor.nome}`;
    abrirModalFornecedor();
  } catch (error) {
    mostrarMensagemFornecedor(error.message, 'error');
  }
}

async function excluirFornecedor(id) {
  if (!window.confirm('Deseja realmente excluir este fornecedor?')) {
    return;
  }

  try {
    const response = await fetch(`${fornecedoresApiBaseUrl}/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel excluir o fornecedor.');
    }

    if (editingFornecedorId === id) {
      fecharModalFornecedor();
    }

    mostrarMensagemFornecedor('Fornecedor excluido com sucesso.', 'success');
    await carregarFornecedores();
  } catch (error) {
    mostrarMensagemFornecedor(error.message, 'error');
  }
}

function resetFornecedorForm() {
  fornecedorForm.reset();
  editingFornecedorId = null;
  document.getElementById('fornecedor-id').value = '';
  atualizarFornecedorButton.disabled = true;
  salvarFornecedorButton.disabled = false;
  esconderMensagemModalFornecedor();
}

function abrirModalFornecedor() {
  fornecedorModal.classList.remove('hidden');
  fornecedorModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModalFornecedor() {
  resetFornecedorForm();
  fornecedorModal.classList.add('hidden');
  fornecedorModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'fornecedor') {
    fecharModalFornecedor();
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
    if (!fornecedorModal.classList.contains('hidden')) {
      fecharModalFornecedor();
    }

    if (appDrawer.classList.contains('is-open')) {
      fecharDrawer();
    }
  }
}

function renderizarTabelaFornecedores(fornecedores) {
  totalFornecedores.textContent = `${fornecedores.length} registro(s) encontrado(s)`;

  if (fornecedores.length === 0) {
    fornecedoresTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum fornecedor encontrado para os filtros informados.</td></tr>';
    return;
  }

  fornecedoresTbody.innerHTML = fornecedores.map((fornecedor) => `
    <tr>
      <td class="table-description">${escapeHtml(fornecedor.nome)}</td>
      <td>${escapeHtml(fornecedor.telefone || '-')}</td>
      <td>${escapeHtml(fornecedor.contato || '-')}</td>
      <td>${escapeHtml(fornecedor.email || '-')}</td>
      <td>${escapeHtml(fornecedor.cidade || '-')}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="edit" data-id="${fornecedor.id}">Editar</button>
            <button type="button" class="row-menu-item danger" data-action="delete" data-id="${fornecedor.id}">Excluir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores(fornecedores) {
  const comEmail = fornecedores.filter((fornecedor) => fornecedor.email).length;
  const cidades = new Set(
    fornecedores
      .map((fornecedor) => fornecedor.cidade)
      .filter(Boolean)
  ).size;

  document.getElementById('metric-total-fornecedores').textContent = String(fornecedores.length);
  document.getElementById('metric-com-email').textContent = String(comEmail);
  document.getElementById('metric-cidades').textContent = String(cidades);
}

function mostrarMensagemFornecedor(texto, tipo) {
  fornecedorMensagemBox.textContent = texto;
  fornecedorMensagemBox.className = `message ${tipo}`;
  fornecedorMensagemBox.classList.remove('hidden');
}

function mostrarMensagemModalFornecedor(texto, tipo) {
  fornecedorModalMensagemBox.textContent = texto;
  fornecedorModalMensagemBox.className = `message ${tipo}`;
  fornecedorModalMensagemBox.classList.remove('hidden');
}

function esconderMensagemModalFornecedor() {
  fornecedorModalMensagemBox.className = 'message hidden';
  fornecedorModalMensagemBox.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
