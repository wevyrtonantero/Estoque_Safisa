// Script principal do modulo de maquinas.
const maquinasApiBaseUrl = '/api/maquinas';

let editingMaquinaId = null;
let filtroDebounceTimer = null;

const maquinaForm = document.getElementById('maquina-form');
const maquinaFiltroForm = document.getElementById('maquina-filtro-form');
const maquinaMensagemBox = document.getElementById('maquina-mensagem');
const maquinaModalMensagemBox = document.getElementById('maquina-modal-mensagem');
const maquinasTbody = document.getElementById('maquinas-tbody');
const totalMaquinas = document.getElementById('total-maquinas');
const salvarMaquinaButton = document.getElementById('btn-salvar-maquina');
const atualizarMaquinaButton = document.getElementById('btn-atualizar-maquina');
const novaMaquinaButton = document.getElementById('btn-nova-maquina');
const limparFiltrosMaquinaButton = document.getElementById('btn-limpar-filtros-maquina');
const cancelarModalMaquinaButton = document.getElementById('btn-cancelar-modal-maquina');
const fecharModalMaquinaButton = document.getElementById('btn-fechar-modal-maquina');
const maquinaModal = document.getElementById('maquina-modal');
const menuToggleButton = document.getElementById('menu-toggle');
const drawerCloseButton = document.getElementById('drawer-close');
const drawerScrim = document.getElementById('drawer-scrim');
const appDrawer = document.getElementById('app-drawer');

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  carregarMaquinas();
});

// Conecta os eventos do modulo, modal e menu lateral.
function bindEvents() {
  maquinaForm.addEventListener('submit', handleCreateMaquina);
  atualizarMaquinaButton.addEventListener('click', handleUpdateMaquina);
  novaMaquinaButton.addEventListener('click', abrirNovaMaquinaModal);
  limparFiltrosMaquinaButton.addEventListener('click', limparFiltrosMaquina);
  maquinaFiltroForm.addEventListener('submit', handleFilterMaquina);
  maquinasTbody.addEventListener('click', handleMaquinaTableActions);
  cancelarModalMaquinaButton.addEventListener('click', fecharModalMaquina);
  fecharModalMaquinaButton.addEventListener('click', fecharModalMaquina);
  maquinaModal.addEventListener('click', handleModalBackdrop);
  menuToggleButton.addEventListener('click', abrirDrawer);
  drawerCloseButton.addEventListener('click', fecharDrawer);
  drawerScrim.addEventListener('click', fecharDrawer);
  document.addEventListener('keydown', handleKeyboardShortcuts);

  maquinaFiltroForm.querySelectorAll('input').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
  });
}

async function carregarMaquinas() {
  const params = new URLSearchParams();
  const nome = document.getElementById('filtro-maquina-nome').value.trim();
  const tipo = document.getElementById('filtro-maquina-tipo').value.trim();

  if (nome) params.append('nome', nome);
  if (tipo) params.append('tipo', tipo);

  try {
    const endpoint = params.toString() ? `${maquinasApiBaseUrl}?${params}` : maquinasApiBaseUrl;
    const response = await fetch(endpoint);
    const maquinas = await response.json();

    if (!response.ok) {
      throw new Error(maquinas.message || 'Nao foi possivel carregar as maquinas.');
    }

    renderizarTabelaMaquinas(maquinas);
    atualizarIndicadores(maquinas);
  } catch (error) {
    renderizarTabelaMaquinas([]);
    atualizarIndicadores([]);
    mostrarMensagemMaquina(error.message, 'error');
  }
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarMaquinas(), 220);
}

function abrirNovaMaquinaModal() {
  resetMaquinaForm();
  document.getElementById('maquina-modal-title').textContent = 'Nova Maquina';
  abrirModalMaquina();
}

async function handleCreateMaquina(event) {
  event.preventDefault();

  if (editingMaquinaId) {
    mostrarMensagemModalMaquina('Use o botao Atualizar para salvar a maquina em edicao.', 'error');
    return;
  }

  try {
    const response = await fetch(maquinasApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadMaquina())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalMaquina();
    mostrarMensagemMaquina('Maquina cadastrada com sucesso.', 'success');
    await carregarMaquinas();
  } catch (error) {
    mostrarMensagemModalMaquina(error.message, 'error');
  }
}

