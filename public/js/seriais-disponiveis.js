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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  carregarResumo().catch(() => {});
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
    await carregarResumo();
    const registros = await fetchJson(`${seriaisDisponiveisApiBaseUrl}/disponiveis?limit=500`);
    subtitulo.textContent = `Registros disponiveis agora: ${formatInteger(registros.length)}. Somem daqui assim que forem vinculados a um pedido.`;

    if (!Array.isArray(registros) || !registros.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum numero de serie disponivel no momento.</td></tr>';
      return;
    }

    tbody.innerHTML = registros.map((serial) => `
      <tr>
        <td class="table-code">${escapeHtml(serial.numero_serie)}</td>
        <td>${escapeHtml(`${serial.modelo_servo_codigo} - ${serial.modelo_servo_descricao}`)}</td>
        <td>${escapeHtml(serial.montador_nome || '-')}</td>
        <td>${formatDate(serial.data_montagem)}</td>
      </tr>
    `).join('');
  }

  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal');
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');

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
