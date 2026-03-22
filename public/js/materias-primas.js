const materiasPrimasApiBaseUrl = '/api/materias-primas';
const fornecedoresAutocompleteApiUrl = '/api/fornecedores-autocomplete';

const materiaisTecnicosPadrao = {
  'Aço carbono SAE 1020': { densidade: 7.85 },
  'Aço carbono SAE 1045': { densidade: 7.85 },
  'Aço inoxidavel AISI 316 / UNS S31600': { densidade: 8.0 },
  'Policloreto de vinila rigido (PVC rigido)': { densidade: 1.39 },
  'Polioximetileno (POM) / Poliacetal': { densidade: 1.41 },
  'Poliamida (PA), normalmente PA 6 ou PA 66': { densidade: 1.15 },
  'Ferro fundido cinzento ou ferro fundido nodular': { densidade: 7.2 },
  'Aluminio': { densidade: 2.7 }
};

const bitolasPolegadaPadrao = [
  '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '7/16"', '1/2"', '9/16"', '5/8"', '11/16"',
  '3/4"', '13/16"', '7/8"', '15/16"', '1"', '1 1/8"', '1 1/4"', '1 3/8"', '1 1/2"',
  '1 5/8"', '1 3/4"', '1 7/8"', '2"', '2 1/4"', '2 1/2"', '2 3/4"', '3"'
];

const materiaisTecnicosCadastro = [
  { nome: 'Aco carbono SAE 1020', densidade: 7.85 },
  { nome: 'Aco carbono SAE 1045', densidade: 7.85 },
  { nome: 'Aco inoxidavel AISI 316 / UNS S31600', densidade: 8.0 },
  { nome: 'Policloreto de vinila rigido (PVC rigido)', densidade: 1.39 },
  { nome: 'Polioximetileno (POM) / Poliacetal', densidade: 1.41 },
  { nome: 'Poliamida (PA), normalmente PA 6 ou PA 66', densidade: 1.15 },
  { nome: 'Ferro fundido cinzento ou ferro fundido nodular', densidade: 7.2 },
  { nome: 'Aluminio', densidade: 2.7 }
];

let editingMateriaPrimaId = null;
let selectedMateriaPrimaId = null;
let editingVinculoId = null;
let fornecedoresCache = [];
let materiasPrimasCache = [];
let vinculosCache = [];
let filtroDebounceTimer = null;
let syncingBitola = false;

const refs = {
  form: document.getElementById('materia-prima-form'),
  filtroForm: document.getElementById('materia-prima-filtro-form'),
  mensagem: document.getElementById('materia-prima-mensagem'),
  modalMensagem: document.getElementById('materia-prima-modal-mensagem'),
  modal: document.getElementById('materia-prima-modal'),
  modalTitle: document.getElementById('materia-prima-modal-title'),
  tabela: document.getElementById('materias-primas-tbody'),
  total: document.getElementById('total-materias-primas'),
  salvarButton: document.getElementById('btn-salvar-mp'),
  atualizarButton: document.getElementById('btn-atualizar-mp'),
  novaButton: document.getElementById('btn-nova-materia-prima'),
  limparFiltrosButton: document.getElementById('btn-limpar-filtros-mp'),
  cancelarModalButton: document.getElementById('btn-cancelar-modal-mp'),
  fecharModalButton: document.getElementById('btn-fechar-modal-mp'),
  codigoInput: document.getElementById('mp-codigo'),
  categoriaInput: document.getElementById('mp-categoria'),
  categoriaButtons: Array.from(document.querySelectorAll('.mode-switch-btn')),
  fornecedorPrincipalSelect: document.getElementById('mp-fornecedor-principal'),
  unidadeEstoqueSelect: document.getElementById('mp-unidade-estoque'),
  descricaoInput: document.getElementById('mp-nome'),
  materialInput: document.getElementById('mp-material'),
  estoqueMinimoInput: document.getElementById('mp-estoque-minimo'),
  estoqueMinimoLabel: document.getElementById('mp-estoque-minimo-label'),
  geometriaSelect: document.getElementById('mp-geometria'),
  bitolaPolegadaInput: document.getElementById('mp-bitola-polegada'),
  bitolaMmInput: document.getElementById('mp-bitola-mm'),
  comprimentoPadraoMInput: document.getElementById('mp-comprimento-padrao-m'),
  pesoPorMetroInput: document.getElementById('mp-peso-por-metro'),
  pesoUnitarioInput: document.getElementById('mp-peso-unitario-kg'),
  densidadeInput: document.getElementById('mp-densidade'),
  observacaoInput: document.getElementById('mp-observacao'),
  helperBitola: document.getElementById('mp-helper-bitola'),
  helperBarra: document.getElementById('mp-helper-barra'),
  laminadoSection: document.getElementById('mp-laminado-section'),
  fundidoSection: document.getElementById('mp-fundido-section'),
  bitolasDatalist: document.getElementById('mp-bitola-polegada-opcoes'),
  materiaisDatalist: document.getElementById('mp-material-opcoes'),
  drawer: document.getElementById('app-drawer'),
  drawerScrim: document.getElementById('drawer-scrim'),
  menuToggle: document.getElementById('menu-toggle'),
  drawerClose: document.getElementById('drawer-close'),
  fornecedoresModal: document.getElementById('mp-fornecedores-modal'),
  fornecedoresMensagem: document.getElementById('mp-fornecedores-mensagem'),
  fornecedoresTbody: document.getElementById('mp-fornecedores-tbody'),
  fornecedorForm: document.getElementById('mp-fornecedor-form'),
  fornecedorBuscaInput: document.getElementById('mp-fornecedor-busca'),
  fornecedorIdInput: document.getElementById('mp-fornecedor-id'),
  fornecedorVinculoIdInput: document.getElementById('mp-fornecedor-vinculo-id'),
  fornecedorObservacaoInput: document.getElementById('mp-fornecedor-observacao'),
  fornecedorSugestoes: document.getElementById('mp-fornecedor-sugestoes'),
  salvarFornecedorButton: document.getElementById('btn-salvar-mp-fornecedor'),
  atualizarFornecedorButton: document.getElementById('btn-atualizar-mp-fornecedor'),
  limparFornecedorButton: document.getElementById('btn-limpar-mp-fornecedor'),
  fecharFornecedoresButton: document.getElementById('btn-fechar-modal-mp-fornecedores'),
  fornecedoresModalTitle: document.getElementById('mp-fornecedores-modal-title'),
  fornecedoresTitulo: document.getElementById('mp-fornecedores-titulo'),
  fornecedoresSubtitulo: document.getElementById('mp-fornecedores-subtitulo'),
  filtroCategoria: document.getElementById('filtro-mp-categoria'),
  filtroFornecedor: document.getElementById('filtro-mp-fornecedor')
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    preencherOpcoesBitolaPolegada();
    preencherOpcoesMaterialTecnico();
    bindEvents();
    await carregarFornecedoresAutocomplete();
    await carregarMateriasPrimas();
    setCategoria('LAMINADO');
  } catch (error) {
    mostrarMensagemMateriaPrima(error.message || 'Nao foi possivel inicializar a tela de materias-primas.', 'error');
  }
});

