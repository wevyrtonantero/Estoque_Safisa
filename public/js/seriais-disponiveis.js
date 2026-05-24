const seriaisDisponiveisApiBaseUrl = '/api/submontagem-seriais';

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('seriais-disponiveis-modal');
  const tbody = document.getElementById('seriais-disponiveis-tbody');
  const resumo = document.getElementById('seriais-disponiveis-resumo');
  const subtitulo = document.getElementById('seriais-disponiveis-subtitulo');
  const closeButton = document.getElementById('btn-fechar-modal-seriais-disponiveis');
  const openButton = document.getElementById('montagem-btn-seriais-disponiveis') || document.getElementById('expedicao-btn-seriais-disponiveis');
  const badge = document.getElementById('montagem-badge-seriais-disponiveis') || document.getElementById('expedicao-badge-seriais-disponiveis');

  if (!modal || !tbody || !resumo || !openButton || !badge) {
    return;
  }

  let resumoAtual = { total_disponivel: 0, modelos: [] };
  let registrosDetalhados = [];
  let modeloExpandidoId = null;

  openButton.addEventListener('click', async () => {
    try {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Carregando numeros de serie disponiveis...</td></tr>';
      openModal();
      await carregarTabela();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">${escapeHtml(error.message || 'Nao foi possivel carregar os numeros de serie disponiveis.')}</td></tr>`;
    }
  });

  closeButton?.addEventListener('click', closeModal);
  modal.querySelector('[data-close-modal="seriais-disponiveis"]')?.addEventListener('click', closeModal);
  tbody.addEventListener('click', handleTabelaActions);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  carregarResumo().catch(() => {});
  if (window.SafisaSync?.subscribe) {
    let syncTimer = null;
    window.SafisaSync.subscribe('submontagem-seriais', () => {
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        carregarResumo().catch(() => {});
        if (!modal.classList.contains('hidden')) {
          carregarTabela().catch(() => {});
        }
      }, 180);
    });
  }
  window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    carregarResumo().catch(() => {});
  }, 15000);

  async function carregarResumo() {
    resumoAtual = await fetchJson(`${seriaisDisponiveisApiBaseUrl}/disponiveis/resumo`);
    badge.textContent = formatInteger(resumoAtual.total_disponivel || 0);
    badge.classList.toggle('hidden', Number(resumoAtual.total_disponivel || 0) <= 0);

    resumo.innerHTML = `
      <span class="selected-tag">Disponiveis: ${formatInteger(resumoAtual.total_disponivel || 0)}</span>
      <span class="selected-tag">Modelos: ${formatInteger((resumoAtual.modelos || []).length)}</span>
    `;
  }

  async function carregarTabela() {
    const [resumoDisponivel, registros] = await Promise.all([
      fetchJson(`${seriaisDisponiveisApiBaseUrl}/disponiveis/resumo`),
      fetchJson(`${seriaisDisponiveisApiBaseUrl}/disponiveis?limit=500`)
    ]);
    resumoAtual = resumoDisponivel || { total_disponivel: 0, modelos: [] };
    registrosDetalhados = Array.isArray(registros) ? registros : [];
    atualizarResumoVisual();
    subtitulo.textContent = `Modelos disponiveis agora: ${formatInteger((resumoAtual.modelos || []).length)}. Clique em ver numeros para abrir a lista detalhada.`;

    if (!Array.isArray(resumoAtual.modelos) || !resumoAtual.modelos.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum numero de serie disponivel no momento.</td></tr>';
      return;
    }

    if (modeloExpandidoId && !resumoAtual.modelos.some((modelo) => Number(modelo.id_modelo_servo) === Number(modeloExpandidoId))) {
      modeloExpandidoId = null;
    }

    tbody.innerHTML = resumoAtual.modelos.map((modelo) => `
      <tr>
        <td class="table-code">${escapeHtml(modelo.modelo_servo_codigo)}</td>
        <td>${escapeHtml(modelo.modelo_servo_descricao)}</td>
        <td class="table-quantity">${formatInteger(modelo.quantidade_disponivel)}</td>
        <td>
          <button
            type="button"
            class="btn btn-neutral btn-small"
            data-action="toggle-modelo"
            data-modelo-id="${modelo.id_modelo_servo}"
          >
            ${Number(modeloExpandidoId) === Number(modelo.id_modelo_servo) ? 'Ocultar numeros' : 'Ver numeros'}
          </button>
        </td>
      </tr>
      ${Number(modeloExpandidoId) === Number(modelo.id_modelo_servo) ? renderizarLinhasDetalheModelo(modelo) : ''}
    `).join('');
  }

  function atualizarResumoVisual() {
    badge.textContent = formatInteger(resumoAtual.total_disponivel || 0);
    badge.classList.toggle('hidden', Number(resumoAtual.total_disponivel || 0) <= 0);

    resumo.innerHTML = `
      <span class="selected-tag">Disponiveis: ${formatInteger(resumoAtual.total_disponivel || 0)}</span>
      <span class="selected-tag">Modelos: ${formatInteger((resumoAtual.modelos || []).length)}</span>
    `;
  }

  function handleTabelaActions(event) {
    const button = event.target.closest('button[data-action="toggle-modelo"][data-modelo-id]');
    if (!button) {
      return;
    }

    const idModelo = Number(button.dataset.modeloId);
    modeloExpandidoId = Number(modeloExpandidoId) === idModelo ? null : idModelo;
    renderizarTabelaAgrupada();
  }

  function renderizarTabelaAgrupada() {
    if (!Array.isArray(resumoAtual.modelos) || !resumoAtual.modelos.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum numero de serie disponivel no momento.</td></tr>';
      return;
    }

    tbody.innerHTML = resumoAtual.modelos.map((modelo) => `
      <tr>
        <td class="table-code">${escapeHtml(modelo.modelo_servo_codigo)}</td>
        <td>${escapeHtml(modelo.modelo_servo_descricao)}</td>
        <td class="table-quantity">${formatInteger(modelo.quantidade_disponivel)}</td>
        <td>
          <button
            type="button"
            class="btn btn-neutral btn-small"
            data-action="toggle-modelo"
            data-modelo-id="${modelo.id_modelo_servo}"
          >
            ${Number(modeloExpandidoId) === Number(modelo.id_modelo_servo) ? 'Ocultar numeros' : 'Ver numeros'}
          </button>
        </td>
      </tr>
      ${Number(modeloExpandidoId) === Number(modelo.id_modelo_servo) ? renderizarLinhasDetalheModelo(modelo) : ''}
    `).join('');
  }

  function renderizarLinhasDetalheModelo(modelo) {
    const registrosModelo = registrosDetalhados.filter((serial) => Number(serial.id_modelo_servo) === Number(modelo.id_modelo_servo));

    if (!registrosModelo.length) {
      return `
        <tr>
          <td colspan="4" class="empty-state">Nenhum numero disponivel para este modelo agora.</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td colspan="4" class="table-compact-text">
          <div class="selected-tags">
            ${registrosModelo.map((serial) => `
              <span class="selected-tag">
                ${escapeHtml(serial.numero_serie)}
              </span>
            `).join('')}
          </div>
        </td>
      </tr>
    `;
  }

  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal');
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    modeloExpandidoId = null;

    const modalAberto = [...document.querySelectorAll('.modal')].some((item) => !item.classList.contains('hidden'));
    document.body.classList.toggle('has-modal', modalAberto);
  }
});

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel concluir a operacao.');
  }

  return result;
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
