const tratamentoExternoApiBaseUrl = '/api/tratamento-externo';
const terceirizacaoApiBaseUrl = '/api/terceirizacao';
const estoquesApiBaseUrl = '/api/estoques';
const fornecedoresApiBaseUrl = '/api/fornecedores';

const SPECIAL_PROVIDER_KEYS = Object.freeze({
  MULTIELOS: 'MULTIELOS',
  TEMPERA: 'TEMPERA',
  GENERICO: 'EXTERNO'
});

let saldosCache = [];
let movimentacoesCache = [];
let providersCache = [];
let stocksCache = [];
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('tratamento-externo-mensagem'),
  tabela: document.getElementById('tratamento-externo-tbody'),
  total: document.getElementById('total-tratamento-externo'),
  movimentacoesTabela: document.getElementById('tratamento-externo-movimentacoes-tbody'),
  totalMovimentacoes: document.getElementById('total-tratamento-externo-movimentacoes'),
  filtroForm: document.getElementById('tratamento-externo-filtro-form'),
  historicoModal: document.getElementById('tratamento-historico-modal'),
  encaminhamentoModal: document.getElementById('encaminhamento-modal'),
  encaminhamentoMensagem: document.getElementById('encaminhamento-mensagem'),
  encaminhamentoResumo: document.getElementById('encaminhamento-resumo'),
  encaminhamentoIdPeca: document.getElementById('encaminhamento-id-peca'),
  encaminhamentoQuantidade: document.getElementById('encaminhamento-quantidade'),
  encaminhamentoFornecedor: document.getElementById('encaminhamento-fornecedor'),
  encaminhamentoFornecedoresLista: document.getElementById('encaminhamento-fornecedores-lista'),
  encaminhamentoTipoTratamento: document.getElementById('encaminhamento-tipo-tratamento'),
  encaminhamentoServicosWrap: document.getElementById('encaminhamento-servicos-wrap'),
  encaminhamentoServicosLista: document.getElementById('encaminhamento-servicos-lista'),
  encaminhamentoTemperaWrap: document.getElementById('encaminhamento-tempera-wrap'),
  encaminhamentoDureza: document.getElementById('encaminhamento-dureza'),
  encaminhamentoProfundidade: document.getElementById('encaminhamento-profundidade'),
  encaminhamentoNumeroNf: document.getElementById('encaminhamento-numero-nf'),
  encaminhamentoDataNf: document.getElementById('encaminhamento-data-nf'),
  encaminhamentoObservacao: document.getElementById('encaminhamento-observacao'),
  estoqueDiretoModal: document.getElementById('estoque-direto-modal'),
  estoqueDiretoMensagem: document.getElementById('estoque-direto-mensagem'),
  estoqueDiretoResumo: document.getElementById('estoque-direto-resumo'),
  estoqueDiretoIdPeca: document.getElementById('estoque-direto-id-peca'),
  estoqueDiretoQuantidade: document.getElementById('estoque-direto-quantidade'),
  estoqueDiretoDestino: document.getElementById('estoque-direto-destino'),
  estoqueDiretoObservacao: document.getElementById('estoque-direto-observacao')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([
    carregarSaldos(),
    carregarMovimentacoes(),
    carregarProviders(),
    carregarStocks()
  ]);
});