function bindEvents() {
  refs.form.addEventListener('submit', handleCreateMateriaPrima);
  refs.atualizarButton.addEventListener('click', handleUpdateMateriaPrima);
  refs.novaButton.addEventListener('click', abrirNovaMateriaPrimaModal);
  refs.limparFiltrosButton.addEventListener('click', limparFiltrosMateriaPrima);
  refs.cancelarModalButton.addEventListener('click', fecharModalMateriaPrima);
  refs.fecharModalButton.addEventListener('click', fecharModalMateriaPrima);
  refs.modal.addEventListener('click', handleModalBackdrop);
  refs.fornecedoresModal.addEventListener('click', handleModalBackdrop);
  refs.menuToggle.addEventListener('click', abrirDrawer);
  refs.drawerClose.addEventListener('click', fecharDrawer);
  refs.drawerScrim.addEventListener('click', fecharDrawer);
  refs.categoriaButtons.forEach((button) => {
    button.addEventListener('click', () => setCategoria(button.dataset.categoria || 'LAMINADO'));
  });
  refs.materialInput.addEventListener('input', handleMaterialChange);
  refs.materialInput.addEventListener('change', handleMaterialChange);
  refs.codigoInput.addEventListener('input', sugerirFornecedorPrincipal);
  refs.fornecedorPrincipalSelect.addEventListener('change', () => {
    refs.fornecedorPrincipalSelect.dataset.lockedByUser = refs.fornecedorPrincipalSelect.value ? 'true' : 'false';
  });
  refs.unidadeEstoqueSelect.addEventListener('change', atualizarLabelEstoqueMinimo);
  refs.bitolaPolegadaInput.addEventListener('input', handleBitolaPolegadaInput);
  refs.bitolaMmInput.addEventListener('input', handleBitolaMmInput);
  refs.pesoPorMetroInput.addEventListener('input', renderizarAjudaLaminado);
  refs.comprimentoPadraoMInput.addEventListener('input', renderizarAjudaLaminado);
  refs.densidadeInput.addEventListener('input', renderizarAjudaLaminado);
  document.getElementById('btn-calcular-peso-metro').addEventListener('click', calcularPesoPorMetro);
  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
  refs.tabela.addEventListener('click', handleMateriaPrimaTableActions);
  refs.fornecedorForm.addEventListener('submit', handleCreateVinculoFornecedor);
  refs.atualizarFornecedorButton.addEventListener('click', handleUpdateVinculoFornecedor);
  refs.limparFornecedorButton.addEventListener('click', resetVinculoForm);
  refs.fornecedoresTbody.addEventListener('click', handleVinculoTableActions);
  refs.fornecedorBuscaInput.addEventListener('input', handleFornecedorBuscaInput);
  refs.fornecedorBuscaInput.addEventListener('focus', handleFornecedorBuscaFocus);
  refs.fornecedorSugestoes.addEventListener('click', handleFornecedorSugestaoClick);
  refs.fecharFornecedoresButton.addEventListener('click', fecharModalFornecedores);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function preencherOpcoesBitolaPolegada() {
  refs.bitolasDatalist.innerHTML = bitolasPolegadaPadrao
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join('');
}

function preencherOpcoesMaterialTecnico() {
  refs.materiaisDatalist.innerHTML = materiaisTecnicosCadastro
    .map((item) => `<option value="${escapeHtml(item.nome)}"></option>`)
    .join('');
}

async function carregarFornecedoresAutocomplete() {
  const response = await fetch(fornecedoresAutocompleteApiUrl);
  const fornecedores = await response.json();

  if (!response.ok) {
    throw new Error(fornecedores.message || 'Nao foi possivel carregar os fornecedores.');
  }

  fornecedoresCache = fornecedores;
  popularSelectsFornecedor();
}

function popularSelectsFornecedor() {
  const options = fornecedoresCache
    .map((fornecedor) => `<option value="${fornecedor.id}">${escapeHtml(fornecedor.nome)}</option>`)
    .join('');

  const principalAtual = refs.fornecedorPrincipalSelect.value;
  refs.fornecedorPrincipalSelect.innerHTML = `<option value="">Selecione</option>${options}`;
  if (principalAtual) refs.fornecedorPrincipalSelect.value = principalAtual;

  const filtroAtual = refs.filtroFornecedor.value;
  refs.filtroFornecedor.innerHTML = `<option value="">Todos</option>${options}`;
  if (filtroAtual) refs.filtroFornecedor.value = filtroAtual;
}

async function carregarMateriasPrimas() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-mp-codigo').value.trim();
  const nome = document.getElementById('filtro-mp-nome').value.trim();
  const material = document.getElementById('filtro-mp-material').value.trim();
  const categoria = refs.filtroCategoria.value;
  const fornecedor = refs.filtroFornecedor.value;

  if (codigo) params.append('codigo', codigo);
  if (nome) params.append('nome', nome);
  if (material) params.append('material', material);
  if (categoria) params.append('categoria', categoria);
  if (fornecedor) params.append('id_fornecedor_principal', fornecedor);

  try {
    const endpoint = params.toString() ? `${materiasPrimasApiBaseUrl}?${params.toString()}` : materiasPrimasApiBaseUrl;
    const response = await fetch(endpoint);
    const materiasPrimas = await response.json();

    if (!response.ok) {
      throw new Error(materiasPrimas.message || 'Nao foi possivel carregar as materias-primas.');
    }

    materiasPrimasCache = materiasPrimas;
    renderizarTabelaMateriasPrimas(materiasPrimas);
    atualizarIndicadores(materiasPrimas);
  } catch (error) {
    materiasPrimasCache = [];
    renderizarTabelaMateriasPrimas([]);
    atualizarIndicadores([]);
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

function agendarFiltroAutomatico() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(() => carregarMateriasPrimas(), 220);
}

function renderizarTabelaMateriasPrimas(materiasPrimas) {
  refs.total.textContent = `${materiasPrimas.length} registro(s) encontrado(s)`;

  if (materiasPrimas.length === 0) {
    refs.tabela.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma materia-prima encontrada para os filtros informados.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = materiasPrimas.map((materiaPrima) => `
    <tr>
      <td class="table-code">${escapeHtml(materiaPrima.codigo)}</td>
      <td class="table-description">${escapeHtml(materiaPrima.nome)}</td>
      <td>${escapeHtml(materiaPrima.categoria || '-')}</td>
      <td>${escapeHtml(materiaPrima.material || '-')}</td>
      <td>${escapeHtml(formatarBitolaMateriaPrima(materiaPrima))}</td>
      <td>${escapeHtml(formatarPesoReferencia(materiaPrima))}</td>
      <td>${escapeHtml(materiaPrima.fornecedor_principal_nome || '-')}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="edit" data-id="${materiaPrima.id}">Editar</button>
            <button type="button" class="row-menu-item" data-action="fornecedores" data-id="${materiaPrima.id}">Fornecedores</button>
            <button type="button" class="row-menu-item danger" data-action="delete" data-id="${materiaPrima.id}">Excluir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function atualizarIndicadores(materiasPrimas) {
  const fundidos = materiasPrimas.filter((item) => String(item.categoria || '').toUpperCase() === 'FUNDIDO').length;
  const laminados = materiasPrimas.filter((item) => String(item.categoria || '').toUpperCase() === 'LAMINADO').length;

  document.getElementById('metric-total-materias-primas').textContent = String(materiasPrimas.length);
  document.getElementById('metric-fundidos').textContent = String(fundidos);
  document.getElementById('metric-laminados').textContent = String(laminados);
}

function abrirNovaMateriaPrimaModal() {
  resetMateriaPrimaForm();
  refs.modalTitle.textContent = 'Nova Materia-prima';
  abrirModal(refs.modal);
}

async function handleCreateMateriaPrima(event) {
  event.preventDefault();

  if (editingMateriaPrimaId) {
    mostrarMensagemModalMateriaPrima('Use o botao Atualizar para salvar a materia-prima em edicao.', 'error');
    return;
  }

  try {
    const response = await fetch(materiasPrimasApiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadMateriaPrima())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalMateriaPrima();
    mostrarMensagemMateriaPrima('Materia-prima cadastrada com sucesso.', 'success');
    await carregarMateriasPrimas();
  } catch (error) {
    mostrarMensagemModalMateriaPrima(error.message, 'error');
  }
}

async function handleUpdateMateriaPrima() {
  if (!editingMateriaPrimaId) {
    mostrarMensagemModalMateriaPrima('Selecione uma materia-prima antes de atualizar.', 'error');
    return;
  }

  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${editingMateriaPrimaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadMateriaPrima())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    fecharModalMateriaPrima();
    mostrarMensagemMateriaPrima('Materia-prima atualizada com sucesso.', 'success');
    await carregarMateriasPrimas();
  } catch (error) {
    mostrarMensagemModalMateriaPrima(error.message, 'error');
  }
}

function montarPayloadMateriaPrima() {
  const categoria = refs.categoriaInput.value || 'LAMINADO';
  const isFundido = categoria === 'FUNDIDO';

  return {
    codigo: refs.codigoInput.value.trim(),
    nome: refs.descricaoInput.value.trim(),
    categoria,
    material: refs.materialInput.value.trim(),
    geometria: isFundido ? 'FUNDIDO' : refs.geometriaSelect.value,
    bitola: isFundido ? '' : refs.bitolaPolegadaInput.value.trim(),
    bitola_mm: isFundido ? '' : normalizeDecimalPayloadValue(refs.bitolaMmInput.value),
    comprimento_padrao_m: isFundido ? '' : normalizeDecimalPayloadValue(refs.comprimentoPadraoMInput.value),
    peso_por_metro: isFundido ? '' : normalizeDecimalPayloadValue(refs.pesoPorMetroInput.value),
    peso_unitario_kg: isFundido ? normalizeDecimalPayloadValue(refs.pesoUnitarioInput.value) : '',
    densidade_g_cm3: isFundido ? '' : normalizeDecimalPayloadValue(refs.densidadeInput.value),
    estoque_minimo: normalizeDecimalPayloadValue(refs.estoqueMinimoInput.value) || '0',
    unidade_estoque: refs.unidadeEstoqueSelect.value,
    id_fornecedor_principal: refs.fornecedorPrincipalSelect.value,
    observacao: refs.observacaoInput.value.trim()
  };
}

async function carregarMateriaPrimaParaEdicao(id) {
  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${id}`);
    const materiaPrima = await response.json();

    if (!response.ok) {
      throw new Error(materiaPrima.message || 'Nao foi possivel carregar a materia-prima.');
    }

    editingMateriaPrimaId = materiaPrima.id;
    document.getElementById('materia-prima-id').value = materiaPrima.id;
    refs.codigoInput.value = materiaPrima.codigo;
    refs.descricaoInput.value = materiaPrima.nome || '';
    refs.materialInput.value = materiaPrima.material || '';
    refs.estoqueMinimoInput.value = formatInputDecimal(materiaPrima.estoque_minimo, 3) || '0';
    refs.observacaoInput.value = materiaPrima.observacao || '';
    refs.fornecedorPrincipalSelect.value = materiaPrima.id_fornecedor_principal || '';
    refs.fornecedorPrincipalSelect.dataset.lockedByUser = 'true';

    const categoria = materiaPrima.categoria || (String(materiaPrima.geometria || '').toUpperCase() === 'FUNDIDO' ? 'FUNDIDO' : 'LAMINADO');
    setCategoria(categoria, { preserveSupplier: true });
    refs.unidadeEstoqueSelect.value = materiaPrima.unidade_estoque || (categoria === 'FUNDIDO' ? 'UN' : 'KG');

    if (categoria === 'FUNDIDO') {
      refs.pesoUnitarioInput.value = formatInputDecimal(materiaPrima.peso_unitario_kg, 4);
      refs.bitolaPolegadaInput.value = '';
      refs.bitolaMmInput.value = '';
      refs.comprimentoPadraoMInput.value = '3';
      refs.pesoPorMetroInput.value = '';
      refs.densidadeInput.value = '';
    } else {
      refs.geometriaSelect.value = materiaPrima.geometria || 'REDONDO';
      refs.bitolaPolegadaInput.value = materiaPrima.bitola && materiaPrima.bitola !== 'NA' ? materiaPrima.bitola : '';
      refs.bitolaMmInput.value = formatInputDecimal(materiaPrima.bitola_mm, 3);
      refs.comprimentoPadraoMInput.value = materiaPrima.comprimento_padrao_mm
        ? formatInputDecimal(Number(materiaPrima.comprimento_padrao_mm) / 1000, 3)
        : '3';
      refs.pesoPorMetroInput.value = formatInputDecimal(materiaPrima.peso_por_metro, 4);
      refs.densidadeInput.value = formatInputDecimal(materiaPrima.densidade_g_cm3, 4);
      refs.pesoUnitarioInput.value = '';
    }

    refs.atualizarButton.disabled = false;
    refs.salvarButton.disabled = true;
    refs.modalTitle.textContent = `Editar ${materiaPrima.codigo}`;
    renderizarAjudaLaminado();
    abrirModal(refs.modal);
  } catch (error) {
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

async function excluirMateriaPrima(id) {
  if (!window.confirm('Deseja realmente excluir esta materia-prima?')) {
    return;
  }

  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel excluir a materia-prima.');
    }

    if (editingMateriaPrimaId === id) fecharModalMateriaPrima();
    if (selectedMateriaPrimaId === id) fecharModalFornecedores();

    mostrarMensagemMateriaPrima('Materia-prima excluida com sucesso.', 'success');
    await carregarMateriasPrimas();
  } catch (error) {
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

async function handleMateriaPrimaTableActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const materiaPrimaId = Number.parseInt(actionButton.dataset.id, 10);

  if (action === 'edit') await carregarMateriaPrimaParaEdicao(materiaPrimaId);
  if (action === 'fornecedores') await abrirModalFornecedores(materiaPrimaId);
  if (action === 'delete') await excluirMateriaPrima(materiaPrimaId);
}

function setCategoria(categoria, options = {}) {
  const categoriaFinal = categoria === 'FUNDIDO' ? 'FUNDIDO' : 'LAMINADO';
  const preserveSupplier = Boolean(options.preserveSupplier);
  const isFundido = categoriaFinal === 'FUNDIDO';

  refs.categoriaInput.value = categoriaFinal;
  refs.categoriaButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.categoria === categoriaFinal);
  });

  refs.laminadoSection.classList.toggle('hidden', isFundido);
  refs.fundidoSection.classList.toggle('hidden', !isFundido);
  refs.geometriaSelect.disabled = isFundido;
  refs.geometriaSelect.required = !isFundido;

  if (isFundido) {
    refs.geometriaSelect.value = 'FUNDIDO';
    refs.materialInput.value = refs.materialInput.value || 'Ferro fundido cinzento ou ferro fundido nodular';
    refs.pesoPorMetroInput.value = '';
    refs.densidadeInput.value = '';
    refs.bitolaPolegadaInput.value = '';
    refs.bitolaMmInput.value = '';
    refs.comprimentoPadraoMInput.value = '3';
  } else {
    refs.pesoUnitarioInput.value = '';
    if (!refs.geometriaSelect.value || refs.geometriaSelect.value === 'FUNDIDO') {
      refs.geometriaSelect.value = 'REDONDO';
    }
    if (!refs.comprimentoPadraoMInput.value) refs.comprimentoPadraoMInput.value = '3';
  }

  atualizarOpcoesUnidadeEstoque(categoriaFinal);
  atualizarLabelEstoqueMinimo();
  if (!preserveSupplier) {
    refs.fornecedorPrincipalSelect.dataset.lockedByUser = 'false';
    sugerirFornecedorPrincipal();
  }
  preencherDensidadePorMaterial();
  renderizarAjudaLaminado();
}