async function handleUpdateMaquina() {
  if (!editingMaquinaId) {
    mostrarMensagemModalMaquina('Selecione uma maquina antes de atualizar.', 'error');
    return;
  }

  try {
    const response = await fetch(`${maquinasApiBaseUrl}/${editingMaquinaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadMaquina())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalMaquina();
    mostrarMensagemMaquina('Maquina atualizada com sucesso.', 'success');
    await carregarMaquinas();
  } catch (error) {
    mostrarMensagemModalMaquina(error.message, 'error');
  }
}

function handleFilterMaquina(event) {
  event.preventDefault();
  carregarMaquinas();
}

function limparFiltrosMaquina() {
  maquinaFiltroForm.reset();
  carregarMaquinas();
}

async function handleMaquinaTableActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const maquinaId = Number.parseInt(actionButton.dataset.id, 10);

  if (action === 'edit') {
    await carregarMaquinaParaEdicao(maquinaId);
  }

  if (action === 'delete') {
    await excluirMaquina(maquinaId);
  }
}

function montarPayloadMaquina() {
  return {
    nome: document.getElementById('maquina-nome').value.trim(),
    tipo: document.getElementById('maquina-tipo').value.trim()
  };
}

async function carregarMaquinaParaEdicao(id) {
  try {
    const response = await fetch(`${maquinasApiBaseUrl}/${id}`);
    const maquina = await response.json();

    if (!response.ok) {
      throw new Error(maquina.message || 'Nao foi possivel carregar a maquina.');
    }

    editingMaquinaId = maquina.id;
    document.getElementById('maquina-id').value = maquina.id;
    document.getElementById('maquina-nome').value = maquina.nome;
    document.getElementById('maquina-tipo').value = maquina.tipo;
    atualizarMaquinaButton.disabled = false;
    salvarMaquinaButton.disabled = true;
    document.getElementById('maquina-modal-title').textContent = `Editar ${maquina.nome}`;
    abrirModalMaquina();
  } catch (error) {
    mostrarMensagemMaquina(error.message, 'error');
  }
}

async function excluirMaquina(id) {
  if (!window.confirm('Deseja realmente excluir esta maquina?')) {
    return;
  }

  try {
    const response = await fetch(`${maquinasApiBaseUrl}/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel excluir a maquina.');
    }

    if (editingMaquinaId === id) {
      fecharModalMaquina();
    }

    mostrarMensagemMaquina('Maquina excluida com sucesso.', 'success');
    await carregarMaquinas();
  } catch (error) {
    mostrarMensagemMaquina(error.message, 'error');
  }
}

function resetMaquinaForm() {
  maquinaForm.reset();
  editingMaquinaId = null;
  document.getElementById('maquina-id').value = '';
  atualizarMaquinaButton.disabled = true;
  salvarMaquinaButton.disabled = false;
  esconderMensagemModalMaquina();
}

function abrirModalMaquina() {
  maquinaModal.classList.remove('hidden');
  maquinaModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModalMaquina() {
  resetMaquinaForm();
  maquinaModal.classList.add('hidden');
  maquinaModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'maquina') {
    fecharModalMaquina();
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
    if (!maquinaModal.classList.contains('hidden')) {
      fecharModalMaquina();
    }

    if (appDrawer.classList.contains('is-open')) {
      fecharDrawer();
    }
  }
}

function renderizarTabelaMaquinas(maquinas) {
  totalMaquinas.textContent = `${maquinas.length} registro(s) encontrado(s)`;

  if (maquinas.length === 0) {
    maquinasTbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhuma maquina encontrada para os filtros informados.</td></tr>';
    return;
  }

  maquinasTbody.innerHTML = maquinas.map((maquina) => `
    <tr>
      <td class="table-description">${escapeHtml(maquina.nome)}</td>
      <td>${escapeHtml(maquina.tipo)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="edit" data-id="${maquina.id}">Editar</button>
            <button type="button" class="row-menu-item danger" data-action="delete" data-id="${maquina.id}">Excluir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores(maquinas) {
  const tiposDistintos = new Set(maquinas.map((maquina) => maquina.tipo)).size;
  const processoChave = maquinas.filter((maquina) => ['Usinagem', 'Corte'].includes(maquina.tipo)).length;

  document.getElementById('metric-total-maquinas').textContent = String(maquinas.length);
  document.getElementById('metric-tipos-maquina').textContent = String(tiposDistintos);
  document.getElementById('metric-processo-chave').textContent = String(processoChave);
}

function mostrarMensagemMaquina(texto, tipo) {
  maquinaMensagemBox.textContent = texto;
  maquinaMensagemBox.className = `message ${tipo}`;
  maquinaMensagemBox.classList.remove('hidden');
}

function mostrarMensagemModalMaquina(texto, tipo) {
  maquinaModalMensagemBox.textContent = texto;
  maquinaModalMensagemBox.className = `message ${tipo}`;
  maquinaModalMensagemBox.classList.remove('hidden');
}

function esconderMensagemModalMaquina() {
  maquinaModalMensagemBox.className = 'message hidden';
  maquinaModalMensagemBox.textContent = '';
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
