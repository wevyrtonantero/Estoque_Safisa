const configEstoqueEspecial = window.ESTOQUE_ESPECIAL_CONFIG || {};
const estoqueEspecialApiBaseUrl = `/api/estoques-especiais/${encodeURIComponent(configEstoqueEspecial.tipo || '')}`;
const estoquesApiBaseUrl = '/api/estoques';

let registrosCache = [];
let stocksCache = [];
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('estoque-especial-mensagem'),
  tabela: document.getElementById('estoque-especial-tbody'),
  total: document.getElementById('total-estoque-especial'),
  filtroForm: document.getElementById('estoque-especial-filtro-form'),
  refugoModal: document.getElementById('especial-refugo-modal'),
  refugoMensagem: document.getElementById('especial-refugo-mensagem'),
  refugoResumo: document.getElementById('especial-refugo-resumo'),
  refugoId: document.getElementById('especial-refugo-id'),
  refugoQuantidade: document.getElementById('especial-refugo-quantidade'),
  refugoNome: document.getElementById('especial-refugo-nome'),
  refugoMotivo: document.getElementById('especial-refugo-motivo'),
  estoqueModal: document.getElementById('especial-estoque-modal'),
  estoqueMensagem: document.getElementById('especial-estoque-mensagem'),
  estoqueResumo: document.getElementById('especial-estoque-resumo'),
  estoqueId: document.getElementById('especial-estoque-id'),
  estoqueQuantidade: document.getElementById('especial-estoque-quantidade'),
  estoqueDestino: document.getElementById('especial-estoque-destino'),
  estoqueObservacao: document.getElementById('especial-estoque-observacao'),
  tratamentoModal: document.getElementById('especial-tratamento-modal'),
  tratamentoMensagem: document.getElementById('especial-tratamento-mensagem'),
  tratamentoResumo: document.getElementById('especial-tratamento-resumo'),
  tratamentoId: document.getElementById('especial-tratamento-id'),
  tratamentoQuantidade: document.getElementById('especial-tratamento-quantidade'),
  tratamentoObservacao: document.getElementById('especial-tratamento-observacao'),
  producaoModal: document.getElementById('especial-producao-modal'),
  producaoMensagem: document.getElementById('especial-producao-mensagem'),
  producaoResumo: document.getElementById('especial-producao-resumo'),
  producaoId: document.getElementById('especial-producao-id'),
  producaoQuantidade: document.getElementById('especial-producao-quantidade'),
  producaoObservacao: document.getElementById('especial-producao-observacao'),
  producaoForm: document.getElementById('especial-producao-form')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarRegistros(), carregarStocks()]);
});