function atualizarOpcoesUnidadeEstoque(categoria) {
  const opcoes = categoria === 'FUNDIDO' ? ['UN', 'KG'] : ['KG', 'BARRAS', 'M'];
  const atual = refs.unidadeEstoqueSelect.value;
  refs.unidadeEstoqueSelect.innerHTML = opcoes.map((opcao) => `<option value="${opcao}">${opcao}</option>`).join('');
  refs.unidadeEstoqueSelect.value = opcoes.includes(atual) ? atual : opcoes[0];
}

function atualizarLabelEstoqueMinimo() {
  refs.estoqueMinimoLabel.textContent = `Estoque minimo (${refs.unidadeEstoqueSelect.value || 'KG'})`;
}

function handleMaterialChange() {
  preencherDensidadePorMaterial();
  sugerirFornecedorPrincipal();
}

function sugerirFornecedorPrincipal() {
  if (refs.fornecedorPrincipalSelect.dataset.lockedByUser === 'true' && refs.fornecedorPrincipalSelect.value) {
    return;
  }

  const suggestedId = determinarFornecedorPrincipalSugerido();
  refs.fornecedorPrincipalSelect.value = suggestedId ? String(suggestedId) : '';
}

function determinarFornecedorPrincipalSugerido() {
  const categoria = refs.categoriaInput.value || 'LAMINADO';
  const material = normalizeText(refs.materialInput.value);
  const codigo = normalizeText(refs.codigoInput.value);

  if (categoria === 'FUNDIDO' || codigo.endsWith('FD') || material.includes('FERRO FUNDIDO')) {
    return encontrarFornecedorPorTermos(['Fundicao Tiger']);
  }

  if (material.includes('ACO') || material.includes('SAE') || material.includes('INOX')) {
    return encontrarFornecedorPorTermos(['Acovisa', 'Açovisa']);
  }

  return null;
}

