const materiasPrimasApiBaseUrl = '/api/materias-primas';
const fornecedoresAutocompleteApiUrl = '/api/fornecedores-autocomplete';

const descricoesTecnicasLaminado = [
  'Aco carbono SAE 1020',
  'Aco carbono SAE 1045',
  'Aco inoxidavel AISI 316 / UNS S31600',
  'Policloreto de vinila rigido (PVC rigido)',
  'Polioximetileno (POM) / Poliacetal',
  'Poliamida (PA), normalmente PA 6 ou PA 66',
  'Aluminio'
];

const ligasLaminado = [
  'ACO',
  'ACO INOXIDAVEL',
  'INOX',
  'LATAO',
  'BRONZE',
  'ALUMINIO',
  'FERRO',
  'FERRO FUNDIDO'
];

const ligasFundido = [
  'GG20',
  'NODULAR',
  'FERRO FUNDIDO'
];

let editingMateriaPrimaId = null;
let filtroDebounceTimer = null;
let fornecedoresCache = [];
let materiasPrimasCache = [];
let selectedFornecedorIds = [];

const refs = {
  form: document.getElementById('materia-prima-form'),
  filtroForm: document.getElementById('materia-prima-filtro-form'),
  mensagem: document.getElementById('materia-prima-mensagem'),
  modalMensagem: document.getElementById('materia-prima-modal-mensagem'),
  modal: document.getElementById('materia-prima-modal'),
  modalTitle: document.getElementById('materia-prima-modal-title'),
  visualizarModal: document.getElementById('materia-prima-visualizar-modal'),
  visualizarTitle: document.getElementById('materia-prima-visualizar-title'),
  visualizarCorpo: document.getElementById('materia-prima-visualizar-corpo'),
  tabela: document.getElementById('materias-primas-tbody'),
  total: document.getElementById('total-materias-primas'),
  salvarButton: document.getElementById('btn-salvar-mp'),
  atualizarButton: document.getElementById('btn-atualizar-mp'),
  novaButton: document.getElementById('btn-nova-materia-prima'),
  limparFiltrosButton: document.getElementById('btn-limpar-filtros-mp'),
  cancelarModalButton: document.getElementById('btn-cancelar-modal-mp'),
  fecharModalButton: document.getElementById('btn-fechar-modal-mp'),
  categoriaInput: document.getElementById('mp-categoria'),
  categoriaButtons: Array.from(document.querySelectorAll('.mode-switch-btn')),
  codigoInput: document.getElementById('mp-codigo'),
  nomeInput: document.getElementById('mp-nome'),
  ligaInput: document.getElementById('mp-liga'),
  ligaDatalist: document.getElementById('mp-liga-opcoes'),
  fornecedorSelect: document.getElementById('mp-fornecedor-select'),
  adicionarFornecedorButton: document.getElementById('btn-adicionar-fornecedor-mp'),
  fornecedoresLista: document.getElementById('mp-fornecedores-lista'),
  materialInput: document.getElementById('mp-material'),
  materialDatalist: document.getElementById('mp-descricao-tecnica-opcoes'),
  geometriaSelect: document.getElementById('mp-geometria'),
  bitolaPolegadaInput: document.getElementById('mp-bitola-polegada'),
  bitolaMmCheckbox: document.getElementById('mp-bitola-em-mm'),
  bitolaMmWrapper: document.getElementById('mp-bitola-mm-wrapper'),
  bitolaMmInput: document.getElementById('mp-bitola-mm'),
  bitolaDatalist: document.getElementById('mp-bitola-polegada-opcoes'),
  helperBitola: document.getElementById('mp-helper-bitola'),
  comprimentoInput: document.getElementById('mp-comprimento-padrao-m'),
  pesoMetroInput: document.getElementById('mp-peso-por-metro'),
  pesoUnitarioInput: document.getElementById('mp-peso-unitario-kg'),
  laminadoSection: document.getElementById('mp-laminado-section'),
  fundidoSection: document.getElementById('mp-fundido-section'),
  filtroGeometria: document.getElementById('filtro-mp-geometria'),
  filtroBitola: document.getElementById('filtro-mp-bitola'),
  drawer: document.getElementById('app-drawer'),
  drawerScrim: document.getElementById('drawer-scrim'),
  menuToggle: document.getElementById('menu-toggle'),
  drawerClose: document.getElementById('drawer-close'),
  imprimirButton: document.getElementById('btn-imprimir-mp'),
  fecharVisualizarButton: document.getElementById('btn-fechar-visualizar-mp')
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    preencherOpcoesBitola();
    preencherOpcoesDescricaoTecnica();
    preencherOpcoesLiga('LAMINADO');
    bindEvents();
    await carregarFornecedores();
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
  refs.visualizarModal.addEventListener('click', handleModalBackdrop);
  refs.menuToggle.addEventListener('click', abrirDrawer);
  refs.drawerClose.addEventListener('click', fecharDrawer);
  refs.drawerScrim.addEventListener('click', fecharDrawer);
  refs.imprimirButton.addEventListener('click', imprimirMateriaPrimaVisualizada);
  refs.fecharVisualizarButton.addEventListener('click', fecharModalVisualizarMateriaPrima);
  refs.categoriaButtons.forEach((button) => {
    button.addEventListener('click', () => setCategoria(button.dataset.categoria || 'LAMINADO'));
  });
  refs.adicionarFornecedorButton.addEventListener('click', adicionarFornecedorSelecionado);
  refs.fornecedoresLista.addEventListener('click', handleFornecedorChipClick);
  refs.bitolaMmCheckbox.addEventListener('change', handleBitolaModeChange);
  refs.bitolaPolegadaInput.addEventListener('input', handleBitolaPolegadaInput);
  refs.bitolaMmInput.addEventListener('input', handleBitolaMmInput);
  refs.filtroForm.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarFiltroAutomatico);
    field.addEventListener('change', agendarFiltroAutomatico);
  });
  refs.tabela.addEventListener('click', handleMateriaPrimaTableActions);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function preencherOpcoesDescricaoTecnica() {
  refs.materialDatalist.innerHTML = descricoesTecnicasLaminado
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join('');
}

