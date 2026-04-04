const usuariosApiBaseUrl = '/api/usuarios';
const authMeApiUrl = '/api/auth/me';

let editingUsuarioId = null;
let filtroDebounceTimer = null;
let currentUserId = null;

const usuarioForm = document.getElementById('usuario-form');
const usuarioFiltroForm = document.getElementById('usuario-filtro-form');
const usuarioMensagemBox = document.getElementById('usuario-mensagem');
const usuarioModalMensagemBox = document.getElementById('usuario-modal-mensagem');
const usuariosTbody = document.getElementById('usuarios-tbody');
const totalUsuarios = document.getElementById('total-usuarios');
const salvarUsuarioButton = document.getElementById('btn-salvar-usuario');
const atualizarUsuarioButton = document.getElementById('btn-atualizar-usuario');
const novoUsuarioButton = document.getElementById('btn-novo-usuario');
const limparFiltrosUsuarioButton = document.getElementById('btn-limpar-filtros-usuario');
const cancelarModalUsuarioButton = document.getElementById('btn-cancelar-modal-usuario');
const fecharModalUsuarioButton = document.getElementById('btn-fechar-modal-usuario');
const usuarioModal = document.getElementById('usuario-modal');
const menuToggleButton = document.getElementById('menu-toggle');
const drawerCloseButton = document.getElementById('drawer-close');
const drawerScrim = document.getElementById('drawer-scrim');
const appDrawer = document.getElementById('app-drawer');

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await carregarUsuarioAtual();
  await carregarUsuarios();
});

function bindEvents() {
  usuarioForm.addEventListener('submit', handleCreateUsuario);
  atualizarUsuarioButton.addEventListener('click', handleUpdateUsuario);
  novoUsuarioButton.addEventListener('click', abrirNovoUsuarioModal);
  limparFiltrosUsuarioButton.addEventListener('click', limparFiltrosUsuario);
  usuarioFiltroForm.addEventListener('submit', handleFilterUsuario);
  usuariosTbody.addEventListener('click', handleUsuarioTableActions);
  cancelarModalUsuarioButton.addEventListener('click', fecharModalUsuario);
  fecharModalUsuarioButton.addEventListener('click', fecharModalUsuario);
  usuarioModal.addEventListener('click', handleModalBackdrop);
  menuToggleButton.addEventListener('click', abrirDrawer);
  drawerCloseButton.addEventListener('click', fecharDrawer);
  drawerScrim.addEventListener('click', fecharDrawer);
  document.addEventListener('keydown', handleKeyboardShortcuts);

  usuarioFiltroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
}

async function carregarUsuarioAtual() {
  try {
    const response = await fetch(authMeApiUrl);
    const result = await response.json();

    if (response.ok && result.user?.id) {
      currentUserId = Number(result.user.id);
    }
  } catch (error) {
    currentUserId = null;
  }
}

async function carregarUsuarios() {
  const params = new URLSearchParams();
  const nome = document.getElementById('filtro-usuario-nome').value.trim();
  const login = document.getElementById('filtro-usuario-login').value.trim();
  const role = document.getElementById('filtro-usuario-role').value;
  const ativo = document.getElementById('filtro-usuario-ativo').value;

  if (nome) params.append('nome', nome);
  if (login) params.append('login', login);
  if (role) params.append('role', role);
  if (ativo) params.append('ativo', ativo);

  try {
    const endpoint = params.toString() ? `${usuariosApiBaseUrl}?${params}` : usuariosApiBaseUrl;
    const response = await fetch(endpoint);
    const usuarios = await response.json();

    if (!response.ok) {
      throw new Error(usuarios.message || 'Nao foi possivel carregar os usuarios.');
    }

    renderizarTabelaUsuarios(usuarios);
    atualizarIndicadores(usuarios);
  } catch (error) {
    renderizarTabelaUsuarios([]);
    atualizarIndicadores([]);
    mostrarMensagemUsuario(error.message, 'error');
  }
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarUsuarios(), 220);
}