function bindEvents() {
  document.getElementById('btn-tratamento-historico-menu').addEventListener('click', abrirModalHistorico);
  document.getElementById('btn-fechar-modal-tratamento-historico').addEventListener('click', fecharModalHistorico);
  document.getElementById('btn-limpar-filtros-te').addEventListener('click', limparFiltros);
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarSaldos();
  });
  refs.filtroForm.querySelectorAll('input').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
  });
  refs.tabela.addEventListener('click', handleTabelaActions);
  refs.encaminhamentoFornecedor.addEventListener('input', handleProviderChange);
  refs.encaminhamentoFornecedor.addEventListener('change', handleProviderChange);
  document.getElementById('btn-fechar-modal-encaminhamento').addEventListener('click', fecharModalEncaminhamento);
  document.getElementById('btn-cancelar-modal-encaminhamento').addEventListener('click', fecharModalEncaminhamento);
  document.getElementById('encaminhamento-form').addEventListener('submit', handleEncaminhamentoSubmit);
  document.getElementById('btn-fechar-modal-estoque-direto').addEventListener('click', fecharModalEstoqueDireto);
  document.getElementById('btn-cancelar-modal-estoque-direto').addEventListener('click', fecharModalEstoqueDireto);
  document.getElementById('estoque-direto-form').addEventListener('submit', handleEnviarEstoqueSubmit);
  refs.historicoModal.addEventListener('click', handleBackdrop);
  refs.encaminhamentoModal.addEventListener('click', handleBackdrop);
  refs.estoqueDiretoModal.addEventListener('click', handleBackdrop);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarSaldos() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-te-codigo').value.trim();
  const descricao = document.getElementById('filtro-te-descricao').value.trim();

  if (codigo) params.append('codigo', codigo);
  if (descricao) params.append('descricao', descricao);

  try {
    const endpoint = params.toString()
      ? `${tratamentoExternoApiBaseUrl}/saldos?${params.toString()}`
      : `${tratamentoExternoApiBaseUrl}/saldos`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar o tratamento externo.');
    }

    saldosCache = result;
    renderizarSaldos();
    atualizarIndicadores();
  } catch (error) {
    saldosCache = [];
    renderizarSaldos();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

async function carregarMovimentacoes() {
  try {
    const response = await fetch(`${tratamentoExternoApiBaseUrl}/movimentacoes`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar as movimentacoes.');
    }

    movimentacoesCache = result;
    renderizarMovimentacoes();
    atualizarIndicadores();
  } catch (error) {
    movimentacoesCache = [];
    renderizarMovimentacoes();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

async function carregarProviders() {
  const [specialResponse, suppliersResponse] = await Promise.all([
    fetch(`${terceirizacaoApiBaseUrl}/opcoes`),
    fetch(fornecedoresApiBaseUrl)
  ]);
  const [specialResult, suppliersResult] = await Promise.all([
    specialResponse.json(),
    suppliersResponse.json()
  ]);

  if (!specialResponse.ok) {
    throw new Error(specialResult.message || 'Nao foi possivel carregar as empresas de tratamento.');
  }

  if (!suppliersResponse.ok) {
    throw new Error(suppliersResult.message || 'Nao foi possivel carregar os fornecedores.');
  }

  const specialProviders = Array.isArray(specialResult)
    ? specialResult.map((provider) => ({
      ...provider,
      key: String(provider.key || '').trim().toUpperCase(),
      especial: true
    }))
    : [];

  const specialIds = new Set(specialProviders.map((provider) => Number(provider.id)));
  const genericProviders = Array.isArray(suppliersResult)
    ? suppliersResult
      .filter((supplier) => Number.isInteger(Number(supplier.id)) && !specialIds.has(Number(supplier.id)))
      .map((supplier) => ({
        id: Number(supplier.id),
        key: SPECIAL_PROVIDER_KEYS.GENERICO,
        nome: supplier.nome,
        cidade: supplier.cidade || '',
        endereco: supplier.endereco || '',
        cep: supplier.cep || '',
        observacao: supplier.observacao || '',
        servicos: [],
        dureza_padrao: '',
        profundidade_padrao: '',
        especial: false
      }))
      .sort((left, right) => String(left.nome || '').localeCompare(String(right.nome || ''), 'pt-BR'))
    : [];

  providersCache = [...specialProviders, ...genericProviders];
  refs.encaminhamentoFornecedoresLista.innerHTML = providersCache
    .map((provider) => `<option value="${escapeHtml(provider.nome)}"></option>`)
    .join('');
}
async function carregarStocks() {
  const response = await fetch(estoquesApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os estoques.');
  }

  stocksCache = result;
  refs.estoqueDiretoDestino.innerHTML = `
    <option value="">Selecione</option>
    ${stocksCache.map((stock) => `<option value="${stock.id}">${escapeHtml(stock.nome)}</option>`).join('')}
  `;
}

function renderizarSaldos() {
  refs.total.textContent = `${saldosCache.length} registro(s) encontrado(s)`;

  if (saldosCache.length === 0) {
    refs.tabela.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma peca aguardando tratamento externo.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = saldosCache.map((item) => `
    <tr>
      <td class="table-code">${escapeHtml(item.codigo)}</td>
      <td class="table-description">${escapeHtml(item.descricao)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td>${formatarData(item.updated_at)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="encaminhar" data-id="${item.id_peca}">Encaminhar peca</button>
            <button type="button" class="row-menu-item" data-action="enviar-estoque" data-id="${item.id_peca}">Enviar para estoque</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function renderizarMovimentacoes() {
  refs.totalMovimentacoes.textContent = `${movimentacoesCache.length} movimentacao(oes)`;

  if (movimentacoesCache.length === 0) {
    refs.movimentacoesTabela.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma movimentacao registrada.</td></tr>';
    return;
  }

  refs.movimentacoesTabela.innerHTML = movimentacoesCache.slice(0, 20).map((item) => `
    <tr>
      <td>${formatarData(item.data_movimentacao)}</td>
      <td>${escapeHtml(item.tipo_movimentacao)}</td>
      <td>${escapeHtml(`${item.codigo} - ${item.descricao}`)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade)}</td>
      <td class="table-quantity">${formatInteger(item.saldo_resultante || 0)}</td>
      <td>${escapeHtml(item.observacao || '-')}</td>
    </tr>
  `).join('');
}

function atualizarIndicadores() {
  const quantidadeTotal = saldosCache.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  document.getElementById('metric-te-itens').textContent = String(saldosCache.length);
  document.getElementById('metric-te-quantidade').textContent = formatInteger(quantidadeTotal);
  document.getElementById('metric-te-movimentacoes').textContent = String(movimentacoesCache.length);
}

function abrirModalHistorico() {
  openModal(refs.historicoModal);
}

function fecharModalHistorico() {
  closeModal(refs.historicoModal);
}

function handleTabelaActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const item = saldosCache.find((entry) => Number(entry.id_peca) === Number(button.dataset.id));
  if (!item) {
    return;
  }

  if (button.dataset.action === 'encaminhar') {
    abrirModalEncaminhamento(item);
    return;
  }

  if (button.dataset.action === 'enviar-estoque') {
    abrirModalEstoqueDireto(item);
  }
}

function abrirModalEncaminhamento(item) {
  resetEncaminhamentoModal();
  refs.encaminhamentoIdPeca.value = String(item.id_peca);
  refs.encaminhamentoQuantidade.value = '1';
  refs.encaminhamentoResumo.classList.remove('empty');
  refs.encaminhamentoResumo.classList.add('selected-tags');
  refs.encaminhamentoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo: ${formatInteger(item.quantidade)}`)}</span>
  `;
  refs.encaminhamentoQuantidade.max = String(item.quantidade);
  openModal(refs.encaminhamentoModal);
}

function fecharModalEncaminhamento() {
  resetEncaminhamentoModal();
  closeModal(refs.encaminhamentoModal);
}

function resetEncaminhamentoModal() {
  document.getElementById('encaminhamento-form').reset();
  refs.encaminhamentoIdPeca.value = '';
  refs.encaminhamentoTipoTratamento.value = '';
  refs.encaminhamentoResumo.classList.add('selected-tags', 'empty');
  refs.encaminhamentoResumo.textContent = 'Selecione uma peca na tabela para continuar.';
  refs.encaminhamentoMensagem.className = 'message hidden';
  refs.encaminhamentoMensagem.textContent = '';
  refs.encaminhamentoServicosWrap.classList.add('hidden');
  refs.encaminhamentoTemperaWrap.classList.add('hidden');
  refs.encaminhamentoServicosLista.innerHTML = '';
}

function handleProviderChange() {
  const provider = findProviderByTypedName(refs.encaminhamentoFornecedor.value);

  refs.encaminhamentoServicosWrap.classList.add('hidden');
  refs.encaminhamentoTemperaWrap.classList.add('hidden');
  refs.encaminhamentoServicosLista.innerHTML = '';
  refs.encaminhamentoTipoTratamento.value = SPECIAL_PROVIDER_KEYS.GENERICO;

  if (!provider) {
    return;
  }

  refs.encaminhamentoTipoTratamento.value = provider.key;

  if (provider.key === SPECIAL_PROVIDER_KEYS.MULTIELOS) {
    refs.encaminhamentoServicosWrap.classList.remove('hidden');
    refs.encaminhamentoServicosLista.innerHTML = provider.servicos.map((service, index) => `
      <label class="selected-tag" for="service-${index}">
        <input id="service-${index}" type="checkbox" value="${escapeHtml(service)}" data-service-checkbox>
        <span>${escapeHtml(service)}</span>
      </label>
    `).join('');
    return;
  }

  if (provider.key === SPECIAL_PROVIDER_KEYS.TEMPERA) {
    refs.encaminhamentoTemperaWrap.classList.remove('hidden');
    refs.encaminhamentoDureza.value = provider.dureza_padrao || '56 a 58 HRC';
    refs.encaminhamentoProfundidade.value = provider.profundidade_padrao || '0,3 a 0,6 mm';
  }
}
async function handleEncaminhamentoSubmit(event) {
  event.preventDefault();

  const servicos = Array.from(document.querySelectorAll('[data-service-checkbox]:checked')).map((input) => input.value);
  const provider = findProviderByTypedName(refs.encaminhamentoFornecedor.value);

  try {
    const response = await fetch(`${terceirizacaoApiBaseUrl}/encaminhar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: refs.encaminhamentoIdPeca.value,
        id_fornecedor: provider ? provider.id : null,
        empresa_destino: refs.encaminhamentoFornecedor.value.trim(),
        quantidade: refs.encaminhamentoQuantidade.value,
        tipo_tratamento: refs.encaminhamentoTipoTratamento.value || SPECIAL_PROVIDER_KEYS.GENERICO,
        servicos,
        dureza_hrc: refs.encaminhamentoDureza.value.trim(),
        profundidade: refs.encaminhamentoProfundidade.value.trim(),
        numero_nf: refs.encaminhamentoNumeroNf.value.trim(),
        data_nf: refs.encaminhamentoDataNf.value,
        observacao: refs.encaminhamentoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalEncaminhamento();
    mostrarMensagem('Peca encaminhada para terceiro com sucesso.', 'success');
    await Promise.all([carregarSaldos(), carregarMovimentacoes()]);
  } catch (error) {
    refs.encaminhamentoMensagem.textContent = error.message;
    refs.encaminhamentoMensagem.className = 'message error';
    refs.encaminhamentoMensagem.classList.remove('hidden');
  }
}

function normalizeProviderName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function findProviderByTypedName(value) {
  const typedName = normalizeProviderName(value);

  if (!typedName) {
    return null;
  }

  return providersCache.find((provider) => normalizeProviderName(provider.nome) === typedName) || null;
}

function abrirModalEstoqueDireto(item) {
  resetEstoqueDiretoModal();
  refs.estoqueDiretoIdPeca.value = String(item.id_peca);
  refs.estoqueDiretoQuantidade.value = '1';
  refs.estoqueDiretoQuantidade.max = String(item.quantidade);
  refs.estoqueDiretoResumo.classList.remove('empty');
  refs.estoqueDiretoResumo.classList.add('selected-tags');
  refs.estoqueDiretoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Saldo: ${formatInteger(item.quantidade)}`)}</span>
  `;
  openModal(refs.estoqueDiretoModal);
}

function fecharModalEstoqueDireto() {
  resetEstoqueDiretoModal();
  closeModal(refs.estoqueDiretoModal);
}

function resetEstoqueDiretoModal() {
  document.getElementById('estoque-direto-form').reset();
  refs.estoqueDiretoIdPeca.value = '';
  refs.estoqueDiretoResumo.classList.add('selected-tags', 'empty');
  refs.estoqueDiretoResumo.textContent = 'Selecione uma peca na tabela para continuar.';
  refs.estoqueDiretoMensagem.className = 'message hidden';
  refs.estoqueDiretoMensagem.textContent = '';
}

async function handleEnviarEstoqueSubmit(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${tratamentoExternoApiBaseUrl}/enviar-estoque`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_peca: refs.estoqueDiretoIdPeca.value,
        id_estoque_destino: refs.estoqueDiretoDestino.value,
        quantidade: refs.estoqueDiretoQuantidade.value,
        observacao: refs.estoqueDiretoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalEstoqueDireto();
    mostrarMensagem('Item enviado ao estoque com sucesso.', 'success');
    await Promise.all([carregarSaldos(), carregarMovimentacoes()]);
  } catch (error) {
    refs.estoqueDiretoMensagem.textContent = error.message;
    refs.estoqueDiretoMensagem.className = 'message error';
    refs.estoqueDiretoMensagem.classList.remove('hidden');
  }
}

function limparFiltros() {
  refs.filtroForm.reset();
  carregarSaldos();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarSaldos(), 220);
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'tratamento-historico') {
    fecharModalHistorico();
  }

  if (event.target.dataset.closeModal === 'encaminhamento') {
    fecharModalEncaminhamento();
  }

  if (event.target.dataset.closeModal === 'estoque-direto') {
    fecharModalEstoqueDireto();
  }
}

function handleGlobalClick(event) {
  const trigger = event.target.closest('.row-menu-trigger');
  if (trigger) {
    const currentMenu = trigger.closest('.row-menu');
    window.requestAnimationFrame(() => {
      const keepOpen = currentMenu && currentMenu.hasAttribute('open');
      closeAllRowMenus(keepOpen ? currentMenu : null);
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

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  closeAllRowMenus();

  if (!refs.historicoModal.classList.contains('hidden')) {
    fecharModalHistorico();
    return;
  }

  if (!refs.estoqueDiretoModal.classList.contains('hidden')) {
    fecharModalEstoqueDireto();
    return;
  }

  if (!refs.encaminhamentoModal.classList.contains('hidden')) {
    fecharModalEncaminhamento();
    return;
  }
}

function closeAllRowMenus(exceptMenu = null) {
  document.querySelectorAll('.row-menu[open]').forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) {
      return;
    }

    menu.removeAttribute('open');
  });
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  const hasModal = [refs.historicoModal, refs.encaminhamentoModal, refs.estoqueDiretoModal]
    .some((entry) => entry && !entry.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
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
