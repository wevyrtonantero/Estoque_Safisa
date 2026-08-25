const seriaisDisponiveisApiBaseUrl = '/api/submontagem-seriais';
const seriaisDisponiveisItensApiUrl = '/api/estoque/itens';

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('seriais-disponiveis-modal');
  const tbody = document.getElementById('seriais-disponiveis-tbody');
  const resumo = document.getElementById('seriais-disponiveis-resumo');
  const subtitulo = document.getElementById('seriais-disponiveis-subtitulo');
  const closeButton = document.getElementById('btn-fechar-modal-seriais-disponiveis');
  const openButton = document.getElementById('montagem-btn-seriais-disponiveis') || document.getElementById('expedicao-btn-seriais-disponiveis');
  const badge = document.getElementById('montagem-badge-seriais-disponiveis') || document.getElementById('expedicao-badge-seriais-disponiveis');
  const editButton = document.getElementById('btn-editar-modelo-seriais-disponiveis');
  const trocaModal = document.getElementById('seriais-disponiveis-troca-modal');
  const trocaForm = document.getElementById('seriais-disponiveis-troca-form');
  const trocaMensagem = document.getElementById('seriais-disponiveis-troca-mensagem');
  const trocaSerialId = document.getElementById('seriais-disponiveis-troca-serial-id');
  const trocaModeloId = document.getElementById('seriais-disponiveis-troca-modelo-id');
  const trocaModeloBusca = document.getElementById('seriais-disponiveis-troca-modelo-busca');
  const trocaModeloSugestoes = document.getElementById('seriais-disponiveis-troca-modelo-sugestoes');
  const trocaModeloResumo = document.getElementById('seriais-disponiveis-troca-modelo-resumo');
  const trocaNumero = document.getElementById('seriais-disponiveis-troca-numero');
  const trocaAtual = document.getElementById('seriais-disponiveis-troca-atual');
  const trocaConfirmar = document.getElementById('btn-confirmar-modal-seriais-disponiveis-troca');
  const trocaFechar = document.getElementById('btn-fechar-modal-seriais-disponiveis-troca');
  const trocaCancelar = document.getElementById('btn-cancelar-modal-seriais-disponiveis-troca');

  if (!modal || !tbody || !resumo || !openButton || !badge) {
    return;
  }

  let resumoAtual = { total_disponivel: 0, modelos: [] };
  let registrosDetalhados = [];
  let modeloExpandidoId = null;
  let modoEdicaoModelo = false;
  let modelosElegiveisCache = [];
  let serialTrocaAtual = null;

  openButton.addEventListener('click', async () => {
    try {
      modoEdicaoModelo = false;
      atualizarBotaoEdicao();
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Carregando numeros disponiveis...</td></tr>';
      openModal();
      await carregarTabela();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">${escapeHtml(error.message || 'Nao foi possivel carregar os numeros disponiveis.')}</td></tr>`;
    }
  });

  closeButton?.addEventListener('click', closeModal);
  modal.querySelector('[data-close-modal="seriais-disponiveis"]')?.addEventListener('click', closeModal);
  tbody.addEventListener('click', handleTabelaActions);
  editButton?.addEventListener('click', handleAlternarModoEdicao);
  trocaFechar?.addEventListener('click', closeTrocaModal);
  trocaCancelar?.addEventListener('click', closeTrocaModal);
  trocaModal?.querySelector('[data-close-modal="seriais-disponiveis-troca"]')?.addEventListener('click', closeTrocaModal);
  trocaForm?.addEventListener('submit', handleConfirmarTrocaModelo);
  trocaModeloBusca?.addEventListener('input', () => {
    trocaModeloId.value = '';
    renderizarResumoNovoModelo(null);
    renderizarSugestoesNovoModelo(trocaModeloBusca.value.trim());
  });
  trocaModeloBusca?.addEventListener('focus', () => renderizarSugestoesNovoModelo(trocaModeloBusca.value.trim()));
  trocaModeloSugestoes?.addEventListener('click', handleSelecionarNovoModelo);
  document.addEventListener('click', (event) => {
    if (trocaModal && !event.target.closest('#seriais-disponiveis-troca-modal .autocomplete')) {
      esconderSugestoesNovoModelo();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (trocaModal && !trocaModal.classList.contains('hidden')) {
      closeTrocaModal();
      return;
    }

    if (!modal.classList.contains('hidden')) {
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
    atualizarSubtitulo();

    if (!Array.isArray(resumoAtual.modelos) || !resumoAtual.modelos.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum numero disponivel no momento.</td></tr>';
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
    const serialButton = event.target.closest('button[data-action="editar-serial"][data-serial-id]');
    if (serialButton) {
      const serial = registrosDetalhados.find((item) => Number(item.id) === Number(serialButton.dataset.serialId));
      if (serial) {
        abrirTrocaModal(serial);
      }
      return;
    }

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
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum numero disponivel no momento.</td></tr>';
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
            ${registrosModelo.map((serial) => modoEdicaoModelo
              ? `
                <button
                  type="button"
                  class="selected-tag serial-available-edit-button"
                  data-action="editar-serial"
                  data-serial-id="${serial.id}"
                  title="Trocar o modelo deste numero de serie"
                >
                  ${escapeHtml(serial.numero_serie)}
                </button>
              `
              : `
                <span class="selected-tag">
                  ${escapeHtml(serial.numero_serie)}
                </span>
              `).join('')}
          </div>
        </td>
      </tr>
    `;
  }

  async function handleAlternarModoEdicao() {
    if (modoEdicaoModelo) {
      modoEdicaoModelo = false;
      atualizarBotaoEdicao();
      atualizarSubtitulo();
      renderizarTabelaAgrupada();
      return;
    }

    editButton.disabled = true;
    subtitulo.textContent = 'Carregando modelos disponiveis para troca...';

    try {
      await carregarModelosElegiveis();
      modoEdicaoModelo = true;
      atualizarBotaoEdicao();
      atualizarSubtitulo();
      renderizarTabelaAgrupada();
    } catch (error) {
      modoEdicaoModelo = false;
      subtitulo.textContent = error.message || 'Nao foi possivel iniciar a edicao de modelos.';
    } finally {
      editButton.disabled = false;
    }
  }

  function atualizarBotaoEdicao() {
    if (!editButton) {
      return;
    }

    editButton.textContent = modoEdicaoModelo ? 'Finalizar edicao' : 'Editar modelo de servo';
    editButton.classList.toggle('btn-danger', modoEdicaoModelo);
    editButton.classList.toggle('btn-secondary', !modoEdicaoModelo);
  }

  function atualizarSubtitulo() {
    const totalModelos = formatInteger((resumoAtual.modelos || []).length);
    subtitulo.textContent = modoEdicaoModelo
      ? `Modo de edicao ativo. Abra um modelo e clique no numero de serie que deseja trocar. Modelos disponiveis: ${totalModelos}.`
      : `Modelos disponiveis agora: ${totalModelos}. Clique em ver numeros para abrir a lista detalhada.`;
  }

  async function carregarModelosElegiveis() {
    if (modelosElegiveisCache.length) {
      return modelosElegiveisCache;
    }

    const itens = await fetchJson(seriaisDisponiveisItensApiUrl);
    modelosElegiveisCache = (Array.isArray(itens) ? itens : [])
      .filter(isModeloElegivelNumeroSerie)
      .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR', { numeric: true }));
    return modelosElegiveisCache;
  }

  function isModeloElegivelNumeroSerie(item) {
    const codigo = String(item?.codigo || '').trim().toUpperCase();
    const classificacao = String(item?.classificacao || '').trim().toUpperCase();
    const codigosItens = ['600', '550', '401RB', '401', '500', '450', '400', '350', '300', '250', '150', '100', '001'];

    if (codigosItens.includes(codigo)) {
      return true;
    }

    if (!codigo || codigo.includes('/') || classificacao === 'ITEM') {
      return false;
    }

    return ['VF', 'MC', 'AL', 'BR', 'SAF', 'CJ', 'MBF'].some((palavra) => codigo.includes(palavra));
  }

  async function abrirTrocaModal(serial) {
    if (!trocaModal || !trocaForm) {
      return;
    }

    serialTrocaAtual = serial;
    trocaForm.reset();
    trocaSerialId.value = String(serial.id);
    trocaModeloId.value = '';
    trocaNumero.textContent = serial.numero_serie || '-';
    trocaAtual.textContent = `Modelo atual: ${serial.modelo_servo_codigo || '-'} - ${serial.modelo_servo_descricao || '-'}`;
    trocaMensagem.className = 'message hidden';
    trocaMensagem.textContent = '';
    renderizarResumoNovoModelo(null);
    esconderSugestoesNovoModelo();
    trocaModal.classList.remove('hidden');
    trocaModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal');

    try {
      await carregarModelosElegiveis();
      trocaModeloBusca.focus();
    } catch (error) {
      mostrarErroTroca(error);
    }
  }

  function closeTrocaModal() {
    if (!trocaModal) {
      return;
    }

    trocaModal.classList.add('hidden');
    trocaModal.setAttribute('aria-hidden', 'true');
    serialTrocaAtual = null;
    esconderSugestoesNovoModelo();

    const modalAberto = [...document.querySelectorAll('.modal')].some((item) => !item.classList.contains('hidden'));
    document.body.classList.toggle('has-modal', modalAberto);
  }

  function obterModelosTrocaFiltrados(termo) {
    const filtro = normalizeText(termo);
    const idAtual = Number(serialTrocaAtual?.id_modelo_servo || 0);

    return modelosElegiveisCache
      .filter((item) => Number(item.id) !== idAtual)
      .filter((item) => !filtro || normalizeText(`${item.codigo} ${item.descricao}`).includes(filtro))
      .sort((a, b) => {
        if (filtro) {
          const codigoA = normalizeText(a.codigo);
          const codigoB = normalizeText(b.codigo);
          const prioridadeA = codigoA === filtro ? 0 : codigoA.startsWith(filtro) ? 1 : 2;
          const prioridadeB = codigoB === filtro ? 0 : codigoB.startsWith(filtro) ? 1 : 2;
          if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
        }

        return String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR', { numeric: true });
      })
      .slice(0, 10);
  }

  function renderizarSugestoesNovoModelo(termo) {
    if (!trocaModeloSugestoes) {
      return;
    }

    const modelos = obterModelosTrocaFiltrados(termo);
    if (!modelos.length) {
      trocaModeloSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum novo modelo encontrado.</div>';
      trocaModeloSugestoes.classList.remove('hidden');
      return;
    }

    trocaModeloSugestoes.innerHTML = modelos.map((item) => `
      <button type="button" class="autocomplete-option" data-troca-modelo-id="${item.id}">
        <strong>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</strong>
        <span>${escapeHtml(item.classificacao || '-')}</span>
      </button>
    `).join('');
    trocaModeloSugestoes.classList.remove('hidden');
  }

  function handleSelecionarNovoModelo(event) {
    const option = event.target.closest('button[data-troca-modelo-id]');
    if (!option) {
      return;
    }

    const modelo = modelosElegiveisCache.find((item) => Number(item.id) === Number(option.dataset.trocaModeloId));
    if (!modelo || Number(modelo.id) === Number(serialTrocaAtual?.id_modelo_servo)) {
      return;
    }

    trocaModeloId.value = String(modelo.id);
    trocaModeloBusca.value = `${modelo.codigo} - ${modelo.descricao}`;
    renderizarResumoNovoModelo(modelo);
    esconderSugestoesNovoModelo();
  }

  function renderizarResumoNovoModelo(modelo) {
    if (!trocaModeloResumo || !trocaConfirmar) {
      return;
    }

    trocaConfirmar.disabled = !modelo;
    trocaModeloResumo.classList.toggle('empty', !modelo);
    trocaModeloResumo.innerHTML = modelo
      ? `
        <span class="selected-tag">Novo: ${escapeHtml(modelo.codigo)}</span>
        <span class="selected-tag">${escapeHtml(modelo.descricao)}</span>
        <span class="selected-tag">${escapeHtml(modelo.classificacao || '-')}</span>
      `
      : 'Selecione o novo modelo para continuar.';
  }

  function esconderSugestoesNovoModelo() {
    if (!trocaModeloSugestoes) {
      return;
    }

    trocaModeloSugestoes.classList.add('hidden');
    trocaModeloSugestoes.innerHTML = '';
  }

  async function handleConfirmarTrocaModelo(event) {
    event.preventDefault();

    const serialId = Number.parseInt(trocaSerialId.value, 10);
    const novoModeloId = Number.parseInt(trocaModeloId.value, 10);

    if (!Number.isInteger(serialId) || !Number.isInteger(novoModeloId)) {
      mostrarErroTroca(new Error('Selecione um numero de serie e um novo modelo validos.'));
      return;
    }

    trocaConfirmar.disabled = true;
    trocaMensagem.className = 'message hidden';
    trocaMensagem.textContent = '';

    try {
      const result = await fetchJson(`${seriaisDisponiveisApiBaseUrl}/${serialId}/trocar-modelo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_modelo_servo: novoModeloId })
      });

      closeTrocaModal();
      modeloExpandidoId = Number(result.modelo_novo?.id || novoModeloId);
      await carregarTabela();
      subtitulo.textContent = `Troca concluida: ${result.numero_serie} agora pertence ao modelo ${result.modelo_novo?.codigo || '-'}. Estoques atualizados com sucesso.`;

      if (window.SafisaSync?.notify) {
        window.SafisaSync.notify(['submontagem-seriais', 'estoque']);
      }
    } catch (error) {
      mostrarErroTroca(error);
      trocaConfirmar.disabled = false;
    }
  }

  function mostrarErroTroca(error) {
    if (!trocaMensagem) {
      return;
    }

    const faltantes = Array.isArray(error?.details?.faltantes) ? error.details.faltantes : [];
    trocaMensagem.innerHTML = `
      <strong>${escapeHtml(error.message || 'Nao foi possivel trocar o modelo.')}</strong>
      ${faltantes.length
        ? `<div class="table-subtext">${faltantes.map((item) => escapeHtml(`${item.codigo}: faltam ${formatInteger(item.quantidade_faltante)}`)).join(' | ')}</div>`
        : ''}
    `;
    trocaMensagem.className = 'message error';
    trocaMensagem.classList.remove('hidden');
  }

  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal');
  }

  function closeModal() {
    closeTrocaModal();
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    modeloExpandidoId = null;
    modoEdicaoModelo = false;
    atualizarBotaoEdicao();

    const modalAberto = [...document.querySelectorAll('.modal')].some((item) => !item.classList.contains('hidden'));
    document.body.classList.toggle('has-modal', modalAberto);
  }
});

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(result.message || 'Nao foi possivel concluir a operacao.');
    error.details = result.details || null;
    throw error;
  }

  return result;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
