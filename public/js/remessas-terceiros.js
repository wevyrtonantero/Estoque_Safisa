const terceirizacaoApiBaseUrl = '/api/terceirizacao';
const estoquesApiBaseUrl = '/api/estoques';

let remessasCache = [];
let stocksCache = [];
let remessaSelecionada = null;
let itemRetornoSelecionado = null;
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('remessas-mensagem'),
  tabela: document.getElementById('remessas-tbody'),
  total: document.getElementById('total-remessas'),
  filtroForm: document.getElementById('remessas-filtro-form'),
  drawer: document.getElementById('app-drawer'),
  drawerScrim: document.getElementById('drawer-scrim'),
  detalheModal: document.getElementById('remessa-detalhe-modal'),
  detalheTitulo: document.getElementById('remessa-detalhe-titulo'),
  detalheSubtitulo: document.getElementById('remessa-detalhe-subtitulo'),
  empresaView: document.getElementById('remessa-empresa-view'),
  nfView: document.getElementById('remessa-nf-view'),
  enderecoView: document.getElementById('remessa-endereco-view'),
  dataEnvioView: document.getElementById('remessa-data-envio-view'),
  itensTbody: document.getElementById('remessa-itens-tbody'),
  nfModal: document.getElementById('remessa-nf-modal'),
  nfMensagem: document.getElementById('remessa-nf-mensagem'),
  nfId: document.getElementById('remessa-nf-id'),
  nfNumero: document.getElementById('remessa-nf-numero'),
  nfData: document.getElementById('remessa-nf-data'),
  nfObservacao: document.getElementById('remessa-nf-observacao'),
  retornoModal: document.getElementById('remessa-retorno-modal'),
  retornoMensagem: document.getElementById('remessa-retorno-mensagem'),
  retornoItemId: document.getElementById('remessa-retorno-item-id'),
  retornoResumo: document.getElementById('remessa-retorno-resumo'),
  retornoQuantidade: document.getElementById('remessa-retorno-quantidade'),
  retornoEstoque: document.getElementById('remessa-retorno-estoque'),
  retornoObservacao: document.getElementById('remessa-retorno-observacao')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarRemessas(), carregarEstoques()]);
});

function bindEvents() {
  document.getElementById('menu-toggle').addEventListener('click', () => toggleDrawer(true));
  document.getElementById('drawer-close').addEventListener('click', () => toggleDrawer(false));
  refs.drawerScrim.addEventListener('click', () => toggleDrawer(false));
  document.getElementById('btn-limpar-filtros-remessas').addEventListener('click', limparFiltros);
  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarRemessas();
  });
  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
  refs.tabela.addEventListener('click', handleTabelaActions);
  refs.itensTbody.addEventListener('click', handleItemActions);
  document.getElementById('btn-fechar-modal-remessa-detalhe').addEventListener('click', fecharModalDetalhe);
  document.getElementById('btn-imprimir-remessa').addEventListener('click', imprimirRemessaAtual);
  document.getElementById('btn-editar-nf-remessa').addEventListener('click', abrirModalNfAtual);
  document.getElementById('btn-fechar-modal-remessa-nf').addEventListener('click', fecharModalNf);
  document.getElementById('btn-cancelar-modal-remessa-nf').addEventListener('click', fecharModalNf);
  document.getElementById('remessa-nf-form').addEventListener('submit', handleSalvarNf);
  document.getElementById('btn-fechar-modal-remessa-retorno').addEventListener('click', fecharModalRetorno);
  document.getElementById('btn-cancelar-modal-remessa-retorno').addEventListener('click', fecharModalRetorno);
  document.getElementById('remessa-retorno-form').addEventListener('submit', handleRegistrarRetorno);
  refs.detalheModal.addEventListener('click', handleBackdrop);
  refs.nfModal.addEventListener('click', handleBackdrop);
  refs.retornoModal.addEventListener('click', handleBackdrop);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function carregarRemessas() {
  const params = new URLSearchParams();
  const empresa = document.getElementById('filtro-remessa-empresa').value.trim();
  const status = document.getElementById('filtro-remessa-status').value;
  const nf = document.getElementById('filtro-remessa-nf').value.trim();

  if (empresa) params.append('empresa', empresa);
  if (status) params.append('status', status);
  if (nf) params.append('nf', nf);

  try {
    const endpoint = params.toString()
      ? `${terceirizacaoApiBaseUrl}/remessas?${params.toString()}`
      : `${terceirizacaoApiBaseUrl}/remessas`;
    const response = await fetch(endpoint);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar as remessas.');
    }

    remessasCache = result;
    renderizarRemessas();
    atualizarIndicadores();
  } catch (error) {
    remessasCache = [];
    renderizarRemessas();
    atualizarIndicadores();
    mostrarMensagem(error.message, 'error');
  }
}