function abrirNovoUsuarioModal() {
  resetUsuarioForm();
  document.getElementById('usuario-modal-title').textContent = 'Novo Usuario';
  document.getElementById('usuario-senha-hint').textContent = 'Informe a senha inicial do usuario.';
  document.getElementById('usuario-senha').required = true;
  abrirModalUsuario();
}

async function handleCreateUsuario(event) {
  event.preventDefault();

  if (editingUsuarioId) {
    mostrarMensagemModalUsuario('Use o botao Atualizar para salvar o usuario em edicao.', 'error');
    return;
  }

  try {
    const response = await fetch(usuariosApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadUsuario())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalUsuario();
    mostrarMensagemUsuario('Usuario cadastrado com sucesso.', 'success');
    await carregarUsuarios();
  } catch (error) {
    mostrarMensagemModalUsuario(error.message, 'error');
  }
}

async function handleUpdateUsuario() {
  if (!editingUsuarioId) {
    mostrarMensagemModalUsuario('Selecione um usuario antes de atualizar.', 'error');
    return;
  }

  try {
    const response = await fetch(`${usuariosApiBaseUrl}/${editingUsuarioId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadUsuario())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalUsuario();
    mostrarMensagemUsuario('Usuario atualizado com sucesso.', 'success');
    await carregarUsuarioAtual();
    await carregarUsuarios();
  } catch (error) {
    mostrarMensagemModalUsuario(error.message, 'error');
  }
}

function handleFilterUsuario(event) {
  event.preventDefault();
  carregarUsuarios();
}

function limparFiltrosUsuario() {
  usuarioFiltroForm.reset();
  carregarUsuarios();
}

async function handleUsuarioTableActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const usuarioId = Number.parseInt(actionButton.dataset.id, 10);

  if (action === 'edit') {
    await carregarUsuarioParaEdicao(usuarioId);
  }

  if (action === 'delete') {
    await excluirUsuario(usuarioId);
  }
}

function montarPayloadUsuario() {
  return {
    nome: document.getElementById('usuario-nome').value.trim(),
    login: document.getElementById('usuario-login').value.trim(),
    role: document.getElementById('usuario-role').value,
    ativo: document.getElementById('usuario-ativo').value === 'true',
    senha: document.getElementById('usuario-senha').value
  };
}

async function carregarUsuarioParaEdicao(id) {
  try {
    const response = await fetch(`${usuariosApiBaseUrl}/${id}`);
    const usuario = await response.json();

    if (!response.ok) {
      throw new Error(usuario.message || 'Nao foi possivel carregar o usuario.');
    }

    editingUsuarioId = usuario.id;
    document.getElementById('usuario-id').value = usuario.id;
    document.getElementById('usuario-nome').value = usuario.nome;
    document.getElementById('usuario-login').value = usuario.login;
    document.getElementById('usuario-role').value = usuario.role;
    document.getElementById('usuario-ativo').value = usuario.ativo ? 'true' : 'false';
    document.getElementById('usuario-senha').value = '';
    document.getElementById('usuario-senha').required = false;
    document.getElementById('usuario-senha-hint').textContent = 'Deixe em branco para manter a senha atual.';
    atualizarUsuarioButton.disabled = false;
    salvarUsuarioButton.disabled = true;
    document.getElementById('usuario-modal-title').textContent = `Editar ${usuario.nome}`;
    abrirModalUsuario();
  } catch (error) {
    mostrarMensagemUsuario(error.message, 'error');
  }
}

async function excluirUsuario(id) {
  if (!window.confirm('Deseja realmente excluir este usuario?')) {
    return;
  }

  try {
    const response = await fetch(`${usuariosApiBaseUrl}/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel excluir o usuario.');
    }

    if (editingUsuarioId === id) {
      fecharModalUsuario();
    }

    mostrarMensagemUsuario('Usuario excluido com sucesso.', 'success');
    await carregarUsuarios();
  } catch (error) {
    mostrarMensagemUsuario(error.message, 'error');
  }
}