function encontrarFornecedorPorTermos(termos) {
  const fornecedor = fornecedoresCache.find((item) => {
    const nome = normalizeText(item.nome);
    return termos.some((termo) => nome.includes(normalizeText(termo)));
  });

  return fornecedor ? fornecedor.id : null;
}

function preencherDensidadePorMaterial() {
  if (refs.categoriaInput.value === 'FUNDIDO' || refs.densidadeInput.value) {
    return;
  }

  const padrao = findMaterialTecnicoPadrao(refs.materialInput.value);
  if (padrao?.densidade) {
    refs.densidadeInput.value = formatInputDecimal(padrao.densidade, 4);
  }
}

function findMaterialTecnicoPadrao(material) {
  const normalizedMaterial = normalizeText(material);
  const cadastro = materiaisTecnicosCadastro.find((item) => normalizeText(item.nome) === normalizedMaterial);
  if (cadastro) {
    return { densidade: cadastro.densidade };
  }

  const entry = Object.entries(materiaisTecnicosPadrao).find(([key]) => normalizeText(key) === normalizedMaterial);
  return entry ? entry[1] : null;
}

function handleBitolaPolegadaInput() {
  if (refs.categoriaInput.value === 'FUNDIDO' || syncingBitola) {
    return;
  }

  syncingBitola = true;
  const mm = converterPolegadaParaMm(refs.bitolaPolegadaInput.value);
  refs.bitolaMmInput.value = mm !== null ? formatInputDecimal(mm, 3) : '';
  syncingBitola = false;
  renderizarAjudaLaminado();
}

