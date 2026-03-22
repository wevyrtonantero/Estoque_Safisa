const submontagensApiUrl = '/api/submontagens';
const itensSimplesApiUrl = '/api/itens-simples';

let submontagensCache = [];
let itensCache = [];
let componentesEstruturaCache = [];
let componentesDraft = [];
let submontagemAtual = null;
let editandoSubmontagemId = null;
let editandoComponenteId = null;
let modoComponente = 'draft';
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('submontagem-mensagem'),
  mensagemEstrutura: document.getElementById('estrutura-mensagem'),
  mensagemSubmontagem: document.getElementById('submontagem-modal-mensagem'),
  mensagemComponente: document.getElementById('componente-modal-mensagem'),
  tabelaSubmontagens: document.getElementById('submontagens-tbody'),
  tabelaEstrutura: document.getElementById('componentes-tbody'),
  tabelaDraft: document.getElementById('submontagem-componentes-tbody'),
  filtroForm: document.getElementById('submontagem-filtro-form'),
  submontagemForm: document.getElementById('submontagem-form'),
  componenteForm: document.getElementById('componente-form'),
  estruturaModal: document.getElementById('estrutura-modal'),
  submontagemModal: document.getElementById('submontagem-modal'),
  componenteModal: document.getElementById('componente-modal'),
  drawer: document.getElementById('app-drawer'),
  drawerScrim: document.getElementById('drawer-scrim')
};

const campos = {
  subId: document.getElementById('submontagem-id'),
  subCodigo: document.getElementById('submontagem-codigo'),
  subDescricao: document.getElementById('submontagem-descricao'),
  subMassa: document.getElementById('submontagem-massa'),
  subEstoqueMinimo: document.getElementById('submontagem-estoque-minimo'),
  subEstoqueSeguranca: document.getElementById('submontagem-estoque-seguranca'),
  subConsumoMensal: document.getElementById('submontagem-consumo-mensal'),
  componenteItemId: document.getElementById('componente-item-id'),
  componenteItemIdAtual: document.getElementById('componente-item-id-atual'),
  componenteItemBusca: document.getElementById('componente-item-busca'),
  componenteQuantidade: document.getElementById('componente-quantidade'),
  componenteObservacao: document.getElementById('componente-observacao'),
  componenteSugestoes: document.getElementById('componente-item-sugestoes')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([carregarItensSimples(), carregarSubmontagens()]);
});

function bindEvents() {
  document.getElementById('btn-nova-submontagem').addEventListener('click', abrirNovaSubmontagem);
  document.getElementById('btn-imprimir-estrutura').addEventListener('click', imprimirEstruturaAtual);
  document.getElementById('btn-submontagem-adicionar-componente').addEventListener('click', abrirNovoComponenteDraft);
  document.getElementById('btn-atualizar-submontagem').addEventListener('click', atualizarSubmontagem);
  document.getElementById('btn-atualizar-componente').addEventListener('click', atualizarComponente);
  document.getElementById('btn-limpar-filtros-submontagem').addEventListener('click', limparFiltros);
  document.getElementById('btn-fechar-modal-estrutura').addEventListener('click', fecharModalEstrutura);
  document.getElementById('btn-cancelar-modal-submontagem').addEventListener('click', fecharModalSubmontagem);
  document.getElementById('btn-fechar-modal-submontagem').addEventListener('click', fecharModalSubmontagem);
  document.getElementById('btn-cancelar-modal-componente').addEventListener('click', fecharModalComponente);
  document.getElementById('btn-fechar-modal-componente').addEventListener('click', fecharModalComponente);
  document.getElementById('menu-toggle').addEventListener('click', () => toggleDrawer(true));
  document.getElementById('drawer-close').addEventListener('click', () => toggleDrawer(false));
  refs.drawerScrim.addEventListener('click', () => toggleDrawer(false));
  document.addEventListener('click', handleGlobalRowMenuClick);

  refs.estruturaModal.addEventListener('click', (event) => {
    if (event.target.dataset.closeModal === 'estrutura') {
      fecharModalEstrutura();
    }
  });

  refs.submontagemModal.addEventListener('click', (event) => {
    if (event.target.dataset.closeModal === 'submontagem') {
      fecharModalSubmontagem();
    }
  });

  refs.componenteModal.addEventListener('click', (event) => {
    if (event.target.dataset.closeModal === 'componente') {
      fecharModalComponente();
    }
  });

  document.addEventListener('keydown', handleKeyboardShortcuts);

  refs.filtroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    carregarSubmontagens();
  });

  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarCarregamentoSubmontagens);
    field.addEventListener('change', agendarCarregamentoSubmontagens);
  });

  refs.submontagemForm.addEventListener('submit', criarSubmontagem);
  refs.componenteForm.addEventListener('submit', criarComponente);
  refs.tabelaSubmontagens.addEventListener('click', handleTabelaSubmontagens);
  refs.tabelaDraft.addEventListener('click', handleTabelaDraft);

  bindAutocompleteItens();
}

