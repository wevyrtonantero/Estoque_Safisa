const etiquetasApiBaseUrl = '/api/etiquetas';
const authMeApiUrl = '/api/auth/me';
const PRINT_PREFERENCE_STORAGE_KEY = 'safisa_preferred_printer_name';

const LIMITS = Object.freeze({
  x: { min: 0, max: 800, step: 5 },
  y: { min: 0, max: 800, step: 5 },
  font: { min: 10, max: 80, step: 1 },
  width: { min: 100, max: 800, step: 10 },
  thickness: { min: 1, max: 12, step: 1 },
  barcodeHeight: { min: 20, max: 200, step: 5 },
  barcodeModule: { min: 1, max: 5, step: 1 }
});

const DEFAULT_LAYOUT = Object.freeze({
  logo: { x: 50, y: 0, visible: true },
  titulo: { x: 220, y: 195, font: 30, visible: true },
  divisor_superior: { x: 50, y: 250, width: 700, thickness: 3, visible: true },
  label_aplicacao: { x: 50, y: 280, font: 30, visible: true },
  aplicacao_linha_1: { x: 50, y: 340, font: 30, visible: true },
  aplicacao_linha_2: { x: 50, y: 400, font: 30, visible: true },
  aplicacao_linha_3: { x: 50, y: 450, font: 30, visible: true },
  divisor_inferior: { x: 50, y: 500, width: 700, thickness: 3, visible: true },
  label_numero_serie: { x: 400, y: 550, font: 30, visible: true },
  numero_serie: { x: 400, y: 600, font: 27, visible: true },
  codigo_barras: { x: 280, y: 650, largura: 2, proporcao: 2, altura: 50, visible: true },
  texto_codigo_barras: { x: 320, y: 710, font: 20, visible: true },
  data_hora: { x: 250, y: 750, font: 20, visible: true }
});

const DEFAULT_SEM_KIT_LAYOUT = Object.freeze({
  logo: { x: 50, y: 0, visible: true },
  titulo: { x: 350, y: 195, font: 30, visible: true },
  divisor_superior: { x: 50, y: 250, width: 700, thickness: 3, visible: true },
  label_aplicacao: { x: 50, y: 280, font: 30, visible: false },
  aplicacao_linha_1: { x: 350, y: 320, font: 30, visible: false },
  aplicacao_linha_2: { x: 250, y: 420, font: 30, visible: true },
  aplicacao_linha_3: { x: 50, y: 450, font: 30, visible: false },
  divisor_inferior: { x: 50, y: 500, width: 700, thickness: 3, visible: true },
  label_numero_serie: { x: 400, y: 550, font: 30, visible: true },
  numero_serie: { x: 400, y: 600, font: 27, visible: true },
  codigo_barras: { x: 280, y: 650, largura: 2, proporcao: 2, altura: 50, visible: true },
  texto_codigo_barras: { x: 320, y: 710, font: 20, visible: true },
  data_hora: { x: 250, y: 750, font: 20, visible: true }
});

const DEFAULT_AVULSA_LAYOUT = Object.freeze({
  logo: { x: 50, y: 0, visible: true },
  titulo: { x: 400, y: 190, font: 32, visible: true },
  divisor_superior: { x: 50, y: 255, width: 700, thickness: 3, visible: true },
  label_aplicacao: { x: 50, y: 280, font: 30, visible: false },
  aplicacao_linha_1: { x: 70, y: 355, font: 30, visible: true },
  aplicacao_linha_2: { x: 70, y: 455, font: 28, visible: true },
  aplicacao_linha_3: { x: 50, y: 450, font: 30, visible: false },
  divisor_inferior: { x: 50, y: 540, width: 700, thickness: 3, visible: true },
  label_numero_serie: { x: 400, y: 550, font: 30, visible: false },
  numero_serie: { x: 400, y: 600, font: 27, visible: false },
  codigo_barras: { x: 280, y: 650, largura: 2, proporcao: 2, altura: 50, visible: false },
  texto_codigo_barras: { x: 320, y: 710, font: 20, visible: false },
  data_hora: { x: 250, y: 645, font: 22, visible: true }
});

const DEFAULT_CAIXA_LAYOUT = Object.freeze({
  logo: { x: 50, y: 0, visible: true },
  titulo: { x: 400, y: 190, font: 30, visible: true },
  divisor_superior: { x: 50, y: 255, width: 700, thickness: 3, visible: true },
  label_aplicacao: { x: 50, y: 280, font: 30, visible: false },
  aplicacao_linha_1: { x: 70, y: 355, font: 30, visible: true },
  aplicacao_linha_2: { x: 70, y: 555, font: 30, visible: true },
  aplicacao_linha_3: { x: 50, y: 450, font: 30, visible: false },
  divisor_inferior: { x: 50, y: 460, width: 700, thickness: 3, visible: true },
  label_numero_serie: { x: 400, y: 550, font: 30, visible: false },
  numero_serie: { x: 400, y: 600, font: 27, visible: false },
  codigo_barras: { x: 280, y: 650, largura: 2, proporcao: 2, altura: 50, visible: false },
  texto_codigo_barras: { x: 320, y: 710, font: 20, visible: false },
  data_hora: { x: 250, y: 665, font: 22, visible: true }
});

