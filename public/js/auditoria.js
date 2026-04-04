const auditoriaApiBaseUrl = '/api/auditoria-logs';

let logsCache = [];
let filtroDebounceTimer = null;

const auditoriaFiltroForm = document.getElementById('auditoria-filtro-form');
const auditoriaMensagemBox = document.getElementById('auditoria-mensagem');
const auditoriaDetalhesMensagemBox = document.getElementById('auditoria-detalhes-mensagem');
const auditoriaTbody = document.getElementById('auditoria-tbody');
const totalAuditoria = document.getElementById('total-auditoria');
const limparFiltrosAuditoriaButton = document.getElementById('btn-limpar-filtros-auditoria');
const auditoriaDetalhesModal = document.getElementById('auditoria-detalhes-modal');
const menuToggleButton = document.getElementById('menu-toggle');
const drawerCloseButton = document.getElementById('drawer-close');
const drawerScrim = document.getElementById('drawer-scrim');
const appDrawer = document.getElementById('app-drawer');

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  aplicarDatasPadrao();
  carregarAuditoria();
});

function bindEvents() {
  auditoriaFiltroForm.addEventListener('submit', handleFilterAuditoria);
  limparFiltrosAuditoriaButton.addEventListener('click', limparFiltrosAuditoria);
  auditoriaTbody.addEventListener('click', handleAuditoriaTableActions);
  auditoriaDetalhesModal.addEventListener('click', handleModalBackdrop);
  document.getElementById('btn-fechar-modal-auditoria-detalhes').addEventListener('click', fecharModalDetalhes);
  document.getElementById('btn-fechar-modal-auditoria-detalhes-footer').addEventListener('click', fecharModalDetalhes);
  menuToggleButton.addEventListener('click', abrirDrawer);
  drawerCloseButton.addEventListener('click', fecharDrawer);
  drawerScrim.addEventListener('click', fecharDrawer);
  document.addEventListener('keydown', handleKeyboardShortcuts);

  auditoriaFiltroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
}

function aplicarDatasPadrao() {
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000);
  document.getElementById('filtro-auditoria-data-fim').value = toInputDate(hoje);
  document.getElementById('filtro-auditoria-data-inicio').value = toInputDate(seteDiasAtras);
}

async function carregarAuditoria() {
  const params = new URLSearchParams();
  const dataInicio = document.getElementById('filtro-auditoria-data-inicio').value;
  const dataFim = document.getElementById('filtro-auditoria-data-fim').value;
  const usuario = document.getElementById('filtro-auditoria-usuario').value.trim();
  const modulo = document.getElementById('filtro-auditoria-modulo').value;
  const acao = document.getElementById('filtro-auditoria-acao').value.trim();
  const q = document.getElementById('filtro-auditoria-q').value.trim();

  if (dataInicio) params.append('data_inicio', dataInicio);
  if (dataFim) params.append('data_fim', dataFim);
  if (usuario) params.append('usuario', usuario);
  if (modulo) params.append('modulo', modulo);
  if (acao) params.append('acao', acao);
  if (q) params.append('q', q);
  params.append('limit', '500');

  try {
    const response = await fetch(`${auditoriaApiBaseUrl}?${params}`);
    const logs = await response.json();

    if (!response.ok) {
      throw new Error(logs.message || 'Nao foi possivel carregar os logs.');
    }

    logsCache = logs;
    renderizarTabelaAuditoria(logs);
    atualizarIndicadores(logs);
  } catch (error) {
    logsCache = [];
    renderizarTabelaAuditoria([]);
    atualizarIndicadores([]);
    mostrarMensagemAuditoria(error.message, 'error');
  }
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarAuditoria(), 220);
}

function handleFilterAuditoria(event) {
  event.preventDefault();
  carregarAuditoria();
}

function limparFiltrosAuditoria() {
  auditoriaFiltroForm.reset();
  aplicarDatasPadrao();
  carregarAuditoria();
}

function handleAuditoriaTableActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  if (actionButton.dataset.action === 'details') {
    abrirDetalhesLog(Number.parseInt(actionButton.dataset.id, 10));
  }
}

