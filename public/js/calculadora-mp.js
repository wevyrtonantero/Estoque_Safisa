(() => {
  const apiBaseUrl = '/api/calculadora-materia-prima';
  const estoqueMateriaPrimaUrl = '/pagina-estoque-materias-primas';

  const state = {
    pecas: [],
    selectedPeca: null,
    searchTimer: null
  };

  let refs = {};

  document.addEventListener('DOMContentLoaded', () => {
    const triggers = Array.from(document.querySelectorAll('[data-calculadora-mp-trigger]'));
    if (!triggers.length) {
      return;
    }

    injectModal();
    cacheRefs();
    bindEvents(triggers);
    carregarPecas('');
  });

  function injectModal() {
    if (document.getElementById('calculadora-mp-modal')) {
      return;
    }

    document.body.insertAdjacentHTML('beforeend', `
      <div id="calculadora-mp-modal" class="modal hidden" aria-hidden="true">
        <div class="modal-backdrop" data-close-modal="calculadora-mp"></div>

        <div class="modal-dialog modal-wide">
          <div class="modal-header">
            <div>
              <span class="section-pill">Materia-prima</span>
              <h2>Calculadora de consumo</h2>
              <p>Escolha a peca, simule uma quantidade ou use todo o estoque disponivel da materia-prima.</p>
            </div>

            <button id="btn-fechar-calculadora-mp" class="icon-btn" type="button" aria-label="Fechar modal">X</button>
          </div>

          <div id="calculadora-mp-mensagem" class="message hidden"></div>

          <form id="calculadora-mp-form" class="form-grid">
            <input id="calculadora-mp-peca-id" type="hidden">

            <div class="field span-8">
              <label for="calculadora-mp-peca-busca">Peca</label>
              <div class="autocomplete">
                <input id="calculadora-mp-peca-busca" type="text" autocomplete="off" placeholder="Digite codigo, descricao ou materia-prima">
                <div id="calculadora-mp-sugestoes" class="autocomplete-panel hidden"></div>
              </div>
            </div>

            <div class="field span-4">
              <label for="calculadora-mp-quantidade">Quantidade desejada</label>
              <input id="calculadora-mp-quantidade" type="number" min="1" step="1" placeholder="Ex.: 1000">
            </div>

            <div class="field span-4">
              <label for="calculadora-mp-comprimento">Comprimento de corte (mm)</label>
              <input id="calculadora-mp-comprimento" type="number" min="0.01" step="0.01" placeholder="Usa o cadastro da peca">
            </div>

            <div class="field span-8">
              <label>Consulta rapida</label>
              <div class="calc-mp-actions">
                <button id="btn-calcular-mp-quantidade" class="btn btn-primary" type="submit">Calcular quantidade</button>
                <button id="btn-calcular-mp-estoque" class="btn btn-secondary" type="button">Usar todo estoque</button>
                <a class="btn btn-neutral" href="${estoqueMateriaPrimaUrl}">Consultar estoque MP</a>
              </div>
            </div>

            <div id="calculadora-mp-resumo" class="span-12 selected-tags empty">Selecione uma peca para ver a materia-prima vinculada.</div>
          </form>

          <div id="calculadora-mp-resultado" class="calc-mp-result hidden"></div>

          <div class="modal-actions">
            <button id="btn-cancelar-calculadora-mp" class="btn btn-neutral" type="button">Fechar</button>
          </div>
        </div>
      </div>
    `);
  }

  function cacheRefs() {
    refs = {
      modal: document.getElementById('calculadora-mp-modal'),
      form: document.getElementById('calculadora-mp-form'),
      mensagem: document.getElementById('calculadora-mp-mensagem'),
      pecaId: document.getElementById('calculadora-mp-peca-id'),
      pecaBusca: document.getElementById('calculadora-mp-peca-busca'),
      sugestoes: document.getElementById('calculadora-mp-sugestoes'),
      quantidade: document.getElementById('calculadora-mp-quantidade'),
      comprimento: document.getElementById('calculadora-mp-comprimento'),
      resumo: document.getElementById('calculadora-mp-resumo'),
      resultado: document.getElementById('calculadora-mp-resultado'),
      btnEstoque: document.getElementById('btn-calcular-mp-estoque'),
      btnFechar: document.getElementById('btn-fechar-calculadora-mp'),
      btnCancelar: document.getElementById('btn-cancelar-calculadora-mp')
    };
  }

  function bindEvents(triggers) {
    triggers.forEach((trigger) => {
      trigger.addEventListener('click', () => openModal());
    });

    refs.form.addEventListener('submit', (event) => {
      event.preventDefault();
      simular(false);
    });

    refs.btnEstoque.addEventListener('click', () => simular(true));
    refs.btnFechar.addEventListener('click', closeModal);
    refs.btnCancelar.addEventListener('click', closeModal);
    refs.modal.addEventListener('click', handleBackdrop);
    refs.sugestoes.addEventListener('click', handleSugestaoClick);

    refs.pecaBusca.addEventListener('input', () => {
      refs.pecaId.value = '';
      state.selectedPeca = null;
      renderResumo();
      hideResult();
      scheduleSearch(refs.pecaBusca.value.trim());
    });

    refs.pecaBusca.addEventListener('focus', () => {
      renderSugestoes(state.pecas);
    });

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleKeyboardShortcut);
  }

  async function carregarPecas(q) {
    const params = new URLSearchParams();
    if (q) {
      params.append('q', q);
    }

    try {
      const endpoint = `${apiBaseUrl}/pecas${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(endpoint);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Nao foi possivel carregar as pecas da calculadora.');
      }

      state.pecas = Array.isArray(result) ? result : [];
      renderSugestoes(state.pecas);
    } catch (error) {
      state.pecas = [];
      renderSugestoes([]);
      mostrarMensagem(error.message, 'error');
    }
  }

  function scheduleSearch(q) {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => carregarPecas(q), 220);
  }

  async function simular(usarTodoEstoque) {
    const idPeca = Number.parseInt(refs.pecaId.value, 10);

    if (!Number.isInteger(idPeca)) {
      mostrarMensagem('Selecione uma peca da lista para calcular.', 'error');
      refs.pecaBusca.focus();
      return;
    }

    if (!usarTodoEstoque && (!refs.quantidade.value || Number(refs.quantidade.value) <= 0)) {
      mostrarMensagem('Informe a quantidade desejada ou use todo o estoque disponivel.', 'error');
      refs.quantidade.focus();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_peca: idPeca,
          quantidade_pecas: refs.quantidade.value,
          comprimento_corte_mm: refs.comprimento.value,
          usar_todo_estoque: usarTodoEstoque
        })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Nao foi possivel calcular o consumo.');
      }

      state.selectedPeca = {
        ...result.peca,
        materia_prima: result.materia_prima,
        estoque: result.estoque
      };
      renderResumo();
      renderResultado(result);
      mostrarMensagem('', '');
    } catch (error) {
      hideResult();
      mostrarMensagem(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    refs.modal.classList.remove('hidden');
    refs.modal.setAttribute('aria-hidden', 'false');
    refs.pecaBusca.focus();
  }

  function closeModal() {
    refs.modal.classList.add('hidden');
    refs.modal.setAttribute('aria-hidden', 'true');
    refs.sugestoes.classList.add('hidden');
  }

  function handleBackdrop(event) {
    if (event.target.dataset.closeModal === 'calculadora-mp') {
      closeModal();
    }
  }

  function handleGlobalClick(event) {
    if (!refs.modal || refs.modal.classList.contains('hidden')) {
      return;
    }

    if (!event.target.closest('.autocomplete')) {
      refs.sugestoes.classList.add('hidden');
    }
  }

  function handleKeyboardShortcut(event) {
    if (event.key === 'Escape' && refs.modal && !refs.modal.classList.contains('hidden')) {
      closeModal();
    }
  }

  function handleSugestaoClick(event) {
    const option = event.target.closest('.autocomplete-option');
    if (!option) {
      return;
    }

    const id = Number.parseInt(option.dataset.id, 10);
    const item = state.pecas.find((peca) => Number(peca.id) === id);
    if (!item) {
      return;
    }

    state.selectedPeca = item;
    refs.pecaId.value = String(item.id);
    refs.pecaBusca.value = `${item.codigo} - ${item.descricao}`;
    refs.comprimento.value = item.comprimento_mm ? String(Number(item.comprimento_mm)) : '';
    refs.sugestoes.classList.add('hidden');
    renderResumo();
    hideResult();
  }

  function renderSugestoes(items) {
    if (!refs.sugestoes || document.activeElement !== refs.pecaBusca) {
      return;
    }

    if (!items.length) {
      refs.sugestoes.innerHTML = '<div class="autocomplete-empty">Nenhuma peca produzida encontrada.</div>';
      refs.sugestoes.classList.remove('hidden');
      return;
    }

    refs.sugestoes.innerHTML = items.slice(0, 30).map((item) => `
      <button type="button" class="autocomplete-option" data-id="${item.id}">
        <strong>${escapeHtml(item.codigo)} - ${escapeHtml(item.descricao)}</strong>
        <span>${escapeHtml(formatMateriaPrimaLabel(item.materia_prima))} | Saldo ${formatEstoque(item.estoque)}</span>
      </button>
    `).join('');
    refs.sugestoes.classList.remove('hidden');
  }

  function renderResumo() {
    if (!state.selectedPeca) {
      refs.resumo.className = 'span-12 selected-tags empty';
      refs.resumo.textContent = 'Selecione uma peca para ver a materia-prima vinculada.';
      return;
    }

    const peca = state.selectedPeca;
    refs.resumo.className = 'span-12 selected-tags';
    refs.resumo.innerHTML = `
      <span class="selected-tag">${escapeHtml(peca.codigo)} - ${escapeHtml(peca.descricao)}</span>
      <span class="selected-tag">${escapeHtml(formatMateriaPrimaLabel(peca.materia_prima))}</span>
      <span class="selected-tag">Saldo: ${escapeHtml(formatEstoque(peca.estoque))}</span>
      ${peca.comprimento_mm ? `<span class="selected-tag">Corte: ${formatDecimal(peca.comprimento_mm, 2)} mm</span>` : ''}
    `;
  }

  function renderResultado(result) {
    const simulacao = result.simulacao || {};
    const capacidade = result.capacidade || {};
    const consumo = simulacao.consumo || {};
    const estoque = result.estoque || {};
    const capacidadeTexto = `${formatInteger(capacidade.pecas_possiveis)} peca(s)`;
    const saldoClass = simulacao.saldo_suficiente ? 'is-success' : 'is-warning';

    refs.resultado.innerHTML = `
      <div class="inline-note ${saldoClass}">${escapeHtml(simulacao.alerta || '')}</div>

      <div class="view-grid calc-mp-result-grid">
        <article class="view-card">
          <span>Materia-prima vinculada</span>
          <strong>${escapeHtml(formatMateriaPrimaLabel(result.materia_prima))}</strong>
        </article>
        <article class="view-card">
          <span>Saldo atual</span>
          <strong>${escapeHtml(formatEstoque(estoque))}</strong>
        </article>
        <article class="view-card">
          <span>Capacidade com o saldo atual</span>
          <strong>${capacidadeTexto}</strong>
        </article>
        <article class="view-card">
          <span>Quantidade simulada</span>
          <strong>${formatInteger(simulacao.quantidade_pecas)} peca(s)</strong>
        </article>
        <article class="view-card">
          <span>Baixa no estoque</span>
          <strong>${formatDecimal(consumo.quantidade_baixada, 4)} ${escapeHtml(consumo.unidade_baixa || '')}</strong>
        </article>
        <article class="view-card">
          <span>Consumo tecnico</span>
          <strong>${formatConsumoTecnico(consumo)}</strong>
        </article>
        <article class="view-card">
          <span>Saldo depois da simulacao</span>
          <strong>${formatDecimal(simulacao.saldo_restante, 4)} ${escapeHtml(simulacao.unidade_saldo || '')}</strong>
        </article>
        <article class="view-card">
          <span>Aproveitamento da barra</span>
          <strong>${formatAproveitamento(capacidade)}</strong>
        </article>
      </div>
    `;
    refs.resultado.classList.remove('hidden');
  }

  function hideResult() {
    refs.resultado.classList.add('hidden');
    refs.resultado.innerHTML = '';
  }

  function setLoading(isLoading) {
    refs.form.querySelectorAll('button').forEach((button) => {
      button.disabled = isLoading;
    });
  }

  function mostrarMensagem(message, type) {
    if (!message) {
      refs.mensagem.className = 'message hidden';
      refs.mensagem.textContent = '';
      return;
    }

    refs.mensagem.className = `message ${type || 'success'}`;
    refs.mensagem.textContent = message;
  }

  function formatMateriaPrimaLabel(item) {
    if (!item) {
      return 'Sem materia-prima';
    }

    return `${item.codigo || '-'} - ${item.nome || '-'}`;
  }

  function formatEstoque(estoque) {
    if (!estoque) {
      return '-';
    }

    const detalhes = [];
    if (estoque.metros_estimados !== null && estoque.metros_estimados !== undefined) {
      detalhes.push(`${formatDecimal(estoque.metros_estimados, 2)} m`);
    }
    if (estoque.barras_estimadas !== null && estoque.barras_estimadas !== undefined) {
      detalhes.push(`${formatDecimal(estoque.barras_estimadas, 2)} barra(s)`);
    }

    const base = `${formatDecimal(estoque.quantidade, 4)} ${estoque.unidade || ''}`.trim();
    return detalhes.length ? `${base} (${detalhes.join(' | ')})` : base;
  }

  function formatConsumoTecnico(consumo) {
    const partes = [];

    if (consumo.metros !== null && consumo.metros !== undefined) {
      partes.push(`${formatDecimal(consumo.metros, 4)} m`);
    }
    if (consumo.peso_kg !== null && consumo.peso_kg !== undefined) {
      partes.push(`${formatDecimal(consumo.peso_kg, 4)} kg`);
    }
    if (consumo.barras !== null && consumo.barras !== undefined) {
      partes.push(`${formatDecimal(consumo.barras, 2)} barra(s)`);
    }
    if (consumo.unidades !== null && consumo.unidades !== undefined) {
      partes.push(`${formatDecimal(consumo.unidades, 4)} un`);
    }
    if (consumo.comprimento_corte_mm !== null && consumo.comprimento_corte_mm !== undefined) {
      partes.push(`corte ${formatDecimal(consumo.comprimento_corte_mm, 2)} mm`);
    }

    return partes.length ? partes.join(' | ') : '-';
  }

  function formatAproveitamento(capacidade) {
    if (!capacidade || !capacidade.pecas_por_barra) {
      return 'Sem comprimento padrao de barra para estimar.';
    }

    const sobra = capacidade.sobra_por_barra_mm === null || capacidade.sobra_por_barra_mm === undefined
      ? ''
      : ` | sobra ${formatDecimal(capacidade.sobra_por_barra_mm, 2)} mm`;
    return `${formatInteger(capacidade.pecas_por_barra)} peca(s) por barra${sobra}`;
  }

  function formatDecimal(value, maximumFractionDigits = 2) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return '-';
    }

    return parsed.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits
    });
  }

  function formatInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return '0';
    }

    return Math.floor(parsed).toLocaleString('pt-BR');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