const SEM_KIT_PRESETS = Object.freeze({
  MBF015: { titulo: 'MBF-015', codigo_barras: '789976744892', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MBF015INV: { titulo: 'MBF-015 - INVERTIDO', codigo_barras: '789976744892', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  BR015: { titulo: 'BR-015', codigo_barras: '789976744895', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  SAF040: { titulo: 'SAF-040', codigo_barras: '789976744895', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  VF040: { titulo: 'VF-040', codigo_barras: '789976744897', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  CJ015: { titulo: 'CJ-015', codigo_barras: '789976744894', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MBF025: { titulo: 'MBF-025', codigo_barras: '789976744893', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MBF032: { titulo: 'MBF-032', codigo_barras: '789976744900', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MBF040: { titulo: 'MBF-040', codigo_barras: '789976744896', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MC040: { titulo: 'MC-040', codigo_barras: '789976744902', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  AL10: { titulo: 'AL-10', codigo_barras: '789976744896', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  AL10INV: { titulo: 'AL-10 - INVERTIDO', codigo_barras: '789976744896', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  BR040: { titulo: 'BR-040', codigo_barras: '789976744898', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  BR040INV: { titulo: 'BR-040 - INVERTIDO', codigo_barras: '789976744898', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MBF032INV: { titulo: 'MBF-032 - INVERTIDO', codigo_barras: '789976744900', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MBF040INV015: { titulo: 'MBF-040 - INVERTIDO', codigo_barras: '789976744896', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MBF040INV025: { titulo: 'MBF-040 - INVERTIDO', codigo_barras: '789976744896', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  MC040RB: { titulo: 'MC-040 - REBAIXADO', codigo_barras: '789976744902', linha1: '', linha2: 'SEM KIT DE INSTALACAO', linha3: '' },
  'SM-AL10': { alias: 'AL10' },
  'SM-AL10INV': { alias: 'AL10INV' },
  'SM-BR040': { alias: 'BR040' },
  'SM-BR040INV': { alias: 'BR040INV' },
  'SM-CJ015': { alias: 'CJ015' },
  'SM-MBF015INV': { alias: 'MBF015INV' },
  'SM-MBF025': { alias: 'MBF025' },
  'SM-MBF032': { alias: 'MBF032' },
  'SM-MBF032INV': { alias: 'MBF032INV' },
  'SM-MBF040': { alias: 'MBF040' },
  'SM-MBF040INV025': { alias: 'MBF040INV025' },
  'SM-MC040': { alias: 'MC040' },
  'SM-VF040': { alias: 'VF040' }
});

const PREVIEW_BOUNDS = Object.freeze({ width: 800, height: 800 });
const PREVIEW_SERIAL = 'A-00000';

const LAYOUT_SECTIONS = Object.freeze([
  { key: 'logo', label: 'Logo', fields: ['x', 'y'], previewIds: ['preview-logo'] },
  { key: 'titulo', label: 'Titulo', fields: ['x', 'y', 'font'], previewIds: ['preview-titulo'], centerX: true },
  { key: 'divisor_superior', label: 'Linha 01 superior', fields: ['x', 'y', 'width', 'thickness'], previewIds: ['preview-divider-top'] },
  { key: 'label_aplicacao', label: 'Texto aplicacao', fields: ['x', 'y', 'font'], previewIds: ['preview-label-aplicacao'] },
  { key: 'aplicacao_linha_1', label: 'Linha 01', fields: ['x', 'y', 'font'], previewIds: ['preview-aplicacao-1'] },
  { key: 'aplicacao_linha_2', label: 'Linha 02', fields: ['x', 'y', 'font'], previewIds: ['preview-aplicacao-2'] },
  { key: 'aplicacao_linha_3', label: 'Linha 03', fields: ['x', 'y', 'font'], previewIds: ['preview-aplicacao-3'] },
  { key: 'divisor_inferior', label: 'Linha 01 inferior', fields: ['x', 'y', 'width', 'thickness'], previewIds: ['preview-divider-bottom'] },
  { key: 'label_numero_serie', label: 'Texto numero de serie', fields: ['x', 'y', 'font'], previewIds: ['preview-label-serial'], centerX: true },
  { key: 'numero_serie', label: 'Numero de serie', fields: ['x', 'y', 'font'], previewIds: ['preview-serial'], centerX: true },
  { key: 'codigo_barras', label: 'Cod de barras', fields: ['x', 'y', 'altura', 'largura'], previewIds: ['preview-barcode'] },
  { key: 'texto_codigo_barras', label: 'Numero de barras', fields: ['x', 'y', 'font'], previewIds: ['preview-barcode-text'] },
  { key: 'data_hora', label: 'Data e hora', fields: ['x', 'y', 'font'], previewIds: ['preview-datahora'] }
]);

const FIELD_META = Object.freeze({
  x: { label: 'X', limits: LIMITS.x, quick: true },
  y: { label: 'Y', limits: LIMITS.y, quick: true },
  font: { label: 'Fonte', limits: LIMITS.font, quick: true, compactLabel: 'F' },
  width: { label: 'Largura', limits: LIMITS.width, quick: false },
  thickness: { label: 'Espessura', limits: LIMITS.thickness, quick: false },
  altura: { label: 'Altura', limits: LIMITS.barcodeHeight, quick: true, compactLabel: 'A' },
  largura: { label: 'Largura', limits: LIMITS.barcodeModule, quick: true, compactLabel: 'L' }
});

const LAYOUT_SCHEMA_MAP = Object.fromEntries(LAYOUT_SECTIONS.map((section) => [section.key, section]));

let etiquetas = [];
let etiquetaAtual = null;
let currentUser = null;
let currentLayout = cloneLayout(DEFAULT_LAYOUT);
let activeLayoutKey = 'titulo';
let lastSavedLayout = cloneLayout(DEFAULT_LAYOUT);
let isDirty = false;
let suspendDirtyTracking = false;
let printDiagnosticsState = {
  libraryLoaded: false,
  statusCode: null,
  statusLabel: 'Nao iniciado',
  printers: [],
  lastError: '',
  checkedAt: null
};

function formatDisplayCodigo(codigo) {
  return String(codigo || '').replace(/^SM-/i, '');
}

function formatCategoriaLabel(categoria) {
  switch (String(categoria || '').toUpperCase()) {
    case 'SERVO_SEM_KIT':
      return 'Servo sem kit';
    case 'ITEM_AVULSO':
      return 'Item avulso';
    case 'CAIXA':
      return 'Caixa';
    case 'SERVO_COM_KIT':
    default:
      return 'Servo com kit';
  }
}

function getCurrentCategoria() {
  return String(document.getElementById('etiqueta-categoria')?.value || 'SERVO_COM_KIT').toUpperCase();
}

function isAutomaticCategory(categoria = getCurrentCategoria()) {
  return categoria === 'ITEM_AVULSO' || categoria === 'CAIXA';
}

const pageMessageBox = document.getElementById('etiqueta-page-message');
const formMessageBox = document.getElementById('etiqueta-form-message');
const dirtyMessageBox = document.getElementById('etiqueta-layout-dirty');
const buscaForm = document.getElementById('etiqueta-busca-form');
const buscaCodigoInput = document.getElementById('etiqueta-busca-codigo');
const novaEtiquetaButton = document.getElementById('btn-nova-etiqueta');
const abrirListaEtiquetasButton = document.getElementById('btn-abrir-lista-etiquetas');
const etiquetaForm = document.getElementById('etiqueta-form');
const salvarEtiquetaButton = document.getElementById('btn-salvar-etiqueta');
const gerarZplTesteButton = document.getElementById('btn-gerar-zpl-teste');
const restaurarLayoutButton = document.getElementById('btn-restaurar-layout');
const presetComKitButton = document.getElementById('btn-preset-com-kit');
const aplicarSemKitButton = document.getElementById('btn-aplicar-sem-kit');
const presetAvulsaButton = document.getElementById('btn-preset-avulsa');
const presetCaixaButton = document.getElementById('btn-preset-caixa');
const replicarLayoutButton = document.getElementById('btn-replicar-layout');
const etiquetaListaTbody = document.getElementById('etiqueta-lista-tbody');
const etiquetaFormTitle = document.getElementById('etiqueta-form-title');
const etiquetaZplOutput = document.getElementById('etiqueta-zpl-output');
const copiarZplButton = document.getElementById('btn-copiar-zpl');
const abrirLabelaryButton = document.getElementById('btn-abrir-labelary');
const modalListaEtiquetas = document.getElementById('modal-lista-etiquetas');
const modalZplTeste = document.getElementById('modal-zpl-teste');
const categoriaAutoNote = document.getElementById('etiqueta-auto-categoria-note');
const headerSimple = document.querySelector('.etiqueta-header-simple');
const previewColumn = document.querySelector('.etiqueta-column-preview');
const previewCard = document.querySelector('.etiqueta-preview-card');
const layoutAdjustmentsContainer = document.getElementById('layout-adjustments-container');
const printDiagLib = document.getElementById('etiqueta-print-diag-lib');
const printDiagStatus = document.getElementById('etiqueta-print-diag-status');
const printDiagPrintersCount = document.getElementById('etiqueta-print-diag-printers-count');
const printDiagCheckedAt = document.getElementById('etiqueta-print-diag-checked-at');
const printDiagPrinters = document.getElementById('etiqueta-print-diag-printers');
const printDiagError = document.getElementById('etiqueta-print-diag-error');
const atualizarDiagnosticoButton = document.getElementById('etiqueta-btn-atualizar-diagnostico');
const printerSelect = document.getElementById('etiqueta-print-printer-select');

const previewContainer = document.getElementById('etiqueta-preview');
const previewLogo = document.getElementById('preview-logo');
const previewTitulo = document.getElementById('preview-titulo');
const previewDividerTop = document.getElementById('preview-divider-top');
const previewLabelAplicacao = document.getElementById('preview-label-aplicacao');
const previewAplicacao1 = document.getElementById('preview-aplicacao-1');
const previewAplicacao2 = document.getElementById('preview-aplicacao-2');
const previewAplicacao3 = document.getElementById('preview-aplicacao-3');
const previewDividerBottom = document.getElementById('preview-divider-bottom');
const previewLabelSerial = document.getElementById('preview-label-serial');
const previewSerial = document.getElementById('preview-serial');
const previewBarcode = document.getElementById('preview-barcode');
const previewBarcodeText = document.getElementById('preview-barcode-text');
const previewDateTime = document.getElementById('preview-datahora');

const STATIC_FORM_IDS = [
  'etiqueta-codigo-item',
  'etiqueta-categoria',
  'etiqueta-titulo',
  'etiqueta-aplicacao-1',
  'etiqueta-aplicacao-2',
  'etiqueta-aplicacao-3',
  'etiqueta-codigo-barras',
  'etiqueta-ativo'
];

const AUTO_CATEGORY_FIELD_IDS = [
  'etiqueta-titulo',
  'etiqueta-aplicacao-1',
  'etiqueta-aplicacao-2',
  'etiqueta-aplicacao-3',
  'etiqueta-codigo-barras'
];

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  resetFormulario();
  await carregarUsuarioAtual();
  await carregarEtiquetas();
  renderizarDiagnosticoImpressora();
  await atualizarDiagnosticoImpressora({ silent: true });
  syncPreviewFloatingLayout();
  atualizarPreview();
});

function bindEvents() {
  document.addEventListener('keydown', handleGlobalKeydown);
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => fecharModal(button.dataset.closeModal));
  });

  buscaForm?.addEventListener('submit', handleBuscarEtiqueta);
  novaEtiquetaButton?.addEventListener('click', () => prepararNovaEtiqueta(buscaCodigoInput.value.trim()));
  abrirListaEtiquetasButton?.addEventListener('click', () => abrirModal('modal-lista-etiquetas'));
  etiquetaForm?.addEventListener('submit', handleSalvarEtiqueta);
  etiquetaForm?.addEventListener('input', handleFormInput);
  etiquetaForm?.addEventListener('change', handleFormInput);
  etiquetaForm?.addEventListener('focusin', handleFormFocusIn);
  etiquetaForm?.addEventListener('click', handleLayoutActionClick);
  gerarZplTesteButton?.addEventListener('click', handleGerarZplTeste);
  restaurarLayoutButton?.addEventListener('click', handleRestaurarLayoutPadrao);
  presetComKitButton?.addEventListener('click', handleAplicarPresetComKit);
  aplicarSemKitButton?.addEventListener('click', handleAplicarPresetSemKit);
  presetAvulsaButton?.addEventListener('click', handleAplicarPresetAvulsa);
  presetCaixaButton?.addEventListener('click', handleAplicarPresetCaixa);
  replicarLayoutButton?.addEventListener('click', handleReplicarLayout);
  etiquetaListaTbody?.addEventListener('click', handleListaActions);
  copiarZplButton?.addEventListener('click', handleCopiarZpl);
  abrirLabelaryButton?.addEventListener('click', handleAbrirLabelary);
  atualizarDiagnosticoButton?.addEventListener('click', () => {
    atualizarDiagnosticoImpressora()
      .catch((error) => {
        renderizarDiagnosticoImpressora(error.message || 'Nao foi possivel atualizar o diagnostico da impressora.');
      });
  });
  printerSelect?.addEventListener('change', handlePrinterSelectionChange);

  window.addEventListener('resize', () => {
    syncPreviewFloatingLayout();
    atualizarPreview();
  });
  window.addEventListener('scroll', syncPreviewFloatingLayout, { passive: true });
}

function mapearStatusJspm(statusCode) {
  const JSPM = window.JSPM;
  if (!JSPM?.WSStatus) {
    return 'Biblioteca indisponivel';
  }

  if (statusCode === JSPM.WSStatus.Open) {
    return 'Conectado';
  }

  if (statusCode === JSPM.WSStatus.Closed) {
    return 'Fechado';
  }

  if (statusCode === JSPM.WSStatus.Blocked) {
    return 'Bloqueado';
  }

  if (statusCode === JSPM.WSStatus.WaitingForUserResponse) {
    return 'Aguardando permissao';
  }

  return statusCode == null ? 'Nao iniciado' : `Status ${String(statusCode)}`;
}

function formatDiagnosticDateTime(value) {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function getStoredPreferredPrinter() {
  try {
    return window.localStorage.getItem(PRINT_PREFERENCE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredPreferredPrinter(printerName) {
  try {
    if (!printerName) {
      window.localStorage.removeItem(PRINT_PREFERENCE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PRINT_PREFERENCE_STORAGE_KEY, printerName);
  } catch {
    // ignore storage failures
  }
}

function preencherSelectImpressoras(printers = []) {
  if (!printerSelect) {
    return;
  }

  const preferredPrinter = getStoredPreferredPrinter();
  const options = [
    '<option value="">Impressora padrao do Windows</option>',
    ...printers.map((printerName) => `<option value="${escapeHtml(printerName)}">${escapeHtml(printerName)}</option>`)
  ];

  printerSelect.innerHTML = options.join('');
  if (preferredPrinter && printers.includes(preferredPrinter)) {
    printerSelect.value = preferredPrinter;
  } else {
    printerSelect.value = '';
  }
}

function renderizarDiagnosticoImpressora(overrideError = '') {
  if (!printDiagLib) {
    return;
  }

  const printers = Array.isArray(printDiagnosticsState.printers) ? printDiagnosticsState.printers : [];
  printDiagLib.textContent = printDiagnosticsState.libraryLoaded ? 'Carregada' : 'Nao carregada';
  printDiagStatus.textContent = printDiagnosticsState.statusLabel || 'Nao iniciado';
  printDiagPrintersCount.textContent = String(printers.length);
  printDiagCheckedAt.textContent = formatDiagnosticDateTime(printDiagnosticsState.checkedAt);
  printDiagError.textContent = overrideError || printDiagnosticsState.lastError || 'Nenhum erro registrado.';

  if (!printers.length) {
    printDiagPrinters.classList.add('empty');
    printDiagPrinters.innerHTML = 'Nenhuma impressora consultada ainda.';
  } else {
    printDiagPrinters.classList.remove('empty');
    printDiagPrinters.innerHTML = printers
      .map((printerName) => `<span class="selected-tag">${escapeHtml(printerName)}</span>`)
      .join('');
  }

  preencherSelectImpressoras(printers);
}

async function carregarImpressorasJspm() {
  const JSPM = window.JSPM;
  if (!JSPM?.JSPrintManager?.getPrinters) {
    return [];
  }

  try {
    const printers = await Promise.resolve(JSPM.JSPrintManager.getPrinters());
    return Array.isArray(printers) ? printers : [];
  } catch (error) {
    printDiagnosticsState.lastError = error.message || 'Nao foi possivel consultar as impressoras.';
    return [];
  }
}

function handlePrinterSelectionChange() {
  if (!printerSelect) {
    return;
  }

  setStoredPreferredPrinter(printerSelect.value);
  mostrarMensagemPagina(
    printerSelect.value
      ? `Impressora preferida definida para ${printerSelect.value}.`
      : 'A impressora padrao do Windows sera usada.',
    'success'
  );
}

async function atualizarDiagnosticoImpressora(options = {}) {
  const { silent = false } = options;
  const JSPM = window.JSPM;

  if (!JSPM?.JSPrintManager) {
    printDiagnosticsState = {
      libraryLoaded: false,
      statusCode: null,
      statusLabel: 'Biblioteca nao carregada',
      printers: [],
      lastError: 'A biblioteca JSPrintManager.js nao esta disponivel nesta pagina.',
      checkedAt: new Date().toISOString()
    };
    renderizarDiagnosticoImpressora();
    return;
  }

  printDiagnosticsState.libraryLoaded = true;
  JSPM.JSPrintManager.auto_reconnect = true;

  try {
    await Promise.resolve(JSPM.JSPrintManager.start());
  } catch (error) {
    printDiagnosticsState.statusCode = JSPM.JSPrintManager.websocket_status;
    printDiagnosticsState.statusLabel = mapearStatusJspm(printDiagnosticsState.statusCode);
    printDiagnosticsState.printers = [];
    printDiagnosticsState.lastError = error.message || 'Nao foi possivel iniciar o JSPrintManager.';
    printDiagnosticsState.checkedAt = new Date().toISOString();
    renderizarDiagnosticoImpressora();
    if (!silent) {
      throw error;
    }
    return;
  }

  let statusCode = JSPM.JSPrintManager.websocket_status;
  for (let attempt = 0; attempt < 6 && statusCode !== JSPM.WSStatus.Open && statusCode !== JSPM.WSStatus.Blocked; attempt += 1) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 400);
    });
    statusCode = JSPM.JSPrintManager.websocket_status;
  }

  printDiagnosticsState.statusCode = statusCode;
  printDiagnosticsState.statusLabel = mapearStatusJspm(statusCode);
  printDiagnosticsState.checkedAt = new Date().toISOString();

  if (statusCode === JSPM.WSStatus.Open) {
    printDiagnosticsState.printers = await carregarImpressorasJspm();
    printDiagnosticsState.lastError = '';
  } else if (statusCode === JSPM.WSStatus.Blocked) {
    printDiagnosticsState.printers = [];
    printDiagnosticsState.lastError = 'O JSPrintManager bloqueou esta pagina nesta maquina.';
  } else {
    printDiagnosticsState.printers = [];
    printDiagnosticsState.lastError = 'O servico local do JSPrintManager nao respondeu como esperado.';
  }

  renderizarDiagnosticoImpressora();
}

async function carregarUsuarioAtual() {
  try {
    const response = await fetch(authMeApiUrl);
    const payload = await response.json();
    currentUser = response.ok ? payload.user || null : null;
  } catch {
    currentUser = null;
  }
}

async function carregarEtiquetas() {
  try {
    const response = await fetch(etiquetasApiBaseUrl);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || 'Nao foi possivel carregar as etiquetas.');
    }

    etiquetas = Array.isArray(payload) ? payload : [];
    renderizarListaEtiquetas();
  } catch (error) {
    etiquetas = [];
    renderizarListaEtiquetas();
    mostrarMensagemPagina(error.message, 'error');
  }
}

function renderizarListaEtiquetas() {
  document.getElementById('etiqueta-total-registros').textContent = `${etiquetas.length} etiqueta(s) encontrada(s)`;

  if (!etiquetas.length) {
    etiquetaListaTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma etiqueta cadastrada ainda.</td></tr>';
    return;
  }

  etiquetaListaTbody.innerHTML = etiquetas.map((etiqueta) => `
    <tr class="${Number(etiquetaAtual?.id) === Number(etiqueta.id) ? 'etiqueta-row-selected' : ''}" data-id="${etiqueta.id}">
      <td><strong>${escapeHtml(formatDisplayCodigo(etiqueta.codigo_item))}</strong></td>
      <td>${escapeHtml(formatCategoriaLabel(etiqueta.categoria))}</td>
      <td class="table-description">${escapeHtml(etiqueta.titulo)}</td>
      <td>${escapeHtml(etiqueta.codigo_barras)}</td>
      <td><span class="status-chip ${etiqueta.ativo ? 'is-success' : 'is-danger'}">${etiqueta.ativo ? 'Ativa' : 'Inativa'}</span></td>
      <td class="table-actions-cell">
        <button type="button" class="btn btn-secondary btn-small" data-action="editar" data-id="${etiqueta.id}">Editar</button>
      </td>
    </tr>
  `).join('');
}

async function handleBuscarEtiqueta(event) {
  event.preventDefault();

  const codigoItem = buscaCodigoInput.value.trim().toUpperCase();
  if (!codigoItem) {
    mostrarMensagemPagina('Informe um codigo para buscar a etiqueta.', 'error');
    return;
  }

  try {
    const response = await fetch(`${etiquetasApiBaseUrl}/codigo/${encodeURIComponent(codigoItem)}`);
    const payload = await response.json();

    if (response.status === 404) {
      prepararNovaEtiqueta(codigoItem);
      mostrarMensagemFormulario('Nenhuma etiqueta encontrada para este codigo. Deseja criar uma nova?', 'success');
      return;
    }

    if (!response.ok) {
      throw new Error(payload.message || 'Nao foi possivel buscar a etiqueta.');
    }

    preencherFormulario(payload);
    destacarRegistroLista(payload.id);
    mostrarMensagemPagina(`Etiqueta ${formatDisplayCodigo(payload.codigo_item)} carregada com sucesso.`, 'success');
  } catch (error) {
    mostrarMensagemPagina(error.message, 'error');
  }
}

function prepararNovaEtiqueta(codigoPreenchido = '') {
  resetFormulario();
  if (codigoPreenchido) {
    const normalized = codigoPreenchido.trim().toUpperCase();
    document.getElementById('etiqueta-codigo-item').value = normalized;
    buscaCodigoInput.value = normalized;
  }
  etiquetaFormTitle.textContent = 'Criar nova etiqueta';
  updateCategoryUiState();
  atualizarPreview();
}

function preencherFormulario(etiqueta) {
  suspendDirtyTracking = true;
  etiquetaAtual = etiqueta;
  currentLayout = mergeLayout(etiqueta.layout_json || DEFAULT_LAYOUT);
  lastSavedLayout = cloneLayout(currentLayout);

  document.getElementById('etiqueta-id').value = String(etiqueta.id);
  document.getElementById('etiqueta-codigo-item').value = formatDisplayCodigo(etiqueta.codigo_item || '');
  document.getElementById('etiqueta-categoria').value = etiqueta.categoria || 'SERVO_COM_KIT';
  document.getElementById('etiqueta-titulo').value = etiqueta.titulo || '';
  document.getElementById('etiqueta-aplicacao-1').value = etiqueta.aplicacao_linha_1 || '';
  document.getElementById('etiqueta-aplicacao-2').value = etiqueta.aplicacao_linha_2 || '';
  document.getElementById('etiqueta-aplicacao-3').value = etiqueta.aplicacao_linha_3 || '';
  document.getElementById('etiqueta-codigo-barras').value = etiqueta.codigo_barras || '';
  document.getElementById('etiqueta-ativo').value = etiqueta.ativo ? 'true' : 'false';
  buscaCodigoInput.value = formatDisplayCodigo(etiqueta.codigo_item || '');

  renderLayoutAdjustments();
  suspendDirtyTracking = false;

  etiquetaFormTitle.textContent = `Editar etiqueta ${formatDisplayCodigo(etiqueta.codigo_item)}`;
  gerarZplTesteButton.disabled = false;
  replicarLayoutButton.disabled = false;
  limparDirtyState();
  updateCategoryUiState();
  atualizarPreview();
}

function resetFormulario() {
  suspendDirtyTracking = true;
  etiquetaAtual = null;
  currentLayout = cloneLayout(DEFAULT_LAYOUT);
  lastSavedLayout = cloneLayout(DEFAULT_LAYOUT);
  etiquetaForm.reset();
  document.getElementById('etiqueta-id').value = '';
  document.getElementById('etiqueta-ativo').value = 'true';
  document.getElementById('etiqueta-categoria').value = 'SERVO_COM_KIT';
  buscaCodigoInput.value = '';
  etiquetaFormTitle.textContent = 'Nova etiqueta';
  gerarZplTesteButton.disabled = true;
  replicarLayoutButton.disabled = true;
  etiquetaZplOutput.value = '';
  activeLayoutKey = 'titulo';
  renderLayoutAdjustments();
  suspendDirtyTracking = false;

  esconderMensagemFormulario();
  limparDirtyState();
  renderizarListaEtiquetas();
  updateCategoryUiState();
  atualizarPreview();
}

function updateCategoryUiState() {
  const categoria = getCurrentCategoria();
  const automatic = isAutomaticCategory(categoria);

  AUTO_CATEGORY_FIELD_IDS.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) {
      return;
    }

    input.readOnly = automatic;
    input.closest('.field')?.classList.toggle('etiqueta-auto-fields', automatic);
  });

  if (categoriaAutoNote) {
    categoriaAutoNote.classList.toggle('hidden', !automatic);
  }
}

function ensureAutomaticCategoryDefaults(categoria = getCurrentCategoria()) {
  const codigoInput = document.getElementById('etiqueta-codigo-item');
  const tituloInput = document.getElementById('etiqueta-titulo');
  const aplicacao1Input = document.getElementById('etiqueta-aplicacao-1');
  const aplicacao2Input = document.getElementById('etiqueta-aplicacao-2');
  const aplicacao3Input = document.getElementById('etiqueta-aplicacao-3');
  const codigoBarrasInput = document.getElementById('etiqueta-codigo-barras');

  if (categoria === 'ITEM_AVULSO') {
    if (!codigoInput.value.trim()) {
      codigoInput.value = 'AVULSA';
    }
    if (!tituloInput.value.trim()) {
      tituloInput.value = 'DESCRICAO DA PECA';
    }
    if (!aplicacao1Input.value.trim()) {
      aplicacao1Input.value = 'QUANTIDADE: 1';
    }
    aplicacao2Input.value = '';
    aplicacao3Input.value = '';
    if (!codigoBarrasInput.value.trim()) {
      codigoBarrasInput.value = 'AUTO';
    }
  }

  if (categoria === 'CAIXA') {
    if (!codigoInput.value.trim()) {
      codigoInput.value = 'CAIXA';
    }
    if (!tituloInput.value.trim()) {
      tituloInput.value = 'NOME DO CLIENTE';
    }
    if (!aplicacao1Input.value.trim()) {
      aplicacao1Input.value = 'NF: 123456';
    }
    if (!aplicacao2Input.value.trim()) {
      aplicacao2Input.value = 'TRANSPORTADORA';
    }
    aplicacao3Input.value = '';
    if (!codigoBarrasInput.value.trim()) {
      codigoBarrasInput.value = 'AUTO';
    }
  }
}

function renderLayoutAdjustments() {
  if (!layoutAdjustmentsContainer) {
    return;
  }

  layoutAdjustmentsContainer.innerHTML = LAYOUT_SECTIONS.map((section) => {
    const item = currentLayout[section.key];
    const isVisible = item.visible !== false;
    const hasFont = section.fields.includes('font');
    const hasBarcodeHeight = section.fields.includes('altura');
    const hasBarcodeWidth = section.fields.includes('largura');

    return `
      <div class="etiqueta-adjust-card ${activeLayoutKey === section.key ? 'is-active' : ''} ${isVisible ? '' : 'is-hidden'}" data-layout-card="${section.key}">
        <div class="etiqueta-adjust-head">
          <div class="etiqueta-adjust-title-block">
            <h3>${section.label}</h3>
            <span class="etiqueta-adjust-state">${isVisible ? 'Visivel' : 'Oculto'}</span>
          </div>
          <div class="etiqueta-adjust-actions">
            <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="y" data-layout-delta="-5">↑</button>
            <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="y" data-layout-delta="5">↓</button>
            <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="x" data-layout-delta="-5">←</button>
            <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="x" data-layout-delta="5">→</button>
            ${hasFont ? `
              <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="font" data-layout-delta="-1">F-</button>
              <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="font" data-layout-delta="1">F+</button>
            ` : ''}
            ${hasBarcodeHeight ? `
              <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="altura" data-layout-delta="-5">A-</button>
              <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="altura" data-layout-delta="5">A+</button>
            ` : ''}
            ${hasBarcodeWidth ? `
              <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="largura" data-layout-delta="-1">L-</button>
              <button type="button" class="icon-btn small" data-layout-action="delta" data-layout-key="${section.key}" data-layout-prop="largura" data-layout-delta="1">L+</button>
            ` : ''}
            <button type="button" class="btn btn-neutral btn-small etiqueta-toggle-btn ${isVisible ? '' : 'is-hidden'}" data-layout-action="toggle-visibility" data-layout-key="${section.key}">
              ${isVisible ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        <div class="etiqueta-adjust-fields">
          ${section.fields.map((field) => buildFieldHtml(section.key, field, item[field])).join('')}
        </div>
      </div>
    `;
  }).join('');

  updateActiveLayoutState();
}

function buildFieldHtml(key, field, value) {
  const meta = FIELD_META[field];
  const inputId = getLayoutInputId(key, field);

  return `
    <label class="etiqueta-mini-field" for="${inputId}">
      <span>${meta.label}</span>
      <input
        id="${inputId}"
        type="number"
        inputmode="numeric"
        value="${escapeHtml(value)}"
        min="${meta.limits.min}"
        max="${meta.limits.max}"
        step="${meta.limits.step}"
        data-layout-input="true"
        data-layout-key="${key}"
        data-layout-prop="${field}"
      >
    </label>
  `;
}

function handleFormInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches('[data-layout-input="true"]')) {
    const key = target.dataset.layoutKey;
    const prop = target.dataset.layoutProp;
    if (!key || !prop) {
      return;
    }

    applyLayoutFieldValue(key, prop, target.value);
    target.value = String(currentLayout[key][prop]);
    setActiveLayoutKey(key);
    if (!suspendDirtyTracking) {
      marcarDirty();
    }
    atualizarPreview();
    return;
  }

  if (STATIC_FORM_IDS.includes(target.id)) {
    if (target.id === 'etiqueta-categoria') {
      ensureAutomaticCategoryDefaults(target.value);
      updateCategoryUiState();
    }
    if (!suspendDirtyTracking) {
      marcarDirty();
    }
    atualizarPreview();
  }
}

function handleFormFocusIn(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const key = target.dataset.layoutKey;
  if (key) {
    setActiveLayoutKey(key);
  }
}

function handleLayoutActionClick(event) {
  const button = event.target.closest('[data-layout-action]');
  if (!button) {
    return;
  }

  event.preventDefault();

  const action = button.dataset.layoutAction;
  const key = button.dataset.layoutKey;
  if (!action || !key || !currentLayout[key]) {
    return;
  }

  setActiveLayoutKey(key);

  if (action === 'delta') {
    const prop = button.dataset.layoutProp;
    const delta = Number.parseInt(button.dataset.layoutDelta || '0', 10);
    if (!prop || !Number.isFinite(delta)) {
      return;
    }

    const currentValue = normalizeInteger(currentLayout[key][prop], 0);
    applyLayoutFieldValue(key, prop, currentValue + delta);
    updateSingleLayoutInput(key, prop);
    marcarDirty();
    atualizarPreview();
    return;
  }

  if (action === 'toggle-visibility') {
    currentLayout[key].visible = !(currentLayout[key].visible !== false);
    marcarDirty();
    renderLayoutAdjustments();
    atualizarPreview();
  }
}

function applyLayoutFieldValue(key, prop, rawValue) {
  if (!currentLayout[key]) {
    return;
  }

  const normalized = normalizeLayoutProp(prop, rawValue, currentLayout[key][prop]);
  currentLayout[key][prop] = normalized;
}

function updateSingleLayoutInput(key, prop) {
  const input = document.getElementById(getLayoutInputId(key, prop));
  if (input) {
    input.value = String(currentLayout[key][prop]);
  }
}

function normalizeLayoutProp(prop, rawValue, fallbackValue) {
  const value = normalizeInteger(rawValue, fallbackValue);

  switch (prop) {
    case 'x':
      return clamp(value, LIMITS.x.min, LIMITS.x.max);
    case 'y':
      return clamp(value, LIMITS.y.min, LIMITS.y.max);
    case 'font':
      return clamp(value, LIMITS.font.min, LIMITS.font.max);
    case 'width':
      return clamp(value, LIMITS.width.min, LIMITS.width.max);
    case 'thickness':
      return clamp(value, LIMITS.thickness.min, LIMITS.thickness.max);
    case 'altura':
      return clamp(value, LIMITS.barcodeHeight.min, LIMITS.barcodeHeight.max);
    case 'largura':
      return clamp(value, LIMITS.barcodeModule.min, LIMITS.barcodeModule.max);
    default:
      return value;
  }
}

async function handleSalvarEtiqueta(event) {
  event.preventDefault();

  const id = Number.parseInt(document.getElementById('etiqueta-id').value, 10);
  const payload = buildPayloadFromForm();
  const originalLabel = salvarEtiquetaButton?.textContent || 'Salvar etiqueta';

  try {
    if (salvarEtiquetaButton) {
      salvarEtiquetaButton.disabled = true;
      salvarEtiquetaButton.textContent = 'Salvando...';
    }
    const response = await fetch(Number.isInteger(id) ? `${etiquetasApiBaseUrl}/${id}` : etiquetasApiBaseUrl, {
      method: Number.isInteger(id) ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(extractErrorMessage(result));
    }

    await carregarEtiquetas();
    preencherFormulario(result);
    destacarRegistroLista(result.id);
    mostrarMensagemPagina(`Etiqueta ${formatDisplayCodigo(result.codigo_item)} salva com sucesso.`, 'success');
    mostrarMensagemFormulario('Layout salvo. Agora o ZPL de teste ja vai refletir os ajustes gravados.', 'success');
  } catch (error) {
    mostrarMensagemFormulario(error.message, 'error');
  } finally {
    if (salvarEtiquetaButton) {
      salvarEtiquetaButton.disabled = false;
      salvarEtiquetaButton.textContent = originalLabel;
    }
  }
}

async function handleGerarZplTeste() {
  if (isDirty) {
    mostrarMensagemFormulario('Existem alteracoes nao salvas. Salve antes de gerar o ZPL final.', 'warning');
    return;
  }

  const codigoItem = document.getElementById('etiqueta-codigo-item').value.trim().toUpperCase();
  if (!codigoItem) {
    mostrarMensagemFormulario('Informe ou carregue um codigo antes de gerar o ZPL de teste.', 'error');
    return;
  }

  try {
    const response = await fetch(`${etiquetasApiBaseUrl}/gerar-zpl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigoItem,
        numeroSerie: PREVIEW_SERIAL
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel gerar o ZPL de teste.');
    }

    etiquetaZplOutput.value = result.zpl || '';
    mostrarMensagemFormulario('ZPL de teste gerado com sucesso no backend.', 'success');
    abrirModal('modal-zpl-teste');
  } catch (error) {
    mostrarMensagemFormulario(error.message, 'error');
  }
}

async function handleReplicarLayout() {
  const id = Number.parseInt(document.getElementById('etiqueta-id').value, 10);
  if (!Number.isInteger(id)) {
    mostrarMensagemFormulario('Carregue uma etiqueta antes de replicar o layout.', 'error');
    return;
  }

  if (isDirty) {
    mostrarMensagemFormulario('Salve as alteracoes desta etiqueta antes de replicar o layout.', 'warning');
    return;
  }

  if (!window.confirm('Replicar o layout desta etiqueta para as demais da mesma categoria?')) {
    return;
  }

  const originalLabel = replicarLayoutButton?.textContent || 'Replicar layout da categoria';

  try {
    if (replicarLayoutButton) {
      replicarLayoutButton.disabled = true;
      replicarLayoutButton.textContent = 'Replicando...';
    }
    const response = await fetch(`${etiquetasApiBaseUrl}/${id}/replicar-layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel replicar o layout.');
    }

    await carregarEtiquetas();
    mostrarMensagemFormulario(result.message || 'Layout replicado com sucesso.', 'success');
  } catch (error) {
    mostrarMensagemFormulario(error.message, 'error');
  } finally {
    if (replicarLayoutButton) {
      replicarLayoutButton.disabled = false;
      replicarLayoutButton.textContent = originalLabel;
    }
  }
}

function handleListaActions(event) {
  const actionButton = event.target.closest('button[data-action="editar"]');
  if (!actionButton) {
    return;
  }

  const id = Number.parseInt(actionButton.dataset.id, 10);
  if (!Number.isInteger(id)) {
    return;
  }

  const etiqueta = etiquetas.find((item) => Number(item.id) === id);
  if (!etiqueta) {
    return;
  }

  preencherFormulario(etiqueta);
  destacarRegistroLista(etiqueta.id);
  fecharModal('modal-lista-etiquetas');
}

function handleRestaurarLayoutPadrao() {
  if (!window.confirm('Deseja restaurar o ultimo layout salvo desta etiqueta?')) {
    return;
  }

  currentLayout = cloneLayout(etiquetaAtual ? lastSavedLayout : DEFAULT_LAYOUT);
  renderLayoutAdjustments();
  marcarDirty();
  atualizarPreview();
  mostrarMensagemFormulario(
    etiquetaAtual
      ? 'Layout restaurado para a ultima versao salva desta etiqueta. Clique em Salvar etiqueta para gravar se quiser manter.'
      : 'Layout restaurado para o padrao inicial. Clique em Salvar etiqueta para gravar.',
    'warning'
  );
}

function resolveSemKitPresetByCode(codigoItem) {
  const normalized = String(codigoItem || '').trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const direct = SEM_KIT_PRESETS[normalized];
  if (!direct) {
    return null;
  }

  if (!direct.alias) {
    return direct;
  }

  return SEM_KIT_PRESETS[direct.alias] || null;
}

function deriveSemKitTitle(codigoItem, currentTitle = '') {
  const normalizedCode = String(codigoItem || '').trim().toUpperCase();
  const normalizedTitle = String(currentTitle || '').trim().toUpperCase();

  if (normalizedTitle) {
    return normalizedTitle
      .replace(/^SERVO EMBREAGEM\s+/, '')
      .replace(/\s+COM KIT COMPLETO$/, '')
      .replace(/\s+COM KIT$/, '')
      .trim() || normalizedCode.replace(/^SM-/, '');
  }

  return normalizedCode.replace(/^SM-/, '');
}

function handleAplicarPresetComKit() {
  document.getElementById('etiqueta-categoria').value = 'SERVO_COM_KIT';
  currentLayout = mergeLayout(DEFAULT_LAYOUT);
  renderLayoutAdjustments();
  setActiveLayoutKey('titulo');
  marcarDirty();
  updateCategoryUiState();
  atualizarPreview();
  mostrarMensagemFormulario('Preset servo com kit aplicado. Agora voce pode ajustar fino e salvar.', 'success');
}

function handleAplicarPresetSemKit() {
  const codigoInput = document.getElementById('etiqueta-codigo-item');
  const tituloInput = document.getElementById('etiqueta-titulo');
  const aplicacao1Input = document.getElementById('etiqueta-aplicacao-1');
  const aplicacao2Input = document.getElementById('etiqueta-aplicacao-2');
  const aplicacao3Input = document.getElementById('etiqueta-aplicacao-3');
  const codigoBarrasInput = document.getElementById('etiqueta-codigo-barras');

  const codigoItem = codigoInput.value.trim().toUpperCase();
  if (!codigoItem) {
    mostrarMensagemFormulario('Informe primeiro o codigo do item antes de aplicar o preset sem kit.', 'warning');
    codigoInput.focus();
    return;
  }

  const preset = resolveSemKitPresetByCode(codigoItem);
  const derivedTitle = deriveSemKitTitle(codigoItem, tituloInput.value);
  const tituloSemKit = preset?.titulo || derivedTitle;

  tituloInput.value = tituloSemKit;
  document.getElementById('etiqueta-categoria').value = 'SERVO_SEM_KIT';
  aplicacao1Input.value = preset?.linha1 || '';
  aplicacao2Input.value = preset?.linha2 || 'SEM KIT DE INSTALACAO';
  aplicacao3Input.value = preset?.linha3 || '';
  if (preset?.codigo_barras) {
    codigoBarrasInput.value = preset.codigo_barras;
  }

  currentLayout = mergeLayout(DEFAULT_SEM_KIT_LAYOUT);
  currentLayout.aplicacao_linha_1.visible = Boolean(aplicacao1Input.value.trim());
  currentLayout.aplicacao_linha_2.visible = Boolean(aplicacao2Input.value.trim());
  currentLayout.aplicacao_linha_3.visible = Boolean(aplicacao3Input.value.trim());

  renderLayoutAdjustments();
  setActiveLayoutKey('titulo');
  marcarDirty();
  updateCategoryUiState();
  atualizarPreview();

  mostrarMensagemFormulario(
    `Preset sem kit aplicado para ${codigoItem}. Agora voce pode ajustar fino e salvar.`,
    'success'
  );
}

function handleAplicarPresetAvulsa() {
  const codigoInput = document.getElementById('etiqueta-codigo-item');
  const tituloInput = document.getElementById('etiqueta-titulo');
  const aplicacao1Input = document.getElementById('etiqueta-aplicacao-1');
  const aplicacao2Input = document.getElementById('etiqueta-aplicacao-2');
  const aplicacao3Input = document.getElementById('etiqueta-aplicacao-3');
  const codigoBarrasInput = document.getElementById('etiqueta-codigo-barras');

  document.getElementById('etiqueta-categoria').value = 'ITEM_AVULSO';

  if (!codigoInput.value.trim()) {
    codigoInput.value = 'AVULSA';
  }
  if (!tituloInput.value.trim()) {
    tituloInput.value = 'DESCRICAO DA PECA';
  }
  if (!aplicacao1Input.value.trim()) {
    aplicacao1Input.value = 'QUANTIDADE: 1';
  }
  aplicacao2Input.value = '';
  aplicacao3Input.value = '';
  if (!codigoBarrasInput.value.trim()) {
    codigoBarrasInput.value = 'AUTO';
  }

  currentLayout = mergeLayout(DEFAULT_AVULSA_LAYOUT);
  renderLayoutAdjustments();
  setActiveLayoutKey('titulo');
  marcarDirty();
  updateCategoryUiState();
  atualizarPreview();
  mostrarMensagemFormulario('Preset de item avulso aplicado. Essa categoria usa dados automaticos do pedido depois.', 'success');
}

function handleAplicarPresetCaixa() {
  const codigoInput = document.getElementById('etiqueta-codigo-item');
  const tituloInput = document.getElementById('etiqueta-titulo');
  const aplicacao1Input = document.getElementById('etiqueta-aplicacao-1');
  const aplicacao2Input = document.getElementById('etiqueta-aplicacao-2');
  const aplicacao3Input = document.getElementById('etiqueta-aplicacao-3');
  const codigoBarrasInput = document.getElementById('etiqueta-codigo-barras');

  document.getElementById('etiqueta-categoria').value = 'CAIXA';

  if (!codigoInput.value.trim()) {
    codigoInput.value = 'CAIXA';
  }
  if (!tituloInput.value.trim()) {
    tituloInput.value = 'NOME DO CLIENTE';
  }
  if (!aplicacao1Input.value.trim()) {
    aplicacao1Input.value = 'NF: 123456';
  }
  if (!aplicacao2Input.value.trim()) {
    aplicacao2Input.value = 'TRANSPORTADORA';
  }
  aplicacao3Input.value = '';
  if (!codigoBarrasInput.value.trim()) {
    codigoBarrasInput.value = 'AUTO';
  }

  currentLayout = mergeLayout(DEFAULT_CAIXA_LAYOUT);
  renderLayoutAdjustments();
  setActiveLayoutKey('titulo');
  marcarDirty();
  updateCategoryUiState();
  atualizarPreview();
  mostrarMensagemFormulario('Preset de caixa aplicado. Essa categoria usa dados automaticos do pedido depois.', 'success');
}

function buildPayloadFromForm() {
  return {
    codigo_item: document.getElementById('etiqueta-codigo-item').value.trim().toUpperCase(),
    categoria: document.getElementById('etiqueta-categoria').value,
    titulo: document.getElementById('etiqueta-titulo').value.trim(),
    aplicacao_linha_1: document.getElementById('etiqueta-aplicacao-1').value.trim(),
    aplicacao_linha_2: document.getElementById('etiqueta-aplicacao-2').value.trim(),
    aplicacao_linha_3: document.getElementById('etiqueta-aplicacao-3').value.trim(),
    codigo_barras: document.getElementById('etiqueta-codigo-barras').value.trim(),
    ativo: document.getElementById('etiqueta-ativo').value === 'true',
    layout_json: cloneLayout(currentLayout)
  };
}

function atualizarPreview() {
  syncPreviewFloatingLayout();

  const layout = currentLayout;
  const categoria = getCurrentCategoria();
  const codigoItem = document.getElementById('etiqueta-codigo-item').value.trim().toUpperCase();
  const tituloCadastro = document.getElementById('etiqueta-titulo').value.trim();
  const aplicacao1Cadastro = document.getElementById('etiqueta-aplicacao-1').value.trim();
  const aplicacao2Cadastro = document.getElementById('etiqueta-aplicacao-2').value.trim();
  const aplicacao3Cadastro = document.getElementById('etiqueta-aplicacao-3').value.trim();
  const codigoBarras = document.getElementById('etiqueta-codigo-barras').value.trim() || '789976744814';

  let titulo = tituloCadastro || 'MBF015 - 1F';
  let labelAplicacao = 'Aplicacao:';
  let aplicacao1 = aplicacao1Cadastro || 'Mercedes Benz - Caminhao';
  let aplicacao2 = aplicacao2Cadastro;
  let aplicacao3 = aplicacao3Cadastro;
  let labelNumeroSerie = 'Numero de Serie';
  let serialValue = PREVIEW_SERIAL;
  let barcodeText = codigoBarras;

  if (categoria === 'SERVO_SEM_KIT') {
    titulo = tituloCadastro || (codigoItem ? formatDisplayCodigo(codigoItem) : 'MBF-015');
    aplicacao1 = aplicacao1Cadastro;
    aplicacao2 = aplicacao2Cadastro || 'SEM KIT DE INSTALACAO';
    aplicacao3 = aplicacao3Cadastro;
  } else if (categoria === 'ITEM_AVULSO') {
    titulo = codigoItem || 'CODIGO DA PECA';
    labelAplicacao = '';
    aplicacao1 = tituloCadastro || 'DESCRICAO DA PECA';
    aplicacao2 = aplicacao1Cadastro || 'QUANTIDADE: 1';
    aplicacao3 = '';
    labelNumeroSerie = '';
    serialValue = '';
    barcodeText = '';
  } else if (categoria === 'CAIXA') {
    titulo = tituloCadastro || 'NOME DO CLIENTE';
    labelAplicacao = '';
    aplicacao1 = aplicacao1Cadastro || 'NF: 123456';
    aplicacao2 = aplicacao2Cadastro || 'TRANSPORTADORA';
    aplicacao3 = '';
    labelNumeroSerie = '';
    serialValue = '';
    barcodeText = '';
  }

  previewTitulo.textContent = titulo;
  previewLabelAplicacao.textContent = labelAplicacao;
  previewAplicacao1.textContent = aplicacao1;
  previewAplicacao2.textContent = aplicacao2;
  previewAplicacao3.textContent = aplicacao3;
  previewLabelSerial.textContent = labelNumeroSerie;
  previewSerial.textContent = serialValue;
  previewBarcodeText.textContent = barcodeText;
  previewDateTime.textContent = formatPreviewDateTime();

  const widthScale = previewContainer.clientWidth / PREVIEW_BOUNDS.width;
  const heightScale = previewContainer.clientHeight / PREVIEW_BOUNDS.height;

  positionPreviewLogo(layout.logo, widthScale, heightScale);
  positionPreviewText(previewTitulo, layout.titulo, widthScale, heightScale, { centerX: true });
  positionPreviewLine(previewDividerTop, layout.divisor_superior, widthScale, heightScale);
  positionPreviewText(previewLabelAplicacao, layout.label_aplicacao, widthScale, heightScale);
  positionPreviewText(previewAplicacao1, layout.aplicacao_linha_1, widthScale, heightScale);
  positionPreviewText(previewAplicacao2, layout.aplicacao_linha_2, widthScale, heightScale);
  positionPreviewText(previewAplicacao3, layout.aplicacao_linha_3, widthScale, heightScale);
  positionPreviewLine(previewDividerBottom, layout.divisor_inferior, widthScale, heightScale);
  positionPreviewText(previewLabelSerial, layout.label_numero_serie, widthScale, heightScale, { centerX: true });
  positionPreviewText(previewSerial, layout.numero_serie, widthScale, heightScale, { centerX: true });
  positionPreviewBarcode(layout.codigo_barras, barcodeText || 'AUTO', widthScale, heightScale);
  positionPreviewText(previewBarcodeText, layout.texto_codigo_barras, widthScale, heightScale);
  positionPreviewText(previewDateTime, layout.data_hora, widthScale, heightScale);

  applyPreviewVisibility('logo', layout.logo.visible);
  applyPreviewVisibility('titulo', layout.titulo.visible);
  applyPreviewVisibility('divisor_superior', layout.divisor_superior.visible);
  applyPreviewVisibility('label_aplicacao', layout.label_aplicacao.visible && Boolean(labelAplicacao));
  applyPreviewVisibility('aplicacao_linha_1', layout.aplicacao_linha_1.visible && Boolean(aplicacao1));
  applyPreviewVisibility('aplicacao_linha_2', layout.aplicacao_linha_2.visible && Boolean(aplicacao2));
  applyPreviewVisibility('aplicacao_linha_3', layout.aplicacao_linha_3.visible && Boolean(aplicacao3));
  applyPreviewVisibility('divisor_inferior', layout.divisor_inferior.visible);
  applyPreviewVisibility('label_numero_serie', layout.label_numero_serie.visible && Boolean(labelNumeroSerie));
  applyPreviewVisibility('numero_serie', layout.numero_serie.visible && Boolean(serialValue));
  applyPreviewVisibility('codigo_barras', layout.codigo_barras.visible && Boolean(barcodeText));
  applyPreviewVisibility('texto_codigo_barras', layout.texto_codigo_barras.visible && Boolean(barcodeText));
  applyPreviewVisibility('data_hora', layout.data_hora.visible);

  updateActiveLayoutState();
}

function positionPreviewLogo(config, widthScale, heightScale) {
  previewLogo.style.left = `${Math.max(0, config.x * widthScale - 26)}px`;
  previewLogo.style.top = `${Math.max(8, config.y * heightScale + 18)}px`;
}

function positionPreviewText(element, config, widthScale, heightScale, options = {}) {
  element.style.left = `${config.x * widthScale}px`;
  element.style.top = `${config.y * heightScale}px`;
  element.style.fontSize = `${Math.max(10, config.font * widthScale)}px`;
  element.style.transform = options.centerX ? 'translateX(-50%)' : 'none';
  element.style.textAlign = options.centerX ? 'center' : 'left';
}

function positionPreviewLine(element, config, widthScale, heightScale) {
  element.style.left = `${config.x * widthScale}px`;
  element.style.top = `${config.y * heightScale}px`;
  element.style.width = `${config.width * widthScale}px`;
  element.style.height = `${Math.max(2, config.thickness)}px`;
}

function positionPreviewBarcode(config, codigoBarras, widthScale, heightScale) {
  previewBarcode.style.left = `${config.x * widthScale}px`;
  previewBarcode.style.top = `${config.y * heightScale}px`;
  previewBarcode.style.width = `${Math.max(150, codigoBarras.length * Math.max(6, config.largura * 5)) * widthScale}px`;
  previewBarcode.style.height = `${Math.max(44, config.altura * heightScale)}px`;
  previewBarcode.style.setProperty('--barcode-module', `${Math.max(2, config.largura * 2)}px`);
}

function applyPreviewVisibility(key, visible) {
  getPreviewElements(key).forEach((element) => {
    if (element) {
      element.classList.toggle('hidden', !visible);
    }
  });
}

function setActiveLayoutKey(key) {
  if (!LAYOUT_SCHEMA_MAP[key]) {
    return;
  }

  activeLayoutKey = key;
  updateActiveLayoutState();
}

function updateActiveLayoutState() {
  document.querySelectorAll('[data-layout-card]').forEach((card) => {
    card.classList.toggle('is-active', card.dataset.layoutCard === activeLayoutKey);
  });

  const allPreviewElements = [
    previewLogo,
    previewTitulo,
    previewDividerTop,
    previewLabelAplicacao,
    previewAplicacao1,
    previewAplicacao2,
    previewAplicacao3,
    previewDividerBottom,
    previewLabelSerial,
    previewSerial,
    previewBarcode,
    previewBarcodeText,
    previewDateTime
  ];

  allPreviewElements.forEach((element) => {
    element?.classList.remove('etiqueta-preview-element-active');
  });

  getPreviewElements(activeLayoutKey).forEach((element) => {
    element?.classList.add('etiqueta-preview-element-active');
  });
}

function getPreviewElements(key) {
  const section = LAYOUT_SCHEMA_MAP[key];
  if (!section) {
    return [];
  }

  return (section.previewIds || [])
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

function syncPreviewFloatingLayout() {
  if (!previewColumn || !previewCard) {
    return;
  }

  const isDesktop = window.innerWidth > 1180;
  if (!isDesktop) {
    previewCard.classList.remove('etiqueta-preview-floating');
    previewCard.style.position = '';
    previewCard.style.top = '';
    previewCard.style.left = '';
    previewCard.style.width = '';
    previewCard.style.maxWidth = '';
    previewColumn.style.minHeight = '';
    return;
  }

  const rect = previewColumn.getBoundingClientRect();
  const width = previewColumn.offsetWidth;
  const headerBottom = headerSimple ? headerSimple.getBoundingClientRect().bottom : 0;
  const dynamicTop = Math.max(16, Math.round(headerBottom + 16));

  previewCard.classList.add('etiqueta-preview-floating');
  previewCard.style.position = 'fixed';
  previewCard.style.top = `${dynamicTop}px`;
  previewCard.style.left = `${rect.left}px`;
  previewCard.style.width = `${width}px`;
  previewCard.style.maxWidth = `${width}px`;
  previewColumn.style.minHeight = `${previewCard.offsetHeight + dynamicTop}px`;
}

function mergeLayout(layout) {
  const source = typeof layout === 'object' && layout !== null ? layout : {};
  const defaults = cloneLayout(DEFAULT_LAYOUT);

  return {
    logo: { ...defaults.logo, ...(source.logo || {}) },
    titulo: { ...defaults.titulo, ...(source.titulo || {}) },
    divisor_superior: { ...defaults.divisor_superior, ...(source.divisor_superior || {}) },
    label_aplicacao: { ...defaults.label_aplicacao, ...(source.label_aplicacao || {}) },
    aplicacao_linha_1: { ...defaults.aplicacao_linha_1, ...(source.aplicacao_linha_1 || {}) },
    aplicacao_linha_2: { ...defaults.aplicacao_linha_2, ...(source.aplicacao_linha_2 || {}) },
    aplicacao_linha_3: { ...defaults.aplicacao_linha_3, ...(source.aplicacao_linha_3 || {}) },
    divisor_inferior: { ...defaults.divisor_inferior, ...(source.divisor_inferior || {}) },
    label_numero_serie: { ...defaults.label_numero_serie, ...(source.label_numero_serie || {}) },
    numero_serie: { ...defaults.numero_serie, ...(source.numero_serie || {}) },
    codigo_barras: { ...defaults.codigo_barras, ...(source.codigo_barras || {}) },
    texto_codigo_barras: { ...defaults.texto_codigo_barras, ...(source.texto_codigo_barras || {}) },
    data_hora: { ...defaults.data_hora, ...(source.data_hora || {}) }
  };
}

function destacarRegistroLista(id) {
  if (!Number.isInteger(id)) {
    return;
  }

  const etiqueta = etiquetas.find((item) => Number(item.id) === id);
  if (!etiqueta) {
    return;
  }

  etiquetaAtual = etiqueta;
  renderizarListaEtiquetas();
}

function marcarDirty() {
  isDirty = true;
  dirtyMessageBox.classList.remove('hidden');
}

function limparDirtyState() {
  isDirty = false;
  dirtyMessageBox.classList.add('hidden');
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return;
  }

  if (!modalZplTeste.classList.contains('hidden')) {
    fecharModal('modal-zpl-teste');
    return;
  }

  if (!modalListaEtiquetas.classList.contains('hidden')) {
    fecharModal('modal-lista-etiquetas');
  }
}

function abrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');

  if ([...document.querySelectorAll('.modal')].every((item) => item.classList.contains('hidden'))) {
    document.body.classList.remove('has-modal');
  }
}

async function handleCopiarZpl() {
  const text = etiquetaZplOutput.value.trim();
  if (!text) {
    mostrarMensagemFormulario('Nenhum ZPL foi gerado ainda para copiar.', 'warning');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    mostrarMensagemFormulario('ZPL copiado para a area de transferencia.', 'success');
  } catch {
    mostrarMensagemFormulario('Nao foi possivel copiar o ZPL automaticamente.', 'error');
  }
}

function handleAbrirLabelary() {
  window.open('https://labelary.com/viewer.html?density=8&quality=grayscale&width=10&height=10&units=cm&index=0&rotation=0&zpl=', '_blank', 'noopener');
}

function mostrarMensagemPagina(texto, tipo) {
  pageMessageBox.textContent = texto;
  pageMessageBox.className = `message ${tipo}`;
  pageMessageBox.classList.remove('hidden');
}

function mostrarMensagemFormulario(texto, tipo) {
  formMessageBox.textContent = texto;
  formMessageBox.className = `message ${tipo}`;
  formMessageBox.classList.remove('hidden');
}

function esconderMensagemFormulario() {
  formMessageBox.className = 'message hidden';
  formMessageBox.textContent = '';
}

function extractErrorMessage(result) {
  if (Array.isArray(result.details) && result.details.length > 0) {
    return result.details.join(' ');
  }

  return result.message || 'Operacao nao concluida.';
}

function formatPreviewDateTime() {
  return new Date().toLocaleString('pt-BR');
}

function getLayoutInputId(key, prop) {
  return `layout-${key}-${prop}`;
}

function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