function closeAllRowMenus(exceptMenu = null) {
  document.querySelectorAll('.row-menu[open]').forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) {
      return;
    }

    menu.removeAttribute('open');
  });
}

function handleGlobalRowMenuClick(event) {
  const trigger = event.target.closest('.row-menu-trigger');
  if (trigger) {
    const currentMenu = trigger.closest('.row-menu');
    window.requestAnimationFrame(() => {
      const shouldKeepOpen = currentMenu && currentMenu.hasAttribute('open');
      closeAllRowMenus(shouldKeepOpen ? currentMenu : null);
    });
    return;
  }

  if (event.target.closest('.row-menu-item')) {
    closeAllRowMenus();
    return;
  }

  if (!event.target.closest('.row-menu')) {
    closeAllRowMenus();
  }
}

function bindAutocompleteItens() {
  campos.componenteItemBusca.addEventListener('input', () => {
    campos.componenteItemId.value = '';
    renderizarSugestoesItens(campos.componenteItemBusca.value.trim());
  });

  campos.componenteItemBusca.addEventListener('focus', () => {
    renderizarSugestoesItens(campos.componenteItemBusca.value.trim());
  });

  campos.componenteSugestoes.addEventListener('click', (event) => {
    const option = event.target.closest('button[data-item-id]');
    if (!option) {
      return;
    }

    const item = itensCache.find((registro) => Number(registro.id) === Number(option.dataset.itemId));
    if (!item) {
      return;
    }

    campos.componenteItemId.value = item.id;
    campos.componenteItemBusca.value = `${item.codigo} - ${item.descricao}`;
    esconderSugestoesItens();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) {
      esconderSugestoesItens();
    }
  });
}

async function carregarItensSimples() {
  try {
    const response = await fetch(itensSimplesApiUrl);
    const itens = await response.json();

    if (!response.ok) {
      throw new Error(itens.message || 'Erro ao carregar itens simples.');
    }

    itensCache = itens;
  } catch (error) {
    showMessage(refs.mensagem, error.message, 'error');
  }
}

async function carregarSubmontagens() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-sub-codigo').value.trim();
  const descricao = document.getElementById('filtro-sub-descricao').value.trim();

  if (codigo) {
    params.append('codigo', codigo);
  }

  if (descricao) {
    params.append('descricao', descricao);
  }

  try {
    const endpoint = params.toString()
      ? `${submontagensApiUrl}?${params.toString()}`
      : submontagensApiUrl;
    const response = await fetch(endpoint);
    const submontagens = await response.json();

    if (!response.ok) {
      throw new Error(submontagens.message || 'Erro ao carregar submontagens.');
    }

    submontagensCache = submontagens;
    renderizarTabelaSubmontagens();
    atualizarMetricasSubmontagens();

    if (submontagemAtual) {
      const atualizada = submontagensCache.find((item) => Number(item.id) === Number(submontagemAtual.id));
      if (atualizada) {
        await selecionarSubmontagem(atualizada, true);
      } else {
        limparEstruturaAtual();
      }
    }
  } catch (error) {
    showMessage(refs.mensagem, error.message, 'error');
  }
}