function bindEvents() {
  document.getElementById('btn-especial-atualizar-menu').addEventListener('click', carregarRegistros);
  document.getElementById('btn-limpar-filtros-especial').addEventListener('click', limparFiltros);
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarRegistros();
  });
  refs.filtroForm.querySelectorAll('input').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
  });

  refs.tabela.addEventListener('click', handleTabelaActions);
  document.getElementById('btn-fechar-modal-especial-refugo').addEventListener('click', fecharModalRefugo);
  document.getElementById('btn-cancelar-modal-especial-refugo').addEventListener('click', fecharModalRefugo);
  document.getElementById('especial-refugo-form').addEventListener('submit', handleRefugoSubmit);
  document.getElementById('btn-fechar-modal-especial-estoque').addEventListener('click', fecharModalEstoque);
  document.getElementById('btn-cancelar-modal-especial-estoque').addEventListener('click', fecharModalEstoque);
  document.getElementById('especial-estoque-form').addEventListener('submit', handleEstoqueSubmit);
  document.getElementById('btn-fechar-modal-especial-tratamento').addEventListener('click', fecharModalTratamento);
  document.getElementById('btn-cancelar-modal-especial-tratamento').addEventListener('click', fecharModalTratamento);
  document.getElementById('especial-tratamento-form').addEventListener('submit', handleTratamentoSubmit);
  if (refs.producaoModal) {
    document.getElementById('btn-fechar-modal-especial-producao').addEventListener('click', fecharModalProducao);
    document.getElementById('btn-cancelar-modal-especial-producao').addEventListener('click', fecharModalProducao);
    refs.producaoForm.addEventListener('submit', handleProducaoSubmit);
    refs.producaoModal.addEventListener('click', handleBackdrop);
  }
  refs.refugoModal.addEventListener('click', handleBackdrop);
  refs.estoqueModal.addEventListener('click', handleBackdrop);
  refs.tratamentoModal.addEventListener('click', handleBackdrop);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarRegistros() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-especial-codigo').value.trim();
  const descricao = document.getElementById('filtro-especial-descricao').value.trim();
  const detalhe = document.getElementById('filtro-especial-detalhe').value.trim();
  const origem = document.getElementById('filtro-especial-origem').value.trim();

  if (codigo) params.append('codigo', codigo);
  if (descricao) params.append('descricao', descricao);
  if (detalhe) params.append('detalhe', detalhe);
  if (origem) params.append('origem', origem);

  try {
    const endpoint = params.toString()
      ? `${estoqueEspecialApiBaseUrl}/registros?${params.toString()}`
      : `${estoqueEspecialApiBaseUrl}/registros`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    registrosCache = Array.isArray(result) ? result : [];
    renderizarRegistros();
    atualizarIndicadores();
  } catch (error) {
    registrosCache = [];
    renderizarRegistros();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

async function carregarStocks() {
  try {
    const response = await fetch(estoquesApiBaseUrl);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    stocksCache = Array.isArray(result) ? result : [];
  } catch (error) {
    stocksCache = [];
    mostrarMensagem(error.message, 'error');
  }
}

function renderizarRegistros() {
  refs.total.textContent = `${registrosCache.length} registro(s) encontrado(s)`;

  if (registrosCache.length === 0) {
    refs.tabela.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(configEstoqueEspecial.emptyMessage || 'Nenhum registro encontrado.')}</td></tr>`;
    return;
  }

  refs.tabela.innerHTML = registrosCache.map((item) => {
    const detalhe = obterDetalhe(item);
    const estoqueButton = configEstoqueEspecial.permiteEstoque
      ? `<button type="button" class="row-menu-item" data-action="estoque" data-id="${item.id}">Encaminhar para estoque</button>`
      : '';
    const producaoButton = configEstoqueEspecial.permiteProducao
      ? `<button type="button" class="row-menu-item" data-action="producao" data-id="${item.id}">Iniciar producao</button>`
      : '';

    return `
      <tr>
        <td>${formatarData(item.created_at)}</td>
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(item.descricao)}</td>
        <td>${escapeHtml(detalhe || '-')}</td>
        <td>${escapeHtml(formatarOrigem(item.origem))}</td>
        <td class="table-quantity">${formatInteger(item.quantidade)}</td>
        <td class="table-actions-cell">
          <details class="row-menu">
            <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
            <div class="row-menu-panel">
              <button type="button" class="row-menu-item danger" data-action="refugo" data-id="${item.id}">Refugo</button>
              ${producaoButton}
              ${estoqueButton}
              <button type="button" class="row-menu-item" data-action="tratamento" data-id="${item.id}">Encaminhar para tratamento externo</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('');
}

function atualizarIndicadores() {
  const quantidadeTotal = registrosCache.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  const maisAntigo = registrosCache.length > 0
    ? registrosCache
      .map((item) => item.created_at)
      .filter(Boolean)
      .sort()[0]
    : null;

  document.getElementById('metric-especial-registros').textContent = String(registrosCache.length);
  document.getElementById('metric-especial-quantidade').textContent = formatInteger(quantidadeTotal);
  document.getElementById('metric-especial-antigo').textContent = maisAntigo
    ? new Date(maisAntigo).toLocaleDateString('pt-BR')
    : '-';
}

function handleTabelaActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const item = registrosCache.find((entry) => Number(entry.id) === Number(button.dataset.id));
  if (!item) {
    return;
  }

  if (button.dataset.action === 'refugo') {
    abrirModalRefugo(item);
    return;
  }

  if (button.dataset.action === 'estoque') {
    abrirModalEstoque(item);
    return;
  }

  if (button.dataset.action === 'tratamento') {
    abrirModalTratamento(item);
    return;
  }

  if (button.dataset.action === 'producao') {
    abrirModalProducao(item);
  }
}

function abrirModalRefugo(item) {
  resetRefugoModal();
  refs.refugoId.value = String(item.id);
  refs.refugoQuantidade.value = '1';
  refs.refugoQuantidade.max = String(item.quantidade);
  preencherResumo(refs.refugoResumo, item);
  openModal(refs.refugoModal);
}

function fecharModalRefugo() {
  resetRefugoModal();
  closeModal(refs.refugoModal);
}

function resetRefugoModal() {
  document.getElementById('especial-refugo-form').reset();
  refs.refugoId.value = '';
  refs.refugoQuantidade.removeAttribute('max');
  limparResumo(refs.refugoResumo);
  limparMensagem(refs.refugoMensagem);
}

async function handleRefugoSubmit(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${estoqueEspecialApiBaseUrl}/registros/${refs.refugoId.value}/refugo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidade: refs.refugoQuantidade.value,
        nome: refs.refugoNome.value.trim(),
        motivo: refs.refugoMotivo.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalRefugo();
    mostrarMensagem('Refugo registrado com sucesso.', 'success');
    await carregarRegistros();
  } catch (error) {
    refs.refugoMensagem.textContent = error.message;
    refs.refugoMensagem.className = 'message error';
    refs.refugoMensagem.classList.remove('hidden');
  }
}