function preencherOpcoesLiga(categoria) {
  const opcoes = categoria === 'FUNDIDO' ? ligasFundido : ligasLaminado;
  refs.ligaDatalist.innerHTML = opcoes
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join('');
}

function preencherOpcoesBitola() {
  const opcoes = gerarBitolasPolegada();
  refs.bitolaDatalist.innerHTML = opcoes
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join('');
}

function gerarBitolasPolegada() {
  const values = [];

  for (let index = 1; index <= 32; index += 1) {
    values.push(formatarFracaoPolegada(index, 16));
  }

  return values;
}

function formatarFracaoPolegada(numerador, denominador) {
  const inteiro = Math.floor(numerador / denominador);
  const resto = numerador % denominador;

  if (resto === 0) {
    return `${inteiro}"`;
  }

  const divisor = gcd(resto, denominador);
  const n = resto / divisor;
  const d = denominador / divisor;

  return inteiro === 0 ? `${n}/${d}"` : `${inteiro} ${n}/${d}"`;
}

async function carregarFornecedores() {
  const response = await fetch(fornecedoresAutocompleteApiUrl);
  const fornecedores = await response.json();

  if (!response.ok) {
    throw new Error(fornecedores.message || 'Nao foi possivel carregar os fornecedores.');
  }

  fornecedoresCache = fornecedores;
  preencherFornecedorSelects();
}

function preencherFornecedorSelects() {
  const options = fornecedoresCache
    .map((fornecedor) => `<option value="${fornecedor.id}">${escapeHtml(fornecedor.nome)}</option>`)
    .join('');

  const valorAtual = refs.fornecedorSelect.value;
  refs.fornecedorSelect.innerHTML = `<option value="">Selecione</option>${options}`;
  refs.fornecedorSelect.value = valorAtual;
}