function renderizarTabelaSubmontagens() {
  document.getElementById('total-submontagens').textContent = `${submontagensCache.length} registro(s) encontrado(s)`;

  if (submontagensCache.length === 0) {
    refs.tabelaSubmontagens.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma submontagem encontrada para os filtros informados.</td></tr>';
    return;
  }

  refs.tabelaSubmontagens.innerHTML = submontagensCache.map((submontagem) => `
    <tr>
      <td class="table-code">${escapeHtml(submontagem.codigo)}</td>
      <td class="table-description">${escapeHtml(submontagem.descricao)}</td>
      <td>${formatInteger(submontagem.total_componentes || 0)}</td>
      <td>${formatDecimal(submontagem.massa_kg || 0, 3)} kg</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-sub-act="estrutura" data-id="${submontagem.id}">Estrutura</button>
            <button type="button" class="row-menu-item" data-sub-act="editar" data-id="${submontagem.id}">Editar</button>
            <button type="button" class="row-menu-item danger" data-sub-act="excluir" data-id="${submontagem.id}">Excluir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarMetricasSubmontagens() {
  const totalComponentes = submontagensCache.reduce(
    (total, submontagem) => total + Number(submontagem.total_componentes || 0),
    0
  );
  const massaTotal = submontagensCache.reduce(
    (total, submontagem) => total + Number(submontagem.massa_kg || 0),
    0
  );

  document.getElementById('metric-total-submontagens').textContent = String(submontagensCache.length);
  document.getElementById('metric-total-componentes').textContent = formatInteger(totalComponentes);
  document.getElementById('metric-massa-total').textContent = `${formatDecimal(massaTotal, 3)} kg`;
}

async function handleTabelaSubmontagens(event) {
  const actionButton = event.target.closest('button[data-sub-act]');
  if (!actionButton) {
    return;
  }

  const id = Number.parseInt(actionButton.dataset.id, 10);
  const submontagem = submontagensCache.find((item) => Number(item.id) === id);

  if (!submontagem) {
    return;
  }

  if (actionButton.dataset.subAct === 'estrutura') {
    await selecionarSubmontagem(submontagem, true, true);
    return;
  }

  if (actionButton.dataset.subAct === 'editar') {
    await carregarSubmontagemParaEdicao(id);
    return;
  }

  if (!window.confirm('Deseja realmente excluir esta submontagem?')) {
    return;
  }

  try {
    const response = await fetch(`${submontagensApiUrl}/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Erro ao excluir submontagem.');
    }

    if (submontagemAtual && Number(submontagemAtual.id) === id) {
      limparEstruturaAtual();
    }

    showMessage(refs.mensagem, 'Submontagem excluida com sucesso.', 'success');
    await carregarSubmontagens();
  } catch (error) {
    showMessage(refs.mensagem, error.message, 'error');
  }
}

async function selecionarSubmontagem(submontagem, carregarEstrutura = true, abrirEstruturaModal = false) {
  try {
    const submontagemDetalhada = await carregarDetalhesSubmontagem(submontagem.id);
    submontagemAtual = submontagemDetalhada;
    document.getElementById('estrutura-titulo').textContent = `Estrutura de ${submontagemDetalhada.codigo}`;
    document.getElementById('estrutura-subtitulo').textContent = submontagemDetalhada.descricao;
    document.getElementById('estrutura-codigo').textContent = `${submontagemDetalhada.codigo} - ${submontagemDetalhada.descricao}`;
    document.getElementById('estrutura-detalhe').textContent = `Submontagem produzida | Componentes cadastrados: ${submontagemDetalhada.total_componentes || 0}`;
    document.getElementById('estrutura-total-componentes').textContent = `Componentes: ${submontagemDetalhada.total_componentes || 0}`;
    document.getElementById('estrutura-massa-total').textContent = `Massa: ${formatDecimal(submontagemDetalhada.massa_kg || 0, 3)} kg`;

    if (carregarEstrutura) {
      const componentes = await carregarComponentesSubmontagem(submontagemDetalhada.id);
      componentesEstruturaCache = componentes;
      renderizarEstruturaAtual();
    }

    hideMessage(refs.mensagemEstrutura);

    if (abrirEstruturaModal) {
      openModal(refs.estruturaModal);
    }
  } catch (error) {
    showMessage(refs.mensagemEstrutura, error.message, 'error');
    if (abrirEstruturaModal) {
      openModal(refs.estruturaModal);
    }
  }
}

async function carregarDetalhesSubmontagem(id) {
  const response = await fetch(`${submontagensApiUrl}/${id}`);
  const submontagem = await response.json();

  if (!response.ok) {
    throw new Error(submontagem.message || 'Erro ao carregar submontagem.');
  }

  return submontagem;
}