function abrirModalEstoque(item) {
  if (!configEstoqueEspecial.permiteEstoque) {
    mostrarMensagem('Esta tela nao envia pecas diretamente para estoque.', 'error');
    return;
  }

  resetEstoqueModal();
  refs.estoqueId.value = String(item.id);
  refs.estoqueQuantidade.value = '1';
  refs.estoqueQuantidade.max = String(item.quantidade);
  preencherResumo(refs.estoqueResumo, item);
  renderizarEstoquesDestino(item);
  openModal(refs.estoqueModal);
}

function fecharModalEstoque() {
  resetEstoqueModal();
  closeModal(refs.estoqueModal);
}

function resetEstoqueModal() {
  document.getElementById('especial-estoque-form').reset();
  refs.estoqueId.value = '';
  refs.estoqueQuantidade.removeAttribute('max');
  refs.estoqueDestino.innerHTML = '<option value="">Selecione</option>';
  limparResumo(refs.estoqueResumo);
  limparMensagem(refs.estoqueMensagem);
}

function renderizarEstoquesDestino(item) {
  const nomesBloqueados = new Set(['RETRABALHO', 'PECAS INACABADAS', 'PEÇAS INACABADAS']);
  const options = stocksCache
    .filter((stock) => Number(stock.ativo) === 1)
    .filter((stock) => Number(stock.id) !== Number(item.id_estoque))
    .filter((stock) => !nomesBloqueados.has(String(stock.nome || '').trim().toUpperCase()))
    .map((stock) => `<option value="${stock.id}">${escapeHtml(stock.nome)}</option>`)
    .join('');

  refs.estoqueDestino.innerHTML = `<option value="">Selecione</option>${options}`;
}

async function handleEstoqueSubmit(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${estoqueEspecialApiBaseUrl}/registros/${refs.estoqueId.value}/enviar-estoque`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidade: refs.estoqueQuantidade.value,
        id_estoque_destino: refs.estoqueDestino.value,
        observacao: refs.estoqueObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalEstoque();
    mostrarMensagem('Peca encaminhada para estoque com sucesso.', 'success');
    await carregarRegistros();
  } catch (error) {
    refs.estoqueMensagem.textContent = error.message;
    refs.estoqueMensagem.className = 'message error';
    refs.estoqueMensagem.classList.remove('hidden');
  }
}

function abrirModalTratamento(item) {
  resetTratamentoModal();
  refs.tratamentoId.value = String(item.id);
  refs.tratamentoQuantidade.value = '1';
  refs.tratamentoQuantidade.max = String(item.quantidade);
  preencherResumo(refs.tratamentoResumo, item);
  openModal(refs.tratamentoModal);
}

function fecharModalTratamento() {
  resetTratamentoModal();
  closeModal(refs.tratamentoModal);
}

function resetTratamentoModal() {
  document.getElementById('especial-tratamento-form').reset();
  refs.tratamentoId.value = '';
  refs.tratamentoQuantidade.removeAttribute('max');
  limparResumo(refs.tratamentoResumo);
  limparMensagem(refs.tratamentoMensagem);
}

async function handleTratamentoSubmit(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${estoqueEspecialApiBaseUrl}/registros/${refs.tratamentoId.value}/enviar-tratamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidade: refs.tratamentoQuantidade.value,
        observacao: refs.tratamentoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalTratamento();
    mostrarMensagem('Peca encaminhada para tratamento externo.', 'success');
    await carregarRegistros();
  } catch (error) {
    refs.tratamentoMensagem.textContent = error.message;
    refs.tratamentoMensagem.className = 'message error';
    refs.tratamentoMensagem.classList.remove('hidden');
  }
}

function abrirModalProducao(item) {
  if (!configEstoqueEspecial.permiteProducao || !refs.producaoModal) {
    mostrarMensagem('Esta tela nao permite iniciar producao por aqui.', 'error');
    return;
  }

  resetProducaoModal();
  refs.producaoId.value = String(item.id);
  refs.producaoQuantidade.value = '1';
  refs.producaoQuantidade.max = String(item.quantidade);
  preencherResumo(refs.producaoResumo, item);
  openModal(refs.producaoModal);
}

function fecharModalProducao() {
  if (!refs.producaoModal) {
    return;
  }

  resetProducaoModal();
  closeModal(refs.producaoModal);
}

function resetProducaoModal() {
  if (!refs.producaoForm) {
    return;
  }

  refs.producaoForm.reset();
  refs.producaoId.value = '';
  refs.producaoQuantidade.removeAttribute('max');
  limparResumo(refs.producaoResumo);
  limparMensagem(refs.producaoMensagem);
}

async function handleProducaoSubmit(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${estoqueEspecialApiBaseUrl}/registros/${refs.producaoId.value}/iniciar-producao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidade: refs.producaoQuantidade.value,
        observacao: refs.producaoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalProducao();
    mostrarMensagem(`Producao iniciada com sucesso. OP ${result.producao?.id || '-'}.`, 'success');
    await carregarRegistros();
  } catch (error) {
    refs.producaoMensagem.textContent = error.message;
    refs.producaoMensagem.className = 'message error';
    refs.producaoMensagem.classList.remove('hidden');
  }
}

function preencherResumo(container, item) {
  container.classList.remove('empty');
  container.classList.add('selected-tags');
  container.innerHTML = `
    <span class="selected-tag">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo: ${formatInteger(item.quantidade)}`)}</span>
    <span class="selected-tag">${escapeHtml(`${configEstoqueEspecial.detalheLabel || 'Detalhe'}: ${obterDetalhe(item) || '-'}`)}</span>
  `;
}