function handleBitolaMmInput() {
  if (refs.categoriaInput.value === 'FUNDIDO' || syncingBitola) {
    return;
  }

  syncingBitola = true;
  const mm = parseDecimalInput(refs.bitolaMmInput.value);
  refs.bitolaPolegadaInput.value = Number.isFinite(mm) && mm > 0 ? converterMmParaPolegada(mm) : '';
  syncingBitola = false;
  renderizarAjudaLaminado();
}

function calcularPesoPorMetro() {
  try {
    if (refs.categoriaInput.value === 'FUNDIDO') {
      throw new Error('O calculo de kg/m vale apenas para laminados.');
    }

    const geometria = refs.geometriaSelect.value;
    const bitolaMm = parseDecimalInput(refs.bitolaMmInput.value);
    const densidade = parseDecimalInput(refs.densidadeInput.value) || findMaterialTecnicoPadrao(refs.materialInput.value)?.densidade;

    if (!Number.isFinite(bitolaMm) || bitolaMm <= 0) {
      throw new Error('Informe a bitola em mm para calcular o kg/m.');
    }

    if (!Number.isFinite(densidade) || densidade <= 0) {
      throw new Error('Informe a densidade do material para calcular o kg/m.');
    }

    const areaSecaoMm2 = calcularAreaSecaoMm2(geometria, bitolaMm);
    if (!Number.isFinite(areaSecaoMm2) || areaSecaoMm2 <= 0) {
      throw new Error('Nao foi possivel calcular a area da secao com a geometria atual.');
    }

    refs.pesoPorMetroInput.value = formatInputDecimal((areaSecaoMm2 * densidade) / 1000, 4);
    refs.densidadeInput.value = formatInputDecimal(densidade, 4);
    renderizarAjudaLaminado();
    mostrarMensagemModalMateriaPrima('Peso por metro calculado automaticamente.', 'success');
  } catch (error) {
    mostrarMensagemModalMateriaPrima(error.message, 'error');
  }
}

function calcularAreaSecaoMm2(geometria, bitolaMm) {
  switch (String(geometria || '').toUpperCase()) {
    case 'REDONDO':
      return (Math.PI * (bitolaMm ** 2)) / 4;
    case 'QUADRADO':
      return bitolaMm ** 2;
    case 'SEXTAVADO':
      return 0.866025403784 * (bitolaMm ** 2);
    default:
      return null;
  }
}

function renderizarAjudaLaminado() {
  if (refs.categoriaInput.value === 'FUNDIDO') {
    refs.helperBitola.textContent = 'Bitola nao se aplica a fundidos.';
    refs.helperBarra.textContent = 'Peso de barra nao se aplica a fundidos.';
    return;
  }

  const bitolaPolegada = refs.bitolaPolegadaInput.value.trim();
  const bitolaMm = parseDecimalInput(refs.bitolaMmInput.value);
  const pesoPorMetro = parseDecimalInput(refs.pesoPorMetroInput.value);
  const comprimentoPadraoM = parseDecimalInput(refs.comprimentoPadraoMInput.value);

  if (bitolaPolegada || Number.isFinite(bitolaMm)) {
    const polegadaLabel = bitolaPolegada || converterMmParaPolegada(bitolaMm);
    const mmLabel = Number.isFinite(bitolaMm) ? `${formatarNumero(bitolaMm, 3)} mm` : '-';
    refs.helperBitola.textContent = `${polegadaLabel || '-'} = ${mmLabel}`;
  } else {
    refs.helperBitola.textContent = 'Preencha polegada ou mm.';
  }

  if (Number.isFinite(pesoPorMetro) && pesoPorMetro > 0 && Number.isFinite(comprimentoPadraoM) && comprimentoPadraoM > 0) {
    refs.helperBarra.textContent = `1 barra de ${formatarNumero(comprimentoPadraoM, 3)} m = ${formatarNumero(pesoPorMetro * comprimentoPadraoM, 4)} kg`;
  } else {
    refs.helperBarra.textContent = 'Aguardando kg/m e comprimento.';
  }
}

