const LOGO_GFA = '^FO50,0^GFA,3500,3500,35,,:::::::::::001XF8,03YF8,7gF,4Y02,4,,:Y0FE,M01P07FF,M01O01FFE,I07JFL080078,007JFEK01I0C,03KFCK06003,1LF8K0C00602,6Q01800804,4Q03001004,R0700200EM03FFCK03F8I01KFC0FEI0IFL0FE,R0E00400FFEK0JFK07F8I01KFC0FE003IFCJ01FE,L01J01C00981FFEJ03JF8J07FCI01KFC0FE00JFEJ01FF,L01J03C019FCFFEJ03JFCJ07FCI01KFC0FE00KFJ01FF,I07IFJ078033FE7FEJ07JFEJ0FFEI01KFC0FE01KF8I03FF8,003JF31AAF8027JFCJ0FF83FFJ0FFEI01KFC0FE03FE0FFCI03FF8,00JFE7FFCF006IFM0FE00FFI01FFEI01FCK0FE03F803FCI07FF8,07JFEIFDE005FFEM0FC007FI01IFI01FCK0FE03F001FCI07FFC,3KFDIFBE00IFEM0FC007F8001IFI01FCK0FE03FI0FEI07FFC,7OFBC01BFFEM0FC003FI03F3F8001FCK0FE03FI0FCI0FEFE,7PFC01IFEM0FEM03F3F8001FCK0FE03F8M0FCFE,K07KF803JFM0FF8L07F1F8001FCK0FE03FEL01FC7E,K03KF803LFEJ0IFL07F1FC001FCK0FE03FFCK01FC7F,K01KF007LFEJ07IFK07E1FC001FCK0FE01IFCJ01F87F,I07MF007LFEJ03IFEJ0FE0FE001KF00FE00JF8I03F83F8,001MFE00MFCJ01JF8I0FC0FE001KF00FE007IFEI03F03F8,007MFE00MFCK0JFC001FC0FE001KF00FE003JF8007F03FC,03NFE00MF8K03IFE001FC07F001KF00FEI0JF8007F01FC,0OFC01JFP0JF001F807F001KF00FEI03IFC007E01FC,3OFC01IFEQ07FF803F803F801FCK0FEJ01FFE00FE00FE,7OF803IFER0FF803IF7F801F8K0FEK03FE00KFE,7OF803JFR03F807KFC01FCK0FEL0FE01LF,7OF003MFEJ078001FC07KFC01FCK0FE01EI07F01LF,J07KF007MFEI03F8001FC07KFC01FCK0FE07EI07F01LF,J03KF007NFI01FC001FC0LFE01FCK0FE07FI07F03LF8,I0LFE00NFEI01FC001F80LFE01FCK0FE07FI07F03LF8,003LFE00NFEI01FE003F80FEI0FE01FCK0FE07F800FE03F8003F8,00MFC01NFCJ0FF007F81FCI07F01FCK0FE03FC01FE07FI01FC,01MFC01NFCJ0LF01FCI07F01FCK0FE03KFE07FI01FC,07MF803NF8J07KF03F8I07F81FCK0FE01KFC0FFI01FE,1NF803IFEO03JFE03F8I03F81FCK0FE00KF80FEJ0FE,3NF007IFEO01JFC03F8I03F81FCK0FE007JF00FEJ0FE,7NF007JFP0JF007FJ01FC1FCK0FE003IFC01FCJ07F,7MFE00OFEK01FFC007FJ01FC1F8K07CI07FF001FCJ07F,3MFE00PF,I07JFC01OFE,001KF801OFE,007KF803OFE,00LF003OFC,03KFE007OFC,07KFC007OF8,0LF800JFE,3LFI0JFE,7KFE001KF8,7KFC003PFE,3KF8003PFEgR0FJ01I021C381,003IFI07PFEgR0F8I01I06366C3,003FFEI0QFEgR0CC638F180E324C7,00IFC003QFCgR0C4D31F3602326C5,01IF8007QFCgR0C59B1166021E7C9,03IF001RFCgR0CDF9917E02061DF8,07FFC003RF8gR0CD80D16002041838,1IF800MFgY0F8F39F3C021C301,3FFE007MFgY060630E18I082,7FFC03TFE,7YFE,3YFE,07XFE,0YFE,1YFE,3YFC,7YFC,:,::::::::^FS';
const LOGO_GFA_BODY = LOGO_GFA.replace(/^\^FO\d+,\d+/, '');
const ETIQUETA_CATEGORIAS = Object.freeze({
  SERVO_COM_KIT: 'SERVO_COM_KIT',
  SERVO_SEM_KIT: 'SERVO_SEM_KIT',
  ITEM_AVULSO: 'ITEM_AVULSO',
  CAIXA: 'CAIXA'
});
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