function limparResumo(container) {
  container.classList.add('selected-tags', 'empty');
  container.textContent = 'Selecione uma peca para continuar.';
}

function obterDetalhe(item) {
  return configEstoqueEspecial.tipo === 'RETRABALHO'
    ? item.defeito
    : item.falta_fazer;
}

function formatarOrigem(value) {
  const normalized = String(value || '-').replaceAll('_', ' ').toLowerCase();
  return normalized.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function limparFiltros() {
  refs.filtroForm.reset();
  carregarRegistros();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarRegistros(), 220);
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'especial-refugo') {
    fecharModalRefugo();
  }

  if (event.target.dataset.closeModal === 'especial-estoque') {
    fecharModalEstoque();
  }

  if (event.target.dataset.closeModal === 'especial-tratamento') {
    fecharModalTratamento();
  }

  if (event.target.dataset.closeModal === 'especial-producao') {
    fecharModalProducao();
  }
}

function handleGlobalClick(event) {
  const trigger = event.target.closest('.row-menu-trigger');
  if (trigger) {
    const currentMenu = trigger.closest('.row-menu');
    window.requestAnimationFrame(() => {
      const shouldKeepOpen = currentMenu && currentMenu.hasAttribute('open');
      closeAllRowMenus(shouldKeepOpen ? currentMenu : null);
      if (shouldKeepOpen) {
        ajustarDirecaoRowMenu(currentMenu);
      }
    });
    return;
  }

  if (event.target.closest('.row-menu-item')) {
    closeAllRowMenus();
  }

  if (!event.target.closest('.row-menu')) {
    closeAllRowMenus();
  }
}

function closeAllRowMenus(exceptMenu = null) {
  document.querySelectorAll('.row-menu[open]').forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) {
      return;
    }

    menu.classList.remove('drop-up');
    menu.removeAttribute('open');
  });
}

function ajustarDirecaoRowMenu(menu) {
  if (!menu) {
    return;
  }

  menu.classList.remove('drop-up');

  const panel = menu.querySelector('.row-menu-panel');
  const trigger = menu.querySelector('.row-menu-trigger');

  if (!panel || !trigger) {
    return;
  }

  const wrapper = menu.closest('.table-wrapper');
  const triggerRect = trigger.getBoundingClientRect();
  const panelHeight = panel.offsetHeight || 180;
  const limiteInferior = wrapper ? wrapper.getBoundingClientRect().bottom : window.innerHeight;
  const limiteSuperior = wrapper ? wrapper.getBoundingClientRect().top : 0;
  const espacoAbaixo = limiteInferior - triggerRect.bottom;
  const espacoAcima = triggerRect.top - limiteSuperior;

  if (espacoAbaixo < panelHeight + 12 && espacoAcima > espacoAbaixo) {
    menu.classList.add('drop-up');
  }
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  closeAllRowMenus();

  if (!refs.refugoModal.classList.contains('hidden')) {
    fecharModalRefugo();
    return;
  }

  if (!refs.estoqueModal.classList.contains('hidden')) {
    fecharModalEstoque();
    return;
  }

  if (!refs.tratamentoModal.classList.contains('hidden')) {
    fecharModalTratamento();
    return;
  }

  if (refs.producaoModal && !refs.producaoModal.classList.contains('hidden')) {
    fecharModalProducao();
  }
}

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  const hasModal = [refs.refugoModal, refs.estoqueModal, refs.tratamentoModal, refs.producaoModal]
    .some((entry) => entry && !entry.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function limparMensagem(element) {
  element.textContent = '';
  element.className = 'message hidden';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatarData(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