async function carregarEstoques() {
  const response = await fetch(estoquesApiBaseUrl);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar os estoques.');
  }

  stocksCache = result;
  refs.retornoEstoque.innerHTML = `
    <option value="">Selecione</option>
    ${stocksCache.map((stock) => `<option value="${stock.id}">${escapeHtml(stock.nome)}</option>`).join('')}
  `;
}

function renderizarRemessas() {
  refs.total.textContent = `${remessasCache.length} registro(s) encontrado(s)`;

  if (remessasCache.length === 0) {
    refs.tabela.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma remessa encontrada.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = remessasCache.map((remessa) => `
    <tr class="${remessa.numero_nf ? '' : 'table-row-attention'}">
      <td class="table-description">${escapeHtml(remessa.nome_empresa)}</td>
      <td>${renderStatusBadge(remessa.status)}</td>
      <td>${renderNfCell(remessa)}</td>
      <td>${formatarData(remessa.data_envio)}</td>
      <td class="table-quantity">${formatInteger(remessa.total_itens)}</td>
      <td class="table-quantity">${formatInteger(remessa.quantidade_enviada_total)}</td>
      <td class="table-quantity">${formatWeight(remessa.peso_total_enviado_kg)}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="detalhes" data-id="${remessa.id}">Visualizar</button>
            <button type="button" class="row-menu-item" data-action="nf" data-id="${remessa.id}">Complementar NF</button>
            <button type="button" class="row-menu-item" data-action="imprimir" data-id="${remessa.id}">Imprimir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function renderNfCell(remessa) {
  if (!remessa.numero_nf) {
    return '<span class="status-chip is-warning">Sem NF</span>';
  }

  return escapeHtml(remessa.numero_nf);
}

function atualizarIndicadores() {
  const abertas = remessasCache.filter((item) => item.status !== 'RETORNO_TOTAL' && item.status !== 'CANCELADA').length;
  const semNf = remessasCache.filter((item) => !item.numero_nf).length;
  const peso = remessasCache.reduce((total, item) => total + Number(item.peso_total_enviado_kg || 0), 0);

  document.getElementById('metric-remessas-abertas').textContent = String(abertas);
  document.getElementById('metric-remessas-sem-nf').textContent = String(semNf);
  document.getElementById('metric-remessas-peso').textContent = `${formatWeight(peso)}`;
}

async function handleTabelaActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const id = button.dataset.id;

  if (button.dataset.action === 'detalhes') {
    await abrirModalDetalhe(id);
    return;
  }

  if (button.dataset.action === 'nf') {
    await abrirModalNf(id);
    return;
  }

  if (button.dataset.action === 'imprimir') {
    await abrirModalDetalhe(id);
    imprimirRemessaAtual();
  }
}

async function abrirModalDetalhe(id) {
  const response = await fetch(`${terceirizacaoApiBaseUrl}/remessas/${id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel carregar a remessa.');
  }

  remessaSelecionada = result;
  refs.detalheTitulo.textContent = `Remessa #${result.id}`;
  refs.detalheSubtitulo.textContent = result.observacao || 'Remessa pronta para acompanhamento, impressao e retorno.';
  refs.empresaView.textContent = result.nome_empresa;
  refs.nfView.textContent = result.numero_nf ? `${result.numero_nf} | ${result.data_nf || '-'}` : 'Sem NF';
  refs.enderecoView.textContent = [result.endereco, result.cidade, result.cep].filter(Boolean).join(' | ') || '-';
  refs.dataEnvioView.textContent = formatarData(result.data_envio);

  if (!Array.isArray(result.itens) || result.itens.length === 0) {
    refs.itensTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum item nesta remessa.</td></tr>';
  } else {
    refs.itensTbody.innerHTML = result.itens.map((item) => `
      <tr>
        <td class="table-code">${escapeHtml(item.codigo)}</td>
        <td class="table-description">${escapeHtml(item.descricao)}</td>
        <td>${escapeHtml(buildTreatmentLabel(item))}</td>
        <td class="table-quantity">${formatInteger(item.quantidade_enviada)}</td>
        <td class="table-quantity">${formatInteger(item.quantidade_retorno)}</td>
        <td class="table-quantity">${formatWeight(item.peso_total_enviado_kg)}</td>
        <td class="table-actions-cell">
          <details class="row-menu">
            <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
            <div class="row-menu-panel">
              <button type="button" class="row-menu-item" data-action="retorno" data-item-id="${item.id}">Registrar retorno</button>
            </div>
          </details>
        </td>
      </tr>
    `).join('');
  }

  openModal(refs.detalheModal);
}

function fecharModalDetalhe() {
  remessaSelecionada = null;
  refs.itensTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum item carregado.</td></tr>';
  closeModal(refs.detalheModal);
}

async function abrirModalNf(id) {
  if (!remessaSelecionada || Number(remessaSelecionada.id) !== Number(id)) {
    await abrirModalDetalhe(id);
  }

  refs.nfMensagem.className = 'message hidden';
  refs.nfMensagem.textContent = '';
  refs.nfId.value = String(remessaSelecionada.id);
  refs.nfNumero.value = remessaSelecionada.numero_nf || '';
  refs.nfData.value = remessaSelecionada.data_nf ? String(remessaSelecionada.data_nf).slice(0, 10) : '';
  refs.nfObservacao.value = remessaSelecionada.observacao || '';
  openModal(refs.nfModal);
}

function abrirModalNfAtual() {
  if (!remessaSelecionada) {
    return;
  }

  abrirModalNf(remessaSelecionada.id);
}

function fecharModalNf() {
  document.getElementById('remessa-nf-form').reset();
  refs.nfMensagem.className = 'message hidden';
  refs.nfMensagem.textContent = '';
  closeModal(refs.nfModal);
}

async function handleSalvarNf(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${terceirizacaoApiBaseUrl}/remessas/${refs.nfId.value}/nf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero_nf: refs.nfNumero.value.trim(),
        data_nf: refs.nfData.value,
        observacao: refs.nfObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel salvar a NF.');
    }

    fecharModalNf();
    mostrarMensagem('NF atualizada com sucesso.', 'success');
    await carregarRemessas();
    if (remessaSelecionada && Number(remessaSelecionada.id) === Number(result.id)) {
      remessaSelecionada = result;
      await abrirModalDetalhe(result.id);
    }
  } catch (error) {
    refs.nfMensagem.textContent = error.message;
    refs.nfMensagem.className = 'message error';
    refs.nfMensagem.classList.remove('hidden');
  }
}