function resetUsuarioForm() {
  usuarioForm.reset();
  editingUsuarioId = null;
  document.getElementById('usuario-id').value = '';
  document.getElementById('usuario-role').value = 'OPERACAO';
  document.getElementById('usuario-ativo').value = 'true';
  document.getElementById('usuario-senha').required = true;
  atualizarUsuarioButton.disabled = true;
  salvarUsuarioButton.disabled = false;
  esconderMensagemModalUsuario();
}

function abrirModalUsuario() {
  usuarioModal.classList.remove('hidden');
  usuarioModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModalUsuario() {
  resetUsuarioForm();
  usuarioModal.classList.add('hidden');
  usuarioModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'usuario') {
    fecharModalUsuario();
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
    if (!usuarioModal.classList.contains('hidden')) {
      fecharModalUsuario();
    }

    if (appDrawer.classList.contains('is-open')) {
      fecharDrawer();
    }
  }
}

function renderizarTabelaUsuarios(usuarios) {
  totalUsuarios.textContent = `${usuarios.length} registro(s) encontrado(s)`;

  if (usuarios.length === 0) {
    usuariosTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum usuario encontrado para os filtros informados.</td></tr>';
    return;
  }

  usuariosTbody.innerHTML = usuarios.map((usuario) => {
    const isCurrentUser = Number(usuario.id) === Number(currentUserId);
    const statusClass = usuario.ativo ? 'is-success' : 'is-danger';
    const statusLabel = usuario.ativo ? 'Ativo' : 'Inativo';

    return `
      <tr>
        <td class="table-description">${escapeHtml(usuario.nome)}${isCurrentUser ? ' <span class="mini-chip">Voce</span>' : ''}</td>
        <td>${escapeHtml(usuario.login)}</td>
        <td>${escapeHtml(formatRoleLabel(usuario.role))}</td>
        <td><span class="status-chip ${statusClass}">${statusLabel}</span></td>
        <td>${escapeHtml(formatDateTime(usuario.ultimo_login_em))}</td>
        <td class="table-actions-cell">
          <details class="row-menu">
            <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
            <div class="row-menu-panel">
              <button type="button" class="row-menu-item" data-action="edit" data-id="${usuario.id}">Editar</button>
              <button type="button" class="row-menu-item danger" data-action="delete" data-id="${usuario.id}">Excluir</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('');
}

function atualizarIndicadores(usuarios) {
  const ativos = usuarios.filter((usuario) => usuario.ativo).length;
  const inativos = usuarios.length - ativos;
  const superadmins = usuarios.filter((usuario) => usuario.role === 'SUPERADMIN').length;

  document.getElementById('metric-total-usuarios').textContent = String(usuarios.length);
  document.getElementById('metric-usuarios-ativos').textContent = String(ativos);
  document.getElementById('metric-usuarios-inativos').textContent = String(inativos);
  document.getElementById('metric-superadmins').textContent = String(superadmins);
}

function mostrarMensagemUsuario(texto, tipo) {
  usuarioMensagemBox.textContent = texto;
  usuarioMensagemBox.className = `message ${tipo}`;
  usuarioMensagemBox.classList.remove('hidden');
}

function mostrarMensagemModalUsuario(texto, tipo) {
  usuarioModalMensagemBox.textContent = texto;
  usuarioModalMensagemBox.className = `message ${tipo}`;
  usuarioModalMensagemBox.classList.remove('hidden');
}

function esconderMensagemModalUsuario() {
  usuarioModalMensagemBox.className = 'message hidden';
  usuarioModalMensagemBox.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function formatRoleLabel(role) {
  const labels = {
    OPERACAO: 'Operacao',
    ADM: 'ADM',
    GESTOR: 'Gestor',
    SUPERADMIN: 'Superadmin'
  };

  return labels[role] || role || '-';
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('pt-BR');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