function resetMateriaPrimaForm() {
  refs.form.reset();
  editingMateriaPrimaId = null;
  document.getElementById('materia-prima-id').value = '';
  refs.atualizarButton.disabled = true;
  refs.salvarButton.disabled = false;
  refs.fornecedorPrincipalSelect.dataset.lockedByUser = 'false';
  refs.estoqueMinimoInput.value = '0';
  refs.descricaoInput.value = '';
  refs.comprimentoPadraoMInput.value = '3';
  refs.helperBitola.textContent = 'Preencha polegada ou mm.';
  refs.helperBarra.textContent = 'Aguardando kg/m e comprimento.';
  setCategoria('LAMINADO');
  esconderMensagemModalMateriaPrima();
}

function limparFiltrosMateriaPrima() {
  refs.filtroForm.reset();
  carregarMateriasPrimas();
}

function abrirModal(modalElement) {
  modalElement.classList.remove('hidden');
  modalElement.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModalMateriaPrima() {
  resetMateriaPrimaForm();
  refs.modal.classList.add('hidden');
  refs.modal.setAttribute('aria-hidden', 'true');
  atualizarEstadoBodyModal();
}

function abrirDrawer() {
  refs.drawer.classList.add('is-open');
  refs.drawerScrim.classList.remove('hidden');
  document.body.classList.add('has-drawer');
}

function fecharDrawer() {
  refs.drawer.classList.remove('is-open');
  refs.drawerScrim.classList.add('hidden');
  document.body.classList.remove('has-drawer');
}

async function abrirModalFornecedores(id, mensagemInicial = '') {
  const response = await fetch(`${materiasPrimasApiBaseUrl}/${id}`);
  const materiaPrima = await response.json();

  if (!response.ok) {
    mostrarMensagemMateriaPrima(materiaPrima.message || 'Nao foi possivel carregar a materia-prima.', 'error');
    return;
  }

  selectedMateriaPrimaId = materiaPrima.id;
  refs.fornecedoresModalTitle.textContent = `Fornecedores de ${materiaPrima.codigo}`;
  refs.fornecedoresTitulo.textContent = `${materiaPrima.codigo} - ${materiaPrima.nome}`;
  refs.fornecedoresSubtitulo.textContent = [
    materiaPrima.categoria || '-',
    materiaPrima.material || 'Material nao informado',
    formatarBitolaMateriaPrima(materiaPrima)
  ].filter(Boolean).join(' | ');
  resetVinculoForm();
  esconderMensagemMpFornecedores();
  await carregarVinculosFornecedor(id);
  abrirModal(refs.fornecedoresModal);
  if (mensagemInicial) mostrarMensagemMpFornecedores(mensagemInicial, 'success');
}

async function carregarVinculosFornecedor(materiaPrimaId) {
  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${materiaPrimaId}/fornecedores`);
    const vinculos = await response.json();
    if (!response.ok) throw new Error(vinculos.message || 'Nao foi possivel carregar os fornecedores vinculados.');
    vinculosCache = vinculos;
    renderizarTabelaVinculos(vinculos);
  } catch (error) {
    vinculosCache = [];
    renderizarTabelaVinculos([]);
    mostrarMensagemMpFornecedores(error.message, 'error');
  }
}

function renderizarTabelaVinculos(vinculos) {
  if (vinculos.length === 0) {
    refs.fornecedoresTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum fornecedor vinculado a esta materia-prima.</td></tr>';
    return;
  }

  refs.fornecedoresTbody.innerHTML = vinculos.map((vinculo) => `
    <tr>
      <td class="table-description">${escapeHtml(vinculo.fornecedor_nome)}</td>
      <td>${escapeHtml(vinculo.fornecedor_contato || '-')}</td>
      <td>${escapeHtml(vinculo.fornecedor_telefone || '-')}</td>
      <td>${escapeHtml(vinculo.observacao || '-')}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-vinculo-action="edit" data-vinculo-id="${vinculo.id}">Editar</button>
            <button type="button" class="row-menu-item danger" data-vinculo-action="delete" data-vinculo-id="${vinculo.id}">Excluir</button>
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

async function handleCreateVinculoFornecedor(event) {
  event.preventDefault();
  if (!selectedMateriaPrimaId) return mostrarMensagemMpFornecedores('Abra uma materia-prima antes de vincular fornecedores.', 'error');
  if (editingVinculoId) return mostrarMensagemMpFornecedores('Use o botao Atualizar para salvar o vinculo em edicao.', 'error');

  const payload = montarPayloadVinculo();
  if (!payload) return;

  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${selectedMateriaPrimaId}/fornecedores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(extractErrorMessage(result));
    resetVinculoForm();
    mostrarMensagemMpFornecedores('Fornecedor vinculado com sucesso.', 'success');
    await carregarVinculosFornecedor(selectedMateriaPrimaId);
  } catch (error) {
    mostrarMensagemMpFornecedores(error.message, 'error');
  }
}

async function handleUpdateVinculoFornecedor() {
  if (!selectedMateriaPrimaId || !editingVinculoId) return mostrarMensagemMpFornecedores('Selecione um vinculo antes de atualizar.', 'error');
  const payload = montarPayloadVinculo();
  if (!payload) return;

  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${selectedMateriaPrimaId}/fornecedores/${editingVinculoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(extractErrorMessage(result));
    resetVinculoForm();
    mostrarMensagemMpFornecedores('Vinculo atualizado com sucesso.', 'success');
    await carregarVinculosFornecedor(selectedMateriaPrimaId);
  } catch (error) {
    mostrarMensagemMpFornecedores(error.message, 'error');
  }
}

function montarPayloadVinculo() {
  const fornecedorId = Number.parseInt(refs.fornecedorIdInput.value, 10);
  if (!Number.isInteger(fornecedorId)) {
    mostrarMensagemMpFornecedores('Escolha um fornecedor valido na busca antes de salvar.', 'error');
    return null;
  }

  return { id_fornecedor: fornecedorId, observacao: refs.fornecedorObservacaoInput.value.trim() };
}

async function handleVinculoTableActions(event) {
  const actionButton = event.target.closest('button[data-vinculo-action]');
  if (!actionButton) return;
  const vinculoId = Number.parseInt(actionButton.dataset.vinculoId, 10);
  if (actionButton.dataset.vinculoAction === 'edit') carregarVinculoParaEdicao(vinculoId);
  if (actionButton.dataset.vinculoAction === 'delete') await excluirVinculoFornecedor(vinculoId);
}

function carregarVinculoParaEdicao(vinculoId) {
  const vinculo = vinculosCache.find((item) => Number(item.id) === Number(vinculoId));
  if (!vinculo) return mostrarMensagemMpFornecedores('Vinculo nao encontrado.', 'error');

  editingVinculoId = vinculo.id;
  refs.fornecedorVinculoIdInput.value = vinculo.id;
  refs.fornecedorIdInput.value = vinculo.id_fornecedor;
  refs.fornecedorBuscaInput.value = vinculo.fornecedor_nome;
  refs.fornecedorObservacaoInput.value = vinculo.observacao || '';
  refs.atualizarFornecedorButton.disabled = false;
  refs.salvarFornecedorButton.disabled = true;
  esconderSugestoesFornecedor();
}

async function excluirVinculoFornecedor(vinculoId) {
  if (!window.confirm('Deseja realmente excluir este vinculo?')) return;

  try {
    const response = await fetch(`${materiasPrimasApiBaseUrl}/${selectedMateriaPrimaId}/fornecedores/${vinculoId}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Nao foi possivel excluir o vinculo.');
    if (editingVinculoId === vinculoId) resetVinculoForm();
    mostrarMensagemMpFornecedores('Vinculo excluido com sucesso.', 'success');
    await carregarVinculosFornecedor(selectedMateriaPrimaId);
  } catch (error) {
    mostrarMensagemMpFornecedores(error.message, 'error');
  }
}

function handleFornecedorBuscaInput() {
  refs.fornecedorIdInput.value = '';
  renderizarSugestoesFornecedor(refs.fornecedorBuscaInput.value.trim());
}

function handleFornecedorBuscaFocus() {
  renderizarSugestoesFornecedor(refs.fornecedorBuscaInput.value.trim());
}

function handleFornecedorSugestaoClick(event) {
  const option = event.target.closest('button[data-fornecedor-id]');
  if (!option) return;
  refs.fornecedorIdInput.value = option.dataset.fornecedorId;
  refs.fornecedorBuscaInput.value = option.dataset.fornecedorNome;
  esconderSugestoesFornecedor();
}

function renderizarSugestoesFornecedor(term) {
  const filtro = term.toLowerCase();
  const fornecedoresFiltrados = fornecedoresCache.filter((fornecedor) => {
    if (!filtro) return true;
    return (
      String(fornecedor.nome).toLowerCase().includes(filtro)
      || String(fornecedor.contato || '').toLowerCase().includes(filtro)
      || String(fornecedor.telefone || '').toLowerCase().includes(filtro)
      || String(fornecedor.cidade || '').toLowerCase().includes(filtro)
    );
  }).slice(0, 8);

  if (fornecedoresFiltrados.length === 0) {
    refs.fornecedorSugestoes.innerHTML = '<div class="autocomplete-empty">Nenhum fornecedor encontrado.</div>';
    refs.fornecedorSugestoes.classList.remove('hidden');
    return;
  }

  refs.fornecedorSugestoes.innerHTML = fornecedoresFiltrados.map((fornecedor) => `
    <button type="button" class="autocomplete-option" data-fornecedor-id="${fornecedor.id}" data-fornecedor-nome="${escapeHtml(fornecedor.nome)}">
      <strong>${escapeHtml(fornecedor.nome)}</strong>
      <span>${escapeHtml(fornecedor.cidade || '-')}</span>
    </button>
  `).join('');
  refs.fornecedorSugestoes.classList.remove('hidden');
}

function esconderSugestoesFornecedor() {
  refs.fornecedorSugestoes.classList.add('hidden');
  refs.fornecedorSugestoes.innerHTML = '';
}

function resetVinculoForm() {
  refs.fornecedorForm.reset();
  editingVinculoId = null;
  refs.fornecedorVinculoIdInput.value = '';
  refs.fornecedorIdInput.value = '';
  refs.atualizarFornecedorButton.disabled = true;
  refs.salvarFornecedorButton.disabled = false;
  esconderSugestoesFornecedor();
}

function fecharModalFornecedores() {
  selectedMateriaPrimaId = null;
  vinculosCache = [];
  resetVinculoForm();
  esconderMensagemMpFornecedores();
  refs.fornecedoresTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Abra uma materia-prima para visualizar os fornecedores vinculados.</td></tr>';
  refs.fornecedoresModal.classList.add('hidden');
  refs.fornecedoresModal.setAttribute('aria-hidden', 'true');
  atualizarEstadoBodyModal();
}

function atualizarEstadoBodyModal() {
  const algumModalAberto = !refs.modal.classList.contains('hidden') || !refs.fornecedoresModal.classList.contains('hidden');
  document.body.classList.toggle('has-modal', algumModalAberto);
}

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'materia-prima') fecharModalMateriaPrima();
  if (event.target.dataset.closeModal === 'mp-fornecedores') fecharModalFornecedores();
}

function handleGlobalClick(event) {
  const trigger = event.target.closest('.row-menu-trigger');
  if (trigger) {
    const currentMenu = trigger.closest('.row-menu');
    window.requestAnimationFrame(() => {
      const shouldKeepOpen = currentMenu && currentMenu.hasAttribute('open');
      closeAllRowMenus(shouldKeepOpen ? currentMenu : null);
    });
    return;
  }

  if (event.target.closest('.row-menu-item')) closeAllRowMenus();
  if (!event.target.closest('.autocomplete')) esconderSugestoesFornecedor();
  if (!event.target.closest('.row-menu')) closeAllRowMenus();
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') return;
  esconderSugestoesFornecedor();
  closeAllRowMenus();
  if (!refs.fornecedoresModal.classList.contains('hidden')) return fecharModalFornecedores();
  if (!refs.modal.classList.contains('hidden')) return fecharModalMateriaPrima();
  if (refs.drawer.classList.contains('is-open')) fecharDrawer();
}

function closeAllRowMenus(exceptMenu = null) {
  document.querySelectorAll('.row-menu[open]').forEach((menu) => {
    if (!exceptMenu || menu !== exceptMenu) menu.removeAttribute('open');
  });
}

function mostrarMensagemMateriaPrima(texto, tipo) {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
  refs.mensagem.classList.remove('hidden');
}

function mostrarMensagemModalMateriaPrima(texto, tipo) {
  refs.modalMensagem.textContent = texto;
  refs.modalMensagem.className = `message ${tipo}`;
  refs.modalMensagem.classList.remove('hidden');
}

function esconderMensagemModalMateriaPrima() {
  refs.modalMensagem.className = 'message hidden';
  refs.modalMensagem.textContent = '';
}

function mostrarMensagemMpFornecedores(texto, tipo) {
  refs.fornecedoresMensagem.textContent = texto;
  refs.fornecedoresMensagem.className = `message ${tipo}`;
  refs.fornecedoresMensagem.classList.remove('hidden');
}

function esconderMensagemMpFornecedores() {
  refs.fornecedoresMensagem.className = 'message hidden';
  refs.fornecedoresMensagem.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function normalizeOptionalValue(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value;
}

function formatarBitolaMateriaPrima(materiaPrima) {
  if (String(materiaPrima.categoria || '').toUpperCase() === 'FUNDIDO') {
    return '-';
  }

  const bitolaOriginal = String(materiaPrima.bitola || '').trim();
  const bitolaMm = materiaPrima.bitola_mm !== null && materiaPrima.bitola_mm !== undefined
    ? `${formatarNumero(materiaPrima.bitola_mm, 3)} mm`
    : '';

  if (bitolaOriginal && bitolaMm) return `${bitolaOriginal} | ${bitolaMm}`;
  return bitolaOriginal || bitolaMm || '-';
}

function formatarPesoReferencia(materiaPrima) {
  if (String(materiaPrima.categoria || '').toUpperCase() === 'FUNDIDO') {
    return materiaPrima.peso_unitario_kg !== null && materiaPrima.peso_unitario_kg !== undefined
      ? `${formatarNumero(materiaPrima.peso_unitario_kg, 4)} kg/un`
      : '-';
  }

  if (materiaPrima.peso_por_metro !== null && materiaPrima.peso_por_metro !== undefined) {
    const comprimentoM = materiaPrima.comprimento_padrao_mm ? Number(materiaPrima.comprimento_padrao_mm) / 1000 : null;
    const pesoBarra = comprimentoM ? Number(materiaPrima.peso_por_metro) * comprimentoM : null;
    return pesoBarra
      ? `${formatarNumero(materiaPrima.peso_por_metro, 4)} kg/m | barra ${formatarNumero(pesoBarra, 4)} kg`
      : `${formatarNumero(materiaPrima.peso_por_metro, 4)} kg/m`;
  }

  return '-';
}

function formatOptionalNumber(value) {
  return value === null || value === undefined ? '' : Number(value);
}

function parseDecimalInput(value) {
  const texto = String(value || '').trim();
  if (!texto) return null;

  const compacto = texto.replace(/\s+/g, '');
  const ultimaVirgula = compacto.lastIndexOf(',');
  const ultimoPonto = compacto.lastIndexOf('.');

  let normalizado = compacto;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    if (ultimaVirgula > ultimoPonto) {
      normalizado = compacto.replaceAll('.', '').replace(',', '.');
    } else {
      normalizado = compacto.replaceAll(',', '');
    }
  } else if (ultimaVirgula >= 0) {
    normalizado = compacto.replace(',', '.');
  }

  const numero = Number.parseFloat(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function normalizeDecimalPayloadValue(value) {
  const numero = parseDecimalInput(value);
  return numero === null ? '' : String(numero);
}

function formatInputDecimal(value, casasDecimais) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return Number(value).toLocaleString('pt-BR', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: casasDecimais
  });
}

function formatarNumero(valor, casasDecimais) {
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais
  });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function converterPolegadaParaMm(texto) {
  const inches = parseInchValue(texto);
  return inches !== null ? inches * 25.4 : null;
}

function parseInchValue(value) {
  const texto = String(value || '').trim().replace(',', '.').replaceAll('"', '');
  if (!texto) return null;

  if (texto.includes(' ')) {
    const [inteiroTexto, fracaoTexto] = texto.split(/\s+/, 2);
    const inteiro = Number.parseFloat(inteiroTexto);
    const fracao = parseFracao(fracaoTexto);
    if (Number.isFinite(inteiro) && fracao !== null) return inteiro + fracao;
  }

  const fracao = parseFracao(texto);
  if (fracao !== null) return fracao;

  const numero = Number.parseFloat(texto);
  return Number.isFinite(numero) ? numero : null;
}

function parseFracao(value) {
  if (!value || !String(value).includes('/')) return null;

  const [numeradorTexto, denominadorTexto] = String(value).split('/');
  const numerador = Number.parseFloat(numeradorTexto);
  const denominador = Number.parseFloat(denominadorTexto);

  if (!Number.isFinite(numerador) || !Number.isFinite(denominador) || denominador === 0) return null;
  return numerador / denominador;
}

function converterMmParaPolegada(mm) {
  if (!Number.isFinite(mm) || mm <= 0) return '';

  const polegadas = mm / 25.4;
  const base = 64;
  let inteiro = Math.floor(polegadas);
  let numerador = Math.round((polegadas - inteiro) * base);

  if (numerador === base) {
    inteiro += 1;
    numerador = 0;
  }

  if (numerador === 0) return `${inteiro}"`;

  const divisor = gcd(numerador, base);
  const n = numerador / divisor;
  const d = base / divisor;
  return inteiro === 0 ? `${n}/${d}"` : `${inteiro} ${n}/${d}"`;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