function handleItemActions(event) {
  const button = event.target.closest('button[data-action="retorno"]');
  if (!button || !remessaSelecionada) {
    return;
  }

  const item = remessaSelecionada.itens.find((entry) => Number(entry.id) === Number(button.dataset.itemId));
  if (!item) {
    return;
  }

  itemRetornoSelecionado = item;
  refs.retornoMensagem.className = 'message hidden';
  refs.retornoMensagem.textContent = '';
  refs.retornoItemId.value = String(item.id);
  refs.retornoQuantidade.value = '1';
  const pendente = Number(item.quantidade_enviada) - Number(item.quantidade_retorno);
  refs.retornoQuantidade.max = String(pendente);
  refs.retornoResumo.classList.remove('empty');
  refs.retornoResumo.classList.add('selected-tags');
  refs.retornoResumo.innerHTML = `
    <span class="selected-tag">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</span>
    <span class="selected-tag">${escapeHtml(`Pendente: ${formatInteger(pendente)}`)}</span>
  `;
  openModal(refs.retornoModal);
}

function fecharModalRetorno() {
  itemRetornoSelecionado = null;
  document.getElementById('remessa-retorno-form').reset();
  refs.retornoResumo.classList.add('selected-tags', 'empty');
  refs.retornoResumo.textContent = 'Selecione um item para registrar o retorno.';
  refs.retornoMensagem.className = 'message hidden';
  refs.retornoMensagem.textContent = '';
  closeModal(refs.retornoModal);
}