function formatDateTime(date = new Date()) {
  const normalizedDate = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(normalizedDate);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dia = byType.day;
  const mes = byType.month;
  const ano = byType.year;
  const hora = byType.hour;
  const minuto = byType.minute;
  const segundo = byType.second;
  const miliSeg = String(normalizedDate.getMilliseconds()).padStart(3, '0');
  return `${dia}/${mes}/${ano} - ${hora}:${minuto}:${segundo}.${miliSeg}`;
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'sim', 'yes'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'nao', 'não', 'no'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function sanitizeZplText(value) {
  return String(value || '')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('^', ' ')
    .replaceAll('~', ' ')
    .trim();
}

function getDefaultLayoutJson() {
  return {
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
  };
}

function getDefaultSemKitLayoutJson() {
  return {
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
  };
}

function getDefaultAvulsaLayoutJson() {
  return {
    logo: { x: 50, y: 0, visible: true },
    titulo: { x: 120, y: 195, font: 30, visible: true },
    divisor_superior: { x: 50, y: 250, width: 700, thickness: 3, visible: true },
    label_aplicacao: { x: 50, y: 280, font: 30, visible: false },
    aplicacao_linha_1: { x: 50, y: 340, font: 30, visible: true },
    aplicacao_linha_2: { x: 50, y: 400, font: 30, visible: true },
    aplicacao_linha_3: { x: 50, y: 450, font: 30, visible: false },
    divisor_inferior: { x: 50, y: 500, width: 700, thickness: 3, visible: true },
    label_numero_serie: { x: 400, y: 550, font: 30, visible: false },
    numero_serie: { x: 400, y: 600, font: 27, visible: false },
    codigo_barras: { x: 280, y: 650, largura: 2, proporcao: 2, altura: 50, visible: false },
    texto_codigo_barras: { x: 320, y: 710, font: 20, visible: false },
    data_hora: { x: 250, y: 750, font: 20, visible: true }
  };
}

function getDefaultCaixaLayoutJson() {
  return {
    logo: { x: 50, y: 0, visible: true },
    titulo: { x: 90, y: 195, font: 32, visible: true },
    divisor_superior: { x: 50, y: 250, width: 700, thickness: 3, visible: true },
    label_aplicacao: { x: 50, y: 280, font: 30, visible: false },
    aplicacao_linha_1: { x: 50, y: 350, font: 30, visible: true },
    aplicacao_linha_2: { x: 50, y: 430, font: 30, visible: true },
    aplicacao_linha_3: { x: 50, y: 470, font: 26, visible: false },
    divisor_inferior: { x: 50, y: 500, width: 700, thickness: 3, visible: true },
    label_numero_serie: { x: 640, y: 170, font: 26, visible: true },
    numero_serie: { x: 400, y: 600, font: 27, visible: false },
    codigo_barras: { x: 280, y: 650, largura: 2, proporcao: 2, altura: 50, visible: false },
    texto_codigo_barras: { x: 320, y: 710, font: 20, visible: false },
    data_hora: { x: 250, y: 750, font: 20, visible: true }
  };
}

function normalizeLayout(layoutJson = {}) {
  const defaults = getDefaultLayoutJson();
  const custom = typeof layoutJson === 'object' && layoutJson !== null ? layoutJson : {};
  const safeX = (value, fallback) => clamp(normalizeInteger(value, fallback), 0, 800);
  const safeY = (value, fallback) => clamp(normalizeInteger(value, fallback), 0, 800);
  const safeFont = (value, fallback) => clamp(normalizeInteger(value, fallback), 10, 80);
  const safeBarcodeHeight = (value, fallback) => clamp(normalizeInteger(value, fallback), 20, 200);
  const safeBarcodeWidth = (value, fallback) => clamp(normalizeInteger(value, fallback), 1, 5);

  return {
    logo: {
      x: safeX(custom.logo?.x, defaults.logo.x),
      y: safeY(custom.logo?.y, defaults.logo.y),
      visible: normalizeBoolean(custom.logo?.visible, defaults.logo.visible)
    },
    titulo: {
      x: safeX(custom.titulo?.x, defaults.titulo.x),
      y: safeY(custom.titulo?.y, defaults.titulo.y),
      font: safeFont(custom.titulo?.font, defaults.titulo.font),
      visible: normalizeBoolean(custom.titulo?.visible, defaults.titulo.visible)
    },
    divisor_superior: {
      x: normalizeInteger(custom.divisor_superior?.x, defaults.divisor_superior.x),
      y: normalizeInteger(custom.divisor_superior?.y, defaults.divisor_superior.y),
      width: normalizeInteger(custom.divisor_superior?.width, defaults.divisor_superior.width),
      thickness: normalizeInteger(custom.divisor_superior?.thickness, defaults.divisor_superior.thickness),
      visible: normalizeBoolean(custom.divisor_superior?.visible, defaults.divisor_superior.visible)
    },
    label_aplicacao: {
      x: safeX(custom.label_aplicacao?.x, defaults.label_aplicacao.x),
      y: safeY(custom.label_aplicacao?.y, defaults.label_aplicacao.y),
      font: safeFont(custom.label_aplicacao?.font, defaults.label_aplicacao.font),
      visible: normalizeBoolean(custom.label_aplicacao?.visible, defaults.label_aplicacao.visible)
    },
    aplicacao_linha_1: {
      x: safeX(custom.aplicacao_linha_1?.x, defaults.aplicacao_linha_1.x),
      y: safeY(custom.aplicacao_linha_1?.y, defaults.aplicacao_linha_1.y),
      font: safeFont(custom.aplicacao_linha_1?.font, defaults.aplicacao_linha_1.font),
      visible: normalizeBoolean(custom.aplicacao_linha_1?.visible, defaults.aplicacao_linha_1.visible)
    },
    aplicacao_linha_2: {
      x: safeX(custom.aplicacao_linha_2?.x, defaults.aplicacao_linha_2.x),
      y: safeY(custom.aplicacao_linha_2?.y, defaults.aplicacao_linha_2.y),
      font: safeFont(custom.aplicacao_linha_2?.font, defaults.aplicacao_linha_2.font),
      visible: normalizeBoolean(custom.aplicacao_linha_2?.visible, defaults.aplicacao_linha_2.visible)
    },
    aplicacao_linha_3: {
      x: safeX(custom.aplicacao_linha_3?.x, defaults.aplicacao_linha_3.x),
      y: safeY(custom.aplicacao_linha_3?.y, defaults.aplicacao_linha_3.y),
      font: safeFont(custom.aplicacao_linha_3?.font, defaults.aplicacao_linha_3.font),
      visible: normalizeBoolean(custom.aplicacao_linha_3?.visible, defaults.aplicacao_linha_3.visible)
    },
    divisor_inferior: {
      x: normalizeInteger(custom.divisor_inferior?.x, defaults.divisor_inferior.x),
      y: normalizeInteger(custom.divisor_inferior?.y, defaults.divisor_inferior.y),
      width: normalizeInteger(custom.divisor_inferior?.width, defaults.divisor_inferior.width),
      thickness: normalizeInteger(custom.divisor_inferior?.thickness, defaults.divisor_inferior.thickness),
      visible: normalizeBoolean(custom.divisor_inferior?.visible, defaults.divisor_inferior.visible)
    },
    label_numero_serie: {
      x: safeX(custom.label_numero_serie?.x, defaults.label_numero_serie.x),
      y: safeY(custom.label_numero_serie?.y, defaults.label_numero_serie.y),
      font: safeFont(custom.label_numero_serie?.font, defaults.label_numero_serie.font),
      visible: normalizeBoolean(custom.label_numero_serie?.visible, defaults.label_numero_serie.visible)
    },
    numero_serie: {
      x: safeX(custom.numero_serie?.x, defaults.numero_serie.x),
      y: safeY(custom.numero_serie?.y, defaults.numero_serie.y),
      font: safeFont(custom.numero_serie?.font, defaults.numero_serie.font),
      visible: normalizeBoolean(custom.numero_serie?.visible, defaults.numero_serie.visible)
    },
    codigo_barras: {
      x: safeX(custom.codigo_barras?.x, defaults.codigo_barras.x),
      y: safeY(custom.codigo_barras?.y, defaults.codigo_barras.y),
      largura: safeBarcodeWidth(custom.codigo_barras?.largura, defaults.codigo_barras.largura),
      proporcao: normalizeInteger(custom.codigo_barras?.proporcao, defaults.codigo_barras.proporcao),
      altura: safeBarcodeHeight(custom.codigo_barras?.altura, defaults.codigo_barras.altura),
      visible: normalizeBoolean(custom.codigo_barras?.visible, defaults.codigo_barras.visible)
    },
    texto_codigo_barras: {
      x: safeX(custom.texto_codigo_barras?.x, defaults.texto_codigo_barras.x),
      y: safeY(custom.texto_codigo_barras?.y, defaults.texto_codigo_barras.y),
      font: safeFont(custom.texto_codigo_barras?.font, defaults.texto_codigo_barras.font),
      visible: normalizeBoolean(custom.texto_codigo_barras?.visible, defaults.texto_codigo_barras.visible)
    },
    data_hora: {
      x: safeX(custom.data_hora?.x, defaults.data_hora.x),
      y: safeY(custom.data_hora?.y, defaults.data_hora.y),
      font: safeFont(custom.data_hora?.font, defaults.data_hora.font),
      visible: normalizeBoolean(custom.data_hora?.visible, defaults.data_hora.visible)
    }
  };
}

function buildBaseLines(layout) {
  const lines = ['^XA'];

  if (layout.logo.visible) {
    lines.push(`^FO${layout.logo.x},${layout.logo.y}${LOGO_GFA_BODY}`);
  }

  if (layout.titulo.visible) {
    lines.push(`^CFB,${layout.titulo.font}`);
  }

  return lines;
}

function appendDivider(lines, dividerLayout) {
  if (!dividerLayout?.visible) {
    return;
  }

  lines.push(`^FO${dividerLayout.x},${dividerLayout.y}^GB${dividerLayout.width},${dividerLayout.thickness},${dividerLayout.thickness}^FS`);
}

function appendText(lines, fontPrefix, layoutNode, text, options = {}) {
  if (!layoutNode?.visible || !text) {
    return;
  }

  const safeText = sanitizeZplText(text);
  if (!safeText) {
    return;
  }

  const fontValue = normalizeInteger(layoutNode.font, 30);
  const x = normalizeInteger(layoutNode.x, 0);
  const y = normalizeInteger(layoutNode.y, 0);

  lines.push(`^${fontPrefix},${fontValue}`);
  if (options.centerWidth && Number.isInteger(options.centerWidth) && options.centerWidth > 0) {
    const fieldWidth = clamp(options.centerWidth, 1, 800);
    const fieldX = clamp(x - Math.round(fieldWidth / 2), 0, 800 - fieldWidth);
    lines.push(`^FO${fieldX},${y}^FB${fieldWidth},1,0,C,0^FD${safeText}^FS`);
    return;
  }

  lines.push(`^FO${x},${y}^FD${safeText}^FS`);
}

function gerarZplServo(etiqueta, dadosImpressao = {}) {
  const layout = normalizeLayout(etiqueta.layout_json);
  const numeroSerie = sanitizeZplText(dadosImpressao.numeroSerie);

  if (!numeroSerie) {
    throw new Error('Numero de serie obrigatorio para gerar o ZPL da etiqueta.');
  }

  const titulo = sanitizeZplText(etiqueta.titulo);
  const aplicacaoLinha1 = sanitizeZplText(etiqueta.aplicacao_linha_1);
  const aplicacaoLinha2 = sanitizeZplText(etiqueta.aplicacao_linha_2);
  const aplicacaoLinha3 = sanitizeZplText(etiqueta.aplicacao_linha_3);
  const codigoBarras = sanitizeZplText(etiqueta.codigo_barras);
  const dataHora = sanitizeZplText(dadosImpressao.dataHora || formatDateTime(new Date()));

  const lines = buildBaseLines(layout);

  if (layout.titulo.visible) {
    lines.push(`^FO${layout.titulo.x},${layout.titulo.y}^FD${titulo}^FS`);
  }

  appendDivider(lines, layout.divisor_superior);
  appendText(lines, 'CFA', layout.label_aplicacao, 'Aplicacao:');
  appendText(lines, 'CFA', layout.aplicacao_linha_1, aplicacaoLinha1);
  appendText(lines, 'CFA', layout.aplicacao_linha_2, aplicacaoLinha2);
  appendText(lines, 'CFA', layout.aplicacao_linha_3, aplicacaoLinha3);
  appendDivider(lines, layout.divisor_inferior);
  appendText(lines, 'CFA', layout.label_numero_serie, 'Numero de Serie', { centerWidth: 420 });
  appendText(lines, 'CFB', layout.numero_serie, numeroSerie, { centerWidth: 420 });

  if (layout.codigo_barras.visible) {
    lines.push(`^BY${layout.codigo_barras.largura},${layout.codigo_barras.proporcao},${layout.codigo_barras.altura}`);
    lines.push(`^FO${layout.codigo_barras.x},${layout.codigo_barras.y}^BCN,${layout.codigo_barras.altura},N,N,N^FD${codigoBarras}^FS`);
  }

  appendText(lines, 'CFA', layout.texto_codigo_barras, codigoBarras);
  appendText(lines, 'CFA', layout.data_hora, dataHora);
  lines.push('^XZ');

  return lines.join('');
}

function gerarZplAvulsa(etiqueta, dadosImpressao = {}) {
  const layout = normalizeLayout(etiqueta.layout_json || getDefaultAvulsaLayoutJson());
  const codigoItem = sanitizeZplText(dadosImpressao.codigoItem || etiqueta.codigo_item);
  const descricao = sanitizeZplText(dadosImpressao.descricao || etiqueta.titulo);
  const quantidade = sanitizeZplText(dadosImpressao.quantidade ?? '1');
  const dataHora = sanitizeZplText(dadosImpressao.dataHora || formatDateTime(new Date()));

  if (!codigoItem) {
    throw new Error('Codigo da peca obrigatorio para a etiqueta avulsa.');
  }

  const lines = buildBaseLines(layout);

  if (layout.titulo.visible) {
    lines.push(`^FO${layout.titulo.x},${layout.titulo.y}^FD${codigoItem}^FS`);
  }

  appendDivider(lines, layout.divisor_superior);
  appendText(lines, 'CFA', layout.aplicacao_linha_1, descricao);
  appendText(lines, 'CFA', layout.aplicacao_linha_2, `QUANTIDADE: ${quantidade}`);
  appendDivider(lines, layout.divisor_inferior);
  appendText(lines, 'CFA', layout.data_hora, dataHora);
  lines.push('^XZ');

  return lines.join('');
}

function gerarZplCaixa(etiqueta, dadosImpressao = {}) {
  const layout = normalizeLayout(etiqueta.layout_json || getDefaultCaixaLayoutJson());
  const clienteNome = sanitizeZplText(dadosImpressao.clienteNome || etiqueta.titulo);
  const numeroNotaFiscal = sanitizeZplText(dadosImpressao.numeroNotaFiscal || '');
  const transportadora = sanitizeZplText(dadosImpressao.transportadora || '');
  const dataHora = sanitizeZplText(dadosImpressao.dataHora || formatDateTime(new Date()));
  const volumeAtual = normalizeInteger(dadosImpressao.volumeAtual, 1);
  const volumeTotal = normalizeInteger(dadosImpressao.volumeTotal, 1);
  const volumeLabel = `${volumeAtual}/${volumeTotal}`;

  if (!clienteNome) {
    throw new Error('Nome do cliente obrigatorio para a etiqueta de caixa.');
  }

  const lines = buildBaseLines(layout);

  if (layout.titulo.visible) {
    lines.push(`^FO${layout.titulo.x},${layout.titulo.y}^FD${clienteNome}^FS`);
  }

  appendText(lines, 'CFA', layout.label_numero_serie, volumeLabel);
  appendDivider(lines, layout.divisor_superior);
  appendText(lines, 'CFA', layout.aplicacao_linha_1, `NF: ${numeroNotaFiscal || '-'}`);
  appendText(lines, 'CFA', layout.aplicacao_linha_2, transportadora || '-');
  appendDivider(lines, layout.divisor_inferior);
  appendText(lines, 'CFA', layout.data_hora, dataHora);
  lines.push('^XZ');

  return lines.join('');
}

function gerarZplEtiqueta(etiqueta, dadosImpressao = {}) {
  if (!etiqueta) {
    throw new Error('Etiqueta nao informada para gerar o ZPL.');
  }

  const categoria = String(etiqueta.categoria || ETIQUETA_CATEGORIAS.SERVO_COM_KIT).trim().toUpperCase();

  if (categoria === ETIQUETA_CATEGORIAS.ITEM_AVULSO) {
    return gerarZplAvulsa(etiqueta, dadosImpressao);
  }

  if (categoria === ETIQUETA_CATEGORIAS.CAIXA) {
    return gerarZplCaixa(etiqueta, dadosImpressao);
  }

  return gerarZplServo(etiqueta, dadosImpressao);
}

module.exports = {
  ETIQUETA_CATEGORIAS,
  getDefaultLayoutJson,
  getDefaultSemKitLayoutJson,
  getDefaultAvulsaLayoutJson,
  getDefaultCaixaLayoutJson,
  normalizeLayout,
  formatDateTime,
  gerarZplEtiqueta,
  gerarZplServo,
  gerarZplAvulsa,
  gerarZplCaixa
};