async function carregarComponentesSubmontagem(id) {
  const response = await fetch(`${submontagensApiUrl}/${id}/componentes`);
  const componentes = await response.json();

  if (!response.ok) {
    throw new Error(componentes.message || 'Erro ao carregar estrutura.');
  }

  return componentes;
}

function renderizarEstruturaAtual() {
  if (componentesEstruturaCache.length === 0) {
    refs.tabelaEstrutura.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum componente cadastrado para a submontagem selecionada.</td></tr>';
    return;
  }

  refs.tabelaEstrutura.innerHTML = componentesEstruturaCache.map((component) => `
    <tr>
      <td class="table-code">${escapeHtml(component.codigo_componente)}</td>
      <td class="table-description">${escapeHtml(component.descricao_componente)}</td>
      <td>${formatInteger(component.quantidade)}</td>
      <td>${escapeHtml(component.tipo_componente || '-')}</td>
      <td>${formatDecimal(component.massa_kg || 0, 3)} kg</td>
      <td>${formatDecimal(Number(component.quantidade) * Number(component.massa_kg || 0), 3)} kg</td>
    </tr>
  `).join('');
}

function abrirNovaSubmontagem() {
  resetFormSubmontagem();
  document.getElementById('submontagem-modal-title').textContent = 'Nova Submontagem';
  openModal(refs.submontagemModal);
}

async function carregarSubmontagemParaEdicao(id) {
  try {
    const [submontagemResponse, componentesResponse] = await Promise.all([
      fetch(`${submontagensApiUrl}/${id}`),
      fetch(`${submontagensApiUrl}/${id}/componentes`)
    ]);

    const submontagem = await submontagemResponse.json();
    const componentes = await componentesResponse.json();

    if (!submontagemResponse.ok) {
      throw new Error(submontagem.message || 'Erro ao carregar submontagem.');
    }

    if (!componentesResponse.ok) {
      throw new Error(componentes.message || 'Erro ao carregar estrutura da submontagem.');
    }

    editandoSubmontagemId = submontagem.id;
    campos.subId.value = submontagem.id;
    campos.subCodigo.value = submontagem.codigo;
    campos.subDescricao.value = submontagem.descricao;
    campos.subEstoqueMinimo.value = formatOptionalNumber(submontagem.estoque_minimo);
    campos.subEstoqueSeguranca.value = formatOptionalNumber(submontagem.estoque_seguranca);
    campos.subConsumoMensal.value = formatOptionalNumber(submontagem.consumo_mensal);
    componentesDraft = componentes.map(mapearComponenteParaDraft);
    renderizarTabelaDraft();
    document.getElementById('btn-atualizar-submontagem').disabled = false;
    document.getElementById('btn-salvar-submontagem').disabled = true;
    document.getElementById('submontagem-modal-title').textContent = `Editar ${submontagem.codigo}`;
    openModal(refs.submontagemModal);
  } catch (error) {
    showMessage(refs.mensagem, error.message, 'error');
  }
}

function mapearComponenteParaDraft(component) {
  return {
    id_item_componente: Number(component.id_item_componente),
    codigo_componente: component.codigo_componente,
    descricao_componente: component.descricao_componente,
    tipo_componente: component.tipo_componente,
    massa_kg: Number(component.massa_kg || 0),
    quantidade: Number(component.quantidade),
    observacao: component.observacao || null
  };
}