async function handleRegistrarRetorno(event) {
  event.preventDefault();

  try {
    const response = await fetch(`${terceirizacaoApiBaseUrl}/retorno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_item: refs.retornoItemId.value,
        id_estoque_destino: refs.retornoEstoque.value,
        quantidade_retorno: refs.retornoQuantidade.value,
        observacao: refs.retornoObservacao.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel registrar o retorno.');
    }

    fecharModalRetorno();
    mostrarMensagem('Retorno registrado com sucesso.', 'success');
    await carregarRemessas();
    remessaSelecionada = result;
    await abrirModalDetalhe(result.id);
  } catch (error) {
    refs.retornoMensagem.textContent = error.message;
    refs.retornoMensagem.className = 'message error';
    refs.retornoMensagem.classList.remove('hidden');
  }
}

function imprimirRemessaAtual() {
  if (!remessaSelecionada) {
    return;
  }

  const totalPeso = remessaSelecionada.itens.reduce(
    (sum, item) => sum + Number(item.peso_total_enviado_kg || 0),
    0
  );

  const rows = remessaSelecionada.itens.map((item) => `
    <tr>
      <td>${escapeHtml(item.codigo)}</td>
      <td>${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(buildTreatmentLabel(item))}</td>
      <td>${formatInteger(item.quantidade_enviada)}</td>
      <td>${formatWeight(item.peso_total_enviado_kg)}</td>
    </tr>
  `).join('');

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    mostrarMensagem('Nao foi possivel abrir a janela de impressao.', 'error');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Remessa ${escapeHtml(remessaSelecionada.nome_empresa)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        .header { display: flex; justify-content: space-between; margin-bottom: 18px; }
        .header strong { display: block; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #222; padding: 8px; text-align: left; }
        th { background: #efefef; }
        .total { margin-top: 22px; text-align: right; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <strong>${escapeHtml(remessaSelecionada.nome_empresa)}</strong>
          <div>${escapeHtml([remessaSelecionada.endereco, remessaSelecionada.cidade, remessaSelecionada.cep].filter(Boolean).join(' | ') || '-')}</div>
        </div>
        <div>
          <div>NF SAFISA ${escapeHtml(remessaSelecionada.numero_nf || '')}</div>
          <div>Data ${escapeHtml(remessaSelecionada.data_nf || String(remessaSelecionada.data_envio).slice(0, 10) || '')}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Cod</th>
            <th>Descricao</th>
            <th>Tratamento</th>
            <th>Qtds</th>
            <th>Peso total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="total">Total ${formatWeight(totalPeso)}</div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function limparFiltros() {
  refs.filtroForm.reset();
  carregarRemessas();
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarRemessas(), 220);
}

function handleBackdrop(event) {
  if (event.target.dataset.closeModal === 'remessa-detalhe') {
    fecharModalDetalhe();
  }
  if (event.target.dataset.closeModal === 'remessa-nf') {
    fecharModalNf();
  }
  if (event.target.dataset.closeModal === 'remessa-retorno') {
    fecharModalRetorno();
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

  if (!refs.retornoModal.classList.contains('hidden')) {
    fecharModalRetorno();
    return;
  }
  if (!refs.nfModal.classList.contains('hidden')) {
    fecharModalNf();
    return;
  }
  if (!refs.detalheModal.classList.contains('hidden')) {
    fecharModalDetalhe();
    return;
  }
  if (refs.drawer.classList.contains('is-open')) {
    toggleDrawer(false);
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
  const hasModal = [refs.detalheModal, refs.nfModal, refs.retornoModal].some((entry) => !entry.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasModal);
}

function toggleDrawer(shouldOpen) {
  refs.drawer.classList.toggle('is-open', shouldOpen);
  refs.drawerScrim.classList.toggle('hidden', !shouldOpen);
  document.body.classList.toggle('has-drawer', shouldOpen);
}

function mostrarMensagem(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function renderStatusBadge(status) {
  const normalized = String(status || '').toUpperCase();
  let cssClass = 'status-chip';

  if (normalized === 'RETORNO_TOTAL') {
    cssClass += ' is-success';
  } else if (normalized === 'RETORNO_PARCIAL') {
    cssClass += ' is-warning';
  } else if (normalized === 'CANCELADA') {
    cssClass += ' is-danger';
  }

  return `<span class="${cssClass}">${escapeHtml(status || '-')}</span>`;
}

function buildTreatmentLabel(item) {
  if (item.tipo_tratamento === 'MULTIELOS') {
    return item.servicos || 'Multielos';
  }

  const parts = ['Tratamento termico'];
  if (item.dureza_hrc) parts.push(item.dureza_hrc);
  if (item.profundidade) parts.push(item.profundidade);
  return parts.join(' | ');
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatWeight(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  })} kg`;
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