async function carregarMateriasPrimas() {
  const params = new URLSearchParams();
  const codigo = document.getElementById('filtro-mp-codigo').value.trim();
  const nome = document.getElementById('filtro-mp-nome').value.trim();
  const geometria = refs.filtroGeometria.value;
  const bitola = refs.filtroBitola.value.trim();

  if (codigo) params.append('codigo', codigo);
  if (nome) params.append('nome', nome);
  if (geometria) params.append('geometria', geometria);
  if (bitola) params.append('bitola', bitola);

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
    refs.tabela.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma materia-prima encontrada para os filtros informados.</td></tr>';
    return;
  }

  refs.tabela.innerHTML = materiasPrimas.map((materiaPrima) => `
    <tr>
      <td class="table-code">${escapeHtml(materiaPrima.codigo)}</td>
      <td class="table-description">${escapeHtml(materiaPrima.nome)}</td>
      <td>${escapeHtml(materiaPrima.categoria || '-')}</td>
      <td>${escapeHtml(materiaPrima.liga || '-')}</td>
      <td>${escapeHtml(formatarReferencia(materiaPrima))}</td>
      <td>${escapeHtml(materiaPrima.fornecedores_nomes || materiaPrima.fornecedor_principal_nome || '-')}</td>
      <td class="table-actions-cell">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary>
          <div class="row-menu-panel">
            <button type="button" class="row-menu-item" data-action="view" data-id="${materiaPrima.id}">Visualizar</button>
            <button type="button" class="row-menu-item" data-action="edit" data-id="${materiaPrima.id}">Editar</button>
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
    nome: refs.nomeInput.value.trim(),
    categoria,
    liga: refs.ligaInput.value.trim(),
    fornecedores: selectedFornecedorIds,
    material: isFundido ? '' : refs.materialInput.value.trim(),
    geometria: isFundido ? 'FUNDIDO' : refs.geometriaSelect.value,
    bitola: isFundido ? '' : refs.bitolaPolegadaInput.value.trim(),
    bitola_mm: isFundido ? '' : normalizeDecimalPayloadValue(refs.bitolaMmInput.value),
    comprimento_padrao_m: isFundido ? '' : normalizeDecimalPayloadValue(refs.comprimentoInput.value),
    peso_por_metro: isFundido ? '' : normalizeDecimalPayloadValue(refs.pesoMetroInput.value),
    peso_unitario_kg: isFundido ? normalizeDecimalPayloadValue(refs.pesoUnitarioInput.value) : ''
  };
}

async function carregarMateriaPrimaParaEdicao(id) {
  try {
    const [materiaPrimaResponse, fornecedoresResponse] = await Promise.all([
      fetch(`${materiasPrimasApiBaseUrl}/${id}`),
      fetch(`${materiasPrimasApiBaseUrl}/${id}/fornecedores`)
    ]);

    const materiaPrima = await materiaPrimaResponse.json();
    const fornecedores = await fornecedoresResponse.json();

    if (!materiaPrimaResponse.ok) {
      throw new Error(materiaPrima.message || 'Nao foi possivel carregar a materia-prima.');
    }

    if (!fornecedoresResponse.ok) {
      throw new Error(fornecedores.message || 'Nao foi possivel carregar os fornecedores da materia-prima.');
    }

    editingMateriaPrimaId = materiaPrima.id;
    document.getElementById('materia-prima-id').value = materiaPrima.id;
    refs.codigoInput.value = materiaPrima.codigo;
    refs.nomeInput.value = materiaPrima.nome || '';
    refs.ligaInput.value = materiaPrima.liga || '';

    setCategoria(materiaPrima.categoria || 'LAMINADO');
    refs.materialInput.value = materiaPrima.material || '';
    refs.geometriaSelect.value = materiaPrima.geometria || 'REDONDO';
    refs.bitolaPolegadaInput.value = materiaPrima.bitola || '';
    refs.bitolaMmInput.value = formatInputDecimal(materiaPrima.bitola_mm, 3);
    refs.comprimentoInput.value = materiaPrima.comprimento_padrao_mm
      ? formatInputDecimal(Number(materiaPrima.comprimento_padrao_mm) / 1000, 2)
      : (String(materiaPrima.geometria || '').toUpperCase() === 'FITA / BOBINA' ? '' : '3');
    refs.pesoMetroInput.value = formatInputDecimal(materiaPrima.peso_por_metro, 2);
    refs.pesoUnitarioInput.value = formatInputDecimal(materiaPrima.peso_unitario_kg, 3);

    selectedFornecedorIds = fornecedores.map((item) => Number(item.id_fornecedor));
    renderizarFornecedoresSelecionados();

    const hasMm = !materiaPrima.bitola && materiaPrima.bitola_mm;
    refs.bitolaMmCheckbox.checked = Boolean(hasMm);
    atualizarModoBitola();
    renderizarAjudaBitola();

    refs.atualizarButton.disabled = false;
    refs.salvarButton.disabled = true;
    refs.modalTitle.textContent = `Editar ${materiaPrima.codigo}`;
    abrirModal(refs.modal);
  } catch (error) {
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

async function visualizarMateriaPrima(id) {
  try {
    const [materiaPrimaResponse, fornecedoresResponse] = await Promise.all([
      fetch(`${materiasPrimasApiBaseUrl}/${id}`),
      fetch(`${materiasPrimasApiBaseUrl}/${id}/fornecedores`)
    ]);

    const materiaPrima = await materiaPrimaResponse.json();
    const fornecedores = await fornecedoresResponse.json();

    if (!materiaPrimaResponse.ok) {
      throw new Error(materiaPrima.message || 'Nao foi possivel carregar a materia-prima.');
    }

    if (!fornecedoresResponse.ok) {
      throw new Error(fornecedores.message || 'Nao foi possivel carregar os fornecedores da materia-prima.');
    }

    refs.visualizarTitle.textContent = `${materiaPrima.codigo} - ${materiaPrima.nome}`;
    refs.visualizarCorpo.innerHTML = montarVisualizacaoMateriaPrima(materiaPrima, fornecedores);
    abrirModal(refs.visualizarModal);
  } catch (error) {
    mostrarMensagemMateriaPrima(error.message, 'error');
  }
}

function montarVisualizacaoMateriaPrima(materiaPrima, fornecedores) {
  const linhas = [
    ['ID', materiaPrima.codigo],
    ['Descricao', materiaPrima.nome],
    ['Categoria', materiaPrima.categoria],
    ['Liga', materiaPrima.liga || '-'],
    ['Fornecedores', fornecedores.length > 0
      ? fornecedores.map((item) => item.fornecedor_nome).join(', ')
      : (materiaPrima.fornecedores_nomes || materiaPrima.fornecedor_principal_nome || '-')]
  ];

  if (String(materiaPrima.categoria || '').toUpperCase() === 'LAMINADO') {
    linhas.push(['Descricao tecnica', materiaPrima.material || '-']);
    linhas.push(['Geometria', materiaPrima.geometria || '-']);
    linhas.push(['Bitola', formatarBitolaVisualizacao(materiaPrima)]);
    linhas.push(['Comprimento da barra', materiaPrima.comprimento_padrao_mm
      ? `${formatarNumero(Number(materiaPrima.comprimento_padrao_mm) / 1000, 2)} m`
      : '-']);
    linhas.push(['Peso por metro', materiaPrima.peso_por_metro
      ? `${formatarNumero(materiaPrima.peso_por_metro, 2)} kg/m`
      : '-']);
  } else {
    linhas.push(['Massa', materiaPrima.peso_unitario_kg
      ? `${formatarNumero(materiaPrima.peso_unitario_kg, 3)} kg`
      : '-']);
  }

  return linhas.map(([titulo, valor]) => `
    <article class="view-card">
      <span>${escapeHtml(titulo)}</span>
      <strong>${escapeHtml(valor)}</strong>
    </article>
  `).join('');
}

function formatarBitolaVisualizacao(materiaPrima) {
  if (materiaPrima.bitola && materiaPrima.bitola_mm) {
    return `${materiaPrima.bitola} = ${formatarNumero(materiaPrima.bitola_mm, 3)} mm`;
  }

  if (materiaPrima.bitola) {
    return materiaPrima.bitola;
  }

  if (materiaPrima.bitola_mm) {
    return `${formatarNumero(materiaPrima.bitola_mm, 3)} mm`;
  }

  return '-';
}

function imprimirMateriaPrimaVisualizada() {
  if (!refs.visualizarCorpo.innerHTML.trim()) {
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(refs.visualizarTitle.textContent)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #132538; }
          h1 { margin: 0 0 20px; font-size: 24px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .card { padding: 14px; border: 1px solid #d9e4ef; border-radius: 12px; }
          .card span { display: block; margin-bottom: 8px; color: #607286; font-size: 12px; font-weight: 700; text-transform: uppercase; }
          .card strong { display: block; font-size: 16px; line-height: 1.4; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(refs.visualizarTitle.textContent)}</h1>
        <div class="grid">${refs.visualizarCorpo.innerHTML.replaceAll('view-card', 'card')}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
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

    if (editingMateriaPrimaId === id) {
      fecharModalMateriaPrima();
    }

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

  if (action === 'view') {
    await visualizarMateriaPrima(materiaPrimaId);
  }

  if (action === 'edit') {
    await carregarMateriaPrimaParaEdicao(materiaPrimaId);
  }

  if (action === 'delete') {
    await excluirMateriaPrima(materiaPrimaId);
  }
}

function setCategoria(categoria) {
  const categoriaFinal = categoria === 'FUNDIDO' ? 'FUNDIDO' : 'LAMINADO';
  const isFundido = categoriaFinal === 'FUNDIDO';

  refs.categoriaInput.value = categoriaFinal;
  refs.categoriaButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.categoria === categoriaFinal);
  });

  refs.laminadoSection.classList.toggle('hidden', isFundido);
  refs.fundidoSection.classList.toggle('hidden', !isFundido);
  refs.materialInput.required = !isFundido;
  refs.geometriaSelect.required = !isFundido;
  refs.pesoUnitarioInput.required = isFundido;

  if (isFundido) {
    refs.materialInput.value = '';
    refs.bitolaPolegadaInput.value = '';
    refs.bitolaMmInput.value = '';
    refs.comprimentoInput.value = '3';
    refs.pesoMetroInput.value = '';
    refs.bitolaMmCheckbox.checked = false;
  } else if (!refs.comprimentoInput.value) {
    refs.comprimentoInput.value = '3';
  }

  preencherOpcoesLiga(categoriaFinal);
  atualizarModoBitola();
  renderizarAjudaBitola();
}

function adicionarFornecedorSelecionado() {
  const fornecedorId = Number.parseInt(refs.fornecedorSelect.value, 10);

  if (!Number.isInteger(fornecedorId)) {
    return mostrarMensagemModalMateriaPrima('Selecione um fornecedor antes de adicionar.', 'error');
  }

  if (selectedFornecedorIds.includes(fornecedorId)) {
    return mostrarMensagemModalMateriaPrima('Esse fornecedor ja foi adicionado.', 'error');
  }

  selectedFornecedorIds.push(fornecedorId);
  renderizarFornecedoresSelecionados();
  esconderMensagemModalMateriaPrima();
}

function handleFornecedorChipClick(event) {
  const removeButton = event.target.closest('button[data-remove-fornecedor-id]');
  if (!removeButton) return;

  const fornecedorId = Number.parseInt(removeButton.dataset.removeFornecedorId, 10);
  selectedFornecedorIds = selectedFornecedorIds.filter((id) => id !== fornecedorId);
  renderizarFornecedoresSelecionados();
}

function renderizarFornecedoresSelecionados() {
  if (selectedFornecedorIds.length === 0) {
    refs.fornecedoresLista.classList.add('selected-tags', 'empty');
    refs.fornecedoresLista.innerHTML = '<span>Nenhum fornecedor selecionado.</span>';
    return;
  }

  refs.fornecedoresLista.classList.remove('empty');
  refs.fornecedoresLista.classList.add('selected-tags');
  refs.fornecedoresLista.innerHTML = selectedFornecedorIds
    .map((fornecedorId) => fornecedoresCache.find((item) => Number(item.id) === fornecedorId))
    .filter(Boolean)
    .map((fornecedor) => `
      <span class="selected-tag">
        ${escapeHtml(fornecedor.nome)}
        <button type="button" data-remove-fornecedor-id="${fornecedor.id}" aria-label="Remover fornecedor">X</button>
      </span>
    `)
    .join('');
}

function handleBitolaModeChange() {
  atualizarModoBitola();
  renderizarAjudaBitola();
}

function atualizarModoBitola() {
  const usingMm = refs.bitolaMmCheckbox.checked;
  refs.bitolaMmWrapper.classList.toggle('hidden', !usingMm);
  refs.bitolaPolegadaInput.disabled = usingMm;
  refs.bitolaMmInput.disabled = !usingMm;
}

function handleBitolaPolegadaInput() {
  if (refs.bitolaMmCheckbox.checked || refs.categoriaInput.value === 'FUNDIDO') {
    return;
  }

  const mm = converterPolegadaParaMm(refs.bitolaPolegadaInput.value);
  refs.bitolaMmInput.value = mm !== null ? formatInputDecimal(mm, 3) : '';
  renderizarAjudaBitola();
}

function handleBitolaMmInput() {
  if (!refs.bitolaMmCheckbox.checked || refs.categoriaInput.value === 'FUNDIDO') {
    return;
  }

  const mm = parseDecimalInput(refs.bitolaMmInput.value);
  refs.bitolaPolegadaInput.value = Number.isFinite(mm) && mm > 0 ? converterMmParaPolegada(mm) : '';
  renderizarAjudaBitola();
}

function renderizarAjudaBitola() {
  if (refs.categoriaInput.value === 'FUNDIDO') {
    refs.helperBitola.textContent = 'Bitola nao se aplica ao fundido.';
    return;
  }

  const bitolaPolegada = refs.bitolaPolegadaInput.value.trim();
  const bitolaMm = parseDecimalInput(refs.bitolaMmInput.value);

  if (bitolaPolegada && Number.isFinite(bitolaMm)) {
    refs.helperBitola.textContent = `${bitolaPolegada} = ${formatarNumero(bitolaMm, 3)} mm`;
    return;
  }

  if (Number.isFinite(bitolaMm) && bitolaMm > 0) {
    refs.helperBitola.textContent = `${formatarNumero(bitolaMm, 3)} mm = ${converterMmParaPolegada(bitolaMm)}`;
    return;
  }

  refs.helperBitola.textContent = 'Preencha polegada ou mm.';
}

function resetMateriaPrimaForm() {
  refs.form.reset();
  editingMateriaPrimaId = null;
  document.getElementById('materia-prima-id').value = '';
  refs.atualizarButton.disabled = true;
  refs.salvarButton.disabled = false;
  selectedFornecedorIds = [];
  refs.comprimentoInput.value = '3';
  refs.bitolaMmCheckbox.checked = false;
  renderizarFornecedoresSelecionados();
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
  atualizarEstadoBodyModal();
}

function fecharModalMateriaPrima() {
  resetMateriaPrimaForm();
  refs.modal.classList.add('hidden');
  refs.modal.setAttribute('aria-hidden', 'true');
  atualizarEstadoBodyModal();
}

function fecharModalVisualizarMateriaPrima() {
  refs.visualizarModal.classList.add('hidden');
  refs.visualizarModal.setAttribute('aria-hidden', 'true');
  refs.visualizarTitle.textContent = 'Materia-prima';
  refs.visualizarCorpo.innerHTML = '';
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

function handleModalBackdrop(event) {
  if (event.target.dataset.closeModal === 'materia-prima') {
    fecharModalMateriaPrima();
  }

  if (event.target.dataset.closeModal === 'materia-prima-visualizar') {
    fecharModalVisualizarMateriaPrima();
  }
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
  if (!event.target.closest('.row-menu')) closeAllRowMenus();
}

function handleKeyboardShortcuts(event) {
  if (event.key !== 'Escape') return;
  closeAllRowMenus();
  if (!refs.visualizarModal.classList.contains('hidden')) return fecharModalVisualizarMateriaPrima();
  if (!refs.modal.classList.contains('hidden')) return fecharModalMateriaPrima();
  if (refs.drawer.classList.contains('is-open')) fecharDrawer();
}

function atualizarEstadoBodyModal() {
  const algumModalAberto = !refs.modal.classList.contains('hidden') || !refs.visualizarModal.classList.contains('hidden');
  document.body.classList.toggle('has-modal', algumModalAberto);
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

function extractErrorMessage(result) {
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function formatarReferencia(materiaPrima) {
  if (String(materiaPrima.categoria || '').toUpperCase() === 'FUNDIDO') {
    return materiaPrima.peso_unitario_kg ? `${formatarNumero(materiaPrima.peso_unitario_kg, 3)} kg` : '-';
  }

  if (materiaPrima.bitola) {
    return materiaPrima.bitola;
  }

  if (materiaPrima.bitola_mm) {
    return `${formatarNumero(materiaPrima.bitola_mm, 3)} mm`;
  }

  return '-';
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