function renderizarTabelaDraft() {
  if (componentesDraft.length === 0) {
    refs.tabelaDraft.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma peca adicionada na composicao.</td></tr>';
  } else {
    refs.tabelaDraft.innerHTML = componentesDraft.map((component) => `
      <tr>
        <td class="table-code">${escapeHtml(component.codigo_componente)}</td>
        <td class="table-description">${escapeHtml(component.descricao_componente)}</td>
        <td>${formatInteger(component.quantidade)}</td>
        <td>${formatDecimal(Number(component.quantidade) * Number(component.massa_kg || 0), 3)} kg</td>
        <td class="table-actions-cell">
          <details class="row-menu">
            <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
            <div class="row-menu-panel">
              <button type="button" class="row-menu-item" data-draft-component-act="editar" data-id="${component.id_item_componente}">Editar</button>
              <button type="button" class="row-menu-item danger" data-draft-component-act="excluir" data-id="${component.id_item_componente}">Excluir</button>
            </div>
          </details>
        </td>
      </tr>
    `).join('');
  }

  const massaTotal = componentesDraft.reduce(
    (total, component) => total + (Number(component.quantidade) * Number(component.massa_kg || 0)),
    0
  );

  campos.subMassa.value = massaTotal.toFixed(3);
  document.getElementById('submontagem-estrutura-titulo').textContent = componentesDraft.length > 0
    ? 'Pecas prontas para salvar'
    : 'Nenhuma peca adicionada';
  document.getElementById('submontagem-estrutura-subtitulo').textContent = componentesDraft.length > 0
    ? 'A massa da submontagem sera recalculada automaticamente na gravacao.'
    : 'Monte a lista de componentes antes de salvar a submontagem.';
  document.getElementById('submontagem-total-componentes').textContent = `Componentes: ${componentesDraft.length}`;
  document.getElementById('submontagem-massa-chip').textContent = `Massa total: ${formatDecimal(massaTotal, 3)} kg`;
}

function handleTabelaDraft(event) {
  const actionButton = event.target.closest('button[data-draft-component-act]');
  if (!actionButton) {
    return;
  }

  const componenteId = Number.parseInt(actionButton.dataset.id, 10);
  const componente = componentesDraft.find((item) => Number(item.id_item_componente) === componenteId);

  if (!componente) {
    return;
  }

  if (actionButton.dataset.draftComponentAct === 'editar') {
    abrirEdicaoComponenteDraft(componente);
    return;
  }

  componentesDraft = componentesDraft.filter((item) => Number(item.id_item_componente) !== componenteId);
  renderizarTabelaDraft();
  showMessage(refs.mensagemSubmontagem, 'Componente removido da composicao.', 'success');
}

function abrirNovoComponenteDraft() {
  modoComponente = 'draft';
  resetFormComponente();
  document.getElementById('componente-modal-title').textContent = 'Adicionar Peca';
  document.getElementById('componente-modal-subtitle').textContent = 'Adicione um item simples na composicao da submontagem.';
  openModal(refs.componenteModal);
}

function abrirNovoComponenteLive() {
  if (!submontagemAtual) {
    showMessage(refs.mensagemEstrutura, 'Selecione uma submontagem antes de adicionar componentes.', 'error');
    return;
  }

  modoComponente = 'live';
  resetFormComponente();
  document.getElementById('componente-modal-title').textContent = 'Adicionar Componente';
  document.getElementById('componente-modal-subtitle').textContent = `${submontagemAtual.codigo} - ${submontagemAtual.descricao}`;
  openModal(refs.componenteModal);
}

function abrirEdicaoComponenteDraft(componente) {
  modoComponente = 'draft';
  preencherFormularioComponente(componente);
  document.getElementById('componente-modal-title').textContent = 'Editar Peca';
  document.getElementById('componente-modal-subtitle').textContent = 'Atualize os dados da composicao antes de salvar a submontagem.';
  openModal(refs.componenteModal);
}

function abrirEdicaoComponenteLive(componente) {
  modoComponente = 'live';
  preencherFormularioComponente(componente);
  document.getElementById('componente-modal-title').textContent = 'Editar Componente';
  document.getElementById('componente-modal-subtitle').textContent = `${submontagemAtual.codigo} - ${submontagemAtual.descricao}`;
  openModal(refs.componenteModal);
}

function preencherFormularioComponente(componente) {
  editandoComponenteId = Number(componente.id_item_componente);
  campos.componenteItemIdAtual.value = componente.id_item_componente;
  campos.componenteItemId.value = componente.id_item_componente;
  campos.componenteItemBusca.value = `${componente.codigo_componente} - ${componente.descricao_componente}`;
  campos.componenteQuantidade.value = Number(componente.quantidade);
  campos.componenteObservacao.value = componente.observacao || '';
  document.getElementById('btn-atualizar-componente').disabled = false;
  document.getElementById('btn-salvar-componente').disabled = true;
}