async function abrirDetalhesLog(id) {
  try {
    const response = await fetch(`${auditoriaApiBaseUrl}/${id}`);
    const log = await response.json();

    if (!response.ok) {
      throw new Error(log.message || 'Nao foi possivel carregar o log.');
    }

    document.getElementById('auditoria-detalhes-title').textContent = `Log #${log.id}`;
    document.getElementById('auditoria-detalhes-usuario').value = formatUser(log);
    document.getElementById('auditoria-detalhes-modulo').value = formatModulo(log.modulo);
    document.getElementById('auditoria-detalhes-acao').value = log.acao || '-';
    document.getElementById('auditoria-detalhes-data').value = formatDateTime(log.created_at);
    document.getElementById('auditoria-detalhes-registro').value = formatEntity(log);
    document.getElementById('auditoria-detalhes-ip').value = log.ip || '-';
    document.getElementById('auditoria-detalhes-descricao').value = log.descricao || '-';
    document.getElementById('auditoria-detalhes-antes').value = formatJson(log.detalhes_antes);
    document.getElementById('auditoria-detalhes-depois').value = formatJson(log.detalhes_depois);
    esconderMensagemDetalhes();
    auditoriaDetalhesModal.classList.remove('hidden');
    auditoriaDetalhesModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal');
  } catch (error) {
    mostrarMensagemAuditoria(error.message, 'error');
  }
}

function fecharModalDetalhes() {
  auditoriaDetalhesModal.classList.add('hidden');
  auditoriaDetalhesModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'auditoria-detalhes') {
    fecharModalDetalhes();
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
    if (!auditoriaDetalhesModal.classList.contains('hidden')) {
      fecharModalDetalhes();
    }

    if (appDrawer.classList.contains('is-open')) {
      fecharDrawer();
    }
  }
}

function renderizarTabelaAuditoria(logs) {
  totalAuditoria.textContent = `${logs.length} registro(s) encontrado(s)`;

  if (logs.length === 0) {
    auditoriaTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum log encontrado para os filtros informados.</td></tr>';
    return;
  }

  auditoriaTbody.innerHTML = logs.map((log) => `
    <tr>
      <td>${escapeHtml(formatDateTime(log.created_at))}</td>
      <td class="table-description">${escapeHtml(formatUser(log))}</td>
      <td>${escapeHtml(formatModulo(log.modulo))}</td>
      <td>${escapeHtml(log.acao || '-')}</td>
      <td>${escapeHtml(formatEntity(log))}</td>
      <td>${escapeHtml(log.ip || '-')}</td>
      <td>${escapeHtml(log.descricao || '-')}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="details" data-id="${log.id}">Ver detalhes</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores(logs) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const usuarios = new Set(
    logs
      .map((log) => log.usuario_login || log.usuario_nome)
      .filter(Boolean)
  ).size;
  const logsHoje = logs.filter((log) => formatDate(log.created_at) === hoje).length;
  const logins = logs.filter((log) => log.acao === 'LOGIN').length;

  document.getElementById('metric-total-logs').textContent = String(logs.length);
  document.getElementById('metric-logs-hoje').textContent = String(logsHoje);
  document.getElementById('metric-usuarios-periodo').textContent = String(usuarios);
  document.getElementById('metric-logins').textContent = String(logins);
}

function mostrarMensagemAuditoria(texto, tipo) {
  auditoriaMensagemBox.textContent = texto;
  auditoriaMensagemBox.className = `message ${tipo}`;
  auditoriaMensagemBox.classList.remove('hidden');
}

function mostrarMensagemDetalhes(texto, tipo) {
  auditoriaDetalhesMensagemBox.textContent = texto;
  auditoriaDetalhesMensagemBox.className = `message ${tipo}`;
  auditoriaDetalhesMensagemBox.classList.remove('hidden');
}

function esconderMensagemDetalhes() {
  auditoriaDetalhesMensagemBox.className = 'message hidden';
  auditoriaDetalhesMensagemBox.textContent = '';
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function formatUser(log) {
  const name = log.usuario_nome || '-';
  const login = log.usuario_login ? ` (${log.usuario_login})` : '';
  return `${name}${login}`;
}

function formatModulo(modulo) {
  const labels = {
    AUTENTICACAO: 'Autenticacao',
    USUARIOS: 'Usuarios',
    PECAS: 'Pecas',
    MATERIAS_PRIMAS: 'Materias-primas',
    ESTOQUE: 'Estoque',
    PRODUCAO: 'Producao',
    TERCEIRIZACAO: 'Terceirizacao'
  };

  return labels[modulo] || modulo || '-';
}

function formatEntity(log) {
  if (!log.entidade_tipo && !log.entidade_id) {
    return '-';
  }

  const tipo = log.entidade_tipo || 'REGISTRO';
  const id = log.entidade_id ? ` #${log.entidade_id}` : '';
  return `${tipo}${id}`;
}

function formatJson(value) {
  if (!value) {
    return '-';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    mostrarMensagemDetalhes('Nao foi possivel formatar os detalhes do log.', 'error');
    return String(value);
  }
}

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