async function criarSubmontagem(event) {
  event.preventDefault();

  if (editandoSubmontagemId) {
    showMessage(refs.mensagemSubmontagem, 'Use Atualizar para salvar a submontagem em edicao.', 'error');
    return;
  }

  try {
    const response = await fetch(submontagensApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadSubmontagem())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalSubmontagem();
    showMessage(refs.mensagem, 'Submontagem cadastrada com sucesso.', 'success');
    await carregarSubmontagens();

    const criada = submontagensCache.find((item) => Number(item.id) === Number(result.id));
    if (criada) {
      await selecionarSubmontagem(criada, true);
    }
  } catch (error) {
    showMessage(refs.mensagemSubmontagem, error.message, 'error');
  }
}

async function atualizarSubmontagem() {
  if (!editandoSubmontagemId) {
    showMessage(refs.mensagemSubmontagem, 'Selecione uma submontagem antes de atualizar.', 'error');
    return;
  }

  try {
    const response = await fetch(`${submontagensApiUrl}/${editandoSubmontagemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadSubmontagem())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalSubmontagem();
    showMessage(refs.mensagem, 'Submontagem atualizada com sucesso.', 'success');
    await carregarSubmontagens();

    const atualizada = submontagensCache.find((item) => Number(item.id) === Number(result.id));
    if (atualizada) {
      await selecionarSubmontagem(atualizada, true);
    }
  } catch (error) {
    showMessage(refs.mensagemSubmontagem, error.message, 'error');
  }
}

function montarPayloadSubmontagem() {
  return {
    codigo: campos.subCodigo.value.trim(),
    descricao: campos.subDescricao.value.trim(),
    estoque_minimo: normalizeOptionalValue(campos.subEstoqueMinimo.value),
    estoque_seguranca: normalizeOptionalValue(campos.subEstoqueSeguranca.value),
    consumo_mensal: normalizeOptionalValue(campos.subConsumoMensal.value),
    componentes: componentesDraft.map((component) => ({
      id_item_componente: component.id_item_componente,
      quantidade: component.quantidade,
      observacao: component.observacao || null
    }))
  };
}

async function criarComponente(event) {
  event.preventDefault();

  if (editandoComponenteId) {
    showMessage(refs.mensagemComponente, 'Use Atualizar para salvar o componente em edicao.', 'error');
    return;
  }

  if (modoComponente === 'draft') {
    salvarComponenteDraft();
    return;
  }

  await salvarComponenteLive('POST');
}

async function atualizarComponente() {
  if (!editandoComponenteId) {
    showMessage(refs.mensagemComponente, 'Selecione um componente antes de atualizar.', 'error');
    return;
  }

  if (modoComponente === 'draft') {
    salvarComponenteDraft(true);
    return;
  }

  await salvarComponenteLive('PUT');
}

function salvarComponenteDraft(isUpdate = false) {
  const componente = montarPayloadComponente();
  if (!componente) {
    return;
  }

  const jaExiste = componentesDraft.find((item) => (
    Number(item.id_item_componente) === Number(componente.id_item_componente)
    && Number(item.id_item_componente) !== Number(editandoComponenteId)
  ));

  if (jaExiste) {
    showMessage(refs.mensagemComponente, 'Esta peca ja foi adicionada na composicao.', 'error');
    return;
  }

  if (isUpdate) {
    componentesDraft = componentesDraft.map((item) => (
      Number(item.id_item_componente) === Number(editandoComponenteId)
        ? componente
        : item
    ));
  } else {
    componentesDraft.push(componente);
  }

  renderizarTabelaDraft();
  fecharModalComponente();
  showMessage(
    refs.mensagemSubmontagem,
    isUpdate ? 'Peca atualizada na composicao.' : 'Peca adicionada na composicao.',
    'success'
  );
}

async function salvarComponenteLive(method) {
  if (!submontagemAtual) {
    showMessage(refs.mensagemComponente, 'Selecione uma submontagem antes de salvar a estrutura.', 'error');
    return;
  }

  const componente = montarPayloadComponente();
  if (!componente) {
    return;
  }

  const endpoint = method === 'PUT'
    ? `${submontagensApiUrl}/${submontagemAtual.id}/componentes/${editandoComponenteId}`
    : `${submontagensApiUrl}/${submontagemAtual.id}/componentes`;

  try {
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_item_componente: componente.id_item_componente,
        quantidade: componente.quantidade,
        observacao: componente.observacao
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalComponente();
    showMessage(
      refs.mensagemEstrutura,
      method === 'PUT' ? 'Componente atualizado com sucesso.' : 'Componente adicionado com sucesso.',
      'success'
    );
    await carregarSubmontagens();
  } catch (error) {
    showMessage(refs.mensagemComponente, error.message, 'error');
  }
}

function montarPayloadComponente() {
  const itemId = Number.parseInt(campos.componenteItemId.value, 10);
  const quantidade = Number.parseInt(campos.componenteQuantidade.value, 10);
  const item = itensCache.find((registro) => Number(registro.id) === itemId);

  if (!item) {
    showMessage(refs.mensagemComponente, 'Selecione uma peca valida para a composicao.', 'error');
    return null;
  }

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    showMessage(refs.mensagemComponente, 'A quantidade deve ser um numero inteiro maior que zero.', 'error');
    return null;
  }

  return {
    id_item_componente: item.id,
    codigo_componente: item.codigo,
    descricao_componente: item.descricao,
    tipo_componente: item.tipo,
    massa_kg: Number(item.massa_kg || 0),
    quantidade,
    observacao: campos.componenteObservacao.value.trim() || null
  };
}

function limparFiltros() {
  refs.filtroForm.reset();
  atualizarRotulosEstoqueReferencia();
  carregarSubmontagens();
}

function agendarCarregamentoSubmontagens() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarSubmontagens(), 220);
}

function resetFormSubmontagem() {
  refs.submontagemForm.reset();
  editandoSubmontagemId = null;
  componentesDraft = [];
  campos.subId.value = '';
  campos.subMassa.value = '0';
  document.getElementById('submontagem-unidade-massa').value = 'kg';
  document.getElementById('btn-atualizar-submontagem').disabled = true;
  document.getElementById('btn-salvar-submontagem').disabled = false;
  renderizarTabelaDraft();
  hideMessage(refs.mensagemSubmontagem);
}

function fecharModalSubmontagem() {
  resetFormSubmontagem();
  closeModal(refs.submontagemModal);
}

function fecharModalEstrutura() {
  closeModal(refs.estruturaModal);
}

function resetFormComponente() {
  refs.componenteForm.reset();
  editandoComponenteId = null;
  campos.componenteItemId.value = '';
  campos.componenteItemIdAtual.value = '';
  campos.componenteItemBusca.value = '';
  campos.componenteQuantidade.value = '1';
  document.getElementById('btn-atualizar-componente').disabled = true;
  document.getElementById('btn-salvar-componente').disabled = false;
  hideMessage(refs.mensagemComponente);
  esconderSugestoesItens();
}

function fecharModalComponente() {
  resetFormComponente();
  closeModal(refs.componenteModal);
}

function limparEstruturaAtual() {
  submontagemAtual = null;
  componentesEstruturaCache = [];
  closeModal(refs.estruturaModal);
  document.getElementById('estrutura-titulo').textContent = 'Selecione uma submontagem';
  document.getElementById('estrutura-subtitulo').textContent = 'Abra a estrutura a partir da listagem para consultar ou imprimir os componentes.';
  document.getElementById('estrutura-codigo').textContent = 'Nenhuma submontagem selecionada';
  document.getElementById('estrutura-detalhe').textContent = 'Escolha um registro para visualizar a composicao.';
  document.getElementById('estrutura-total-componentes').textContent = 'Componentes: 0';
  document.getElementById('estrutura-massa-total').textContent = 'Massa: 0,000 kg';
  renderizarEstruturaAtual();
  hideMessage(refs.mensagemEstrutura);
}

function imprimirEstruturaAtual() {
  if (!submontagemAtual) {
    showMessage(refs.mensagemEstrutura, 'Selecione uma submontagem para imprimir a estrutura.', 'error');
    return;
  }

  const tabelaLinhas = componentesEstruturaCache.length === 0
    ? '<tr><td colspan="6">Nenhum componente cadastrado.</td></tr>'
    : componentesEstruturaCache.map((component) => `
      <tr>
        <td>${escapeHtml(component.codigo_componente)}</td>
        <td>${escapeHtml(component.descricao_componente)}</td>
        <td>${formatInteger(component.quantidade)}</td>
        <td>${escapeHtml(component.tipo_componente || '-')}</td>
        <td>${formatDecimal(component.massa_kg || 0, 3)} kg</td>
        <td>${formatDecimal(Number(component.quantidade) * Number(component.massa_kg || 0), 3)} kg</td>
      </tr>
    `).join('');

  const printWindow = window.open('', '_blank', 'width=1100,height=800');

  if (!printWindow) {
    showMessage(refs.mensagemEstrutura, 'Nao foi possivel abrir a janela de impressao.', 'error');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Estrutura ${escapeHtml(submontagemAtual.codigo)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
        h1 { margin-bottom: 4px; font-size: 24px; }
        p { margin: 0 0 8px; }
        .chips { margin: 16px 0; }
        .chips span { display: inline-block; margin-right: 12px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 999px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
        th { background: #f3f4f6; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(submontagemAtual.codigo)} - ${escapeHtml(submontagemAtual.descricao)}</h1>
      <p>${escapeHtml(document.getElementById('estrutura-detalhe').textContent)}</p>
      <div class="chips">
        <span>${escapeHtml(document.getElementById('estrutura-total-componentes').textContent)}</span>
        <span>${escapeHtml(document.getElementById('estrutura-massa-total').textContent)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Codigo</th>
            <th>Descricao</th>
            <th>Quantidade</th>
            <th>Tipo</th>
            <th>Massa Unit.</th>
            <th>Massa Total</th>
          </tr>
        </thead>
        <tbody>${tabelaLinhas}</tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function renderizarSugestoesItens(termo) {
  const filtro = termo.toLowerCase();
  const itensFiltrados = itensCache.filter((item) => {
    if (!filtro) {
      return true;
    }

    return `${item.codigo} ${item.descricao} ${item.tipo}`.toLowerCase().includes(filtro);
  }).slice(0, 8);

  if (itensFiltrados.length === 0) {
    campos.componenteSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum item simples encontrado.</div>';
    campos.componenteSugestoes.classList.remove('hidden');
    return;
  }

  campos.componenteSugestoes.innerHTML = itensFiltrados.map((item) => `
    <button type="button" class="autocomplete-option" data-item-id="${item.id}">
      <strong>${escapeHtml(item.codigo)} - ${escapeHtml(item.descricao)}</strong>
      <span>${escapeHtml(`${item.tipo} | Massa: ${formatDecimal(item.massa_kg || 0, 3)} kg`)}</span>
    </button>
  `).join('');
  campos.componenteSugestoes.classList.remove('hidden');
}

function esconderSugestoesItens() {
  campos.componenteSugestoes.classList.add('hidden');
  campos.componenteSugestoes.innerHTML = '';
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') {
    return;
  }

  esconderSugestoesItens();
  closeAllRowMenus();

  if (!refs.componenteModal.classList.contains('hidden')) {
    fecharModalComponente();
    return;
  }

  if (!refs.estruturaModal.classList.contains('hidden')) {
    fecharModalEstrutura();
    return;
  }

  if (!refs.submontagemModal.classList.contains('hidden')) {
    fecharModalSubmontagem();
    return;
  }

  if (refs.drawer.classList.contains('is-open')) {
    toggleDrawer(false);
  }
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  syncBodyModalState();
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  syncBodyModalState();
}

function syncBodyModalState() {
  const estruturaModalAberto = refs.estruturaModal && !refs.estruturaModal.classList.contains('hidden');
  const modalAberto = !refs.submontagemModal.classList.contains('hidden')
    || !refs.componenteModal.classList.contains('hidden')
    || estruturaModalAberto;
  document.body.classList.toggle('has-modal', modalAberto);
}

function toggleDrawer(shouldOpen) {
  refs.drawer.classList.toggle('is-open', shouldOpen);
  refs.drawerScrim.classList.toggle('hidden', !shouldOpen);
  document.body.classList.toggle('has-drawer', shouldOpen);
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
  element.classList.remove('hidden');
}

function hideMessage(element) {
  element.className = 'message hidden';
  element.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function normalizeOptionalValue(value) {
  return value === '' ? null : value;
}

function formatOptionalNumber(value) {
  return value === null || value === undefined ? '' : Number(value);
}

function formatDecimal(value, decimalPlaces) {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });
}

function formatInteger(value) {
  return Number(value).toLocaleString('pt-BR', {
    maximumFractionDigits: 0
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
