const apiBaseUrl = '/api/gerenciamento-servos/matriz';

let escopoAtual = 'global';
let matrizAtual = null;
let celulaGuiaAtual = null;

const refs = {
  mensagem: document.getElementById('ger-servos-mensagem'),
  titulo: document.getElementById('ger-servos-titulo'),
  subtitulo: document.getElementById('ger-servos-subtitulo'),
  resumo: document.getElementById('ger-servos-resumo'),
  tabela: document.getElementById('ger-servos-tabela'),
  thead: document.getElementById('ger-servos-thead'),
  tbody: document.getElementById('ger-servos-tbody'),
  btnDia: document.getElementById('ger-servos-btn-dia'),
  btnGlobal: document.getElementById('ger-servos-btn-global'),
  btnAtualizar: document.getElementById('ger-servos-btn-atualizar'),
  btnImprimir: document.getElementById('ger-servos-btn-imprimir')
};

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  configurarAtualizacaoOperacional();

  try {
    await carregarMatriz();
  } catch (error) {
    mostrarMensagem(error.message || 'Nao foi possivel carregar a planilha.', 'error');
  }
});

function configurarAtualizacaoOperacional() {
  if (!window.SafisaSync?.subscribe) {
    return;
  }

  const recarregar = () => {
    carregarMatriz().catch((error) => {
      mostrarMensagem(error.message || 'Nao foi possivel atualizar a planilha.', 'error');
    });
  };

  ['pedidos-expedicao', 'submontagem-seriais'].forEach((topic) => {
    window.SafisaSync.subscribe(topic, recarregar);
  });
}

function bindEvents() {
  refs.btnDia.addEventListener('click', () => alternarEscopo('dia'));
  refs.btnGlobal.addEventListener('click', () => alternarEscopo('global'));
  refs.btnAtualizar.addEventListener('click', () => carregarMatriz());
  refs.btnImprimir.addEventListener('click', () => window.print());
  refs.tabela.addEventListener('mouseover', atualizarGuiaLeitura);
  refs.tabela.addEventListener('mouseleave', limparGuiaLeitura);
}

function atualizarGuiaLeitura(event) {
  const celula = event.target.closest('th, td');
  if (!celula || !refs.tabela.contains(celula) || celula.classList.contains('empty-state')) {
    limparGuiaLeitura();
    return;
  }

  if (celulaGuiaAtual === celula) {
    return;
  }

  limparGuiaLeitura();
  celulaGuiaAtual = celula;
  const indiceColuna = celula.cellIndex;

  Array.from(celula.parentElement.cells).forEach((item) => {
    item.classList.add('servo-sheet-guide-row');
  });

  Array.from(refs.tabela.rows).forEach((linha) => {
    const item = linha.cells[indiceColuna];
    if (item && Number(item.colSpan || 1) === 1) {
      item.classList.add('servo-sheet-guide-column');
    }
  });

  celula.classList.add('servo-sheet-guide-intersection');
}

function limparGuiaLeitura() {
  refs.tabela.querySelectorAll('.servo-sheet-guide-row, .servo-sheet-guide-column, .servo-sheet-guide-intersection')
    .forEach((celula) => {
      celula.classList.remove('servo-sheet-guide-row', 'servo-sheet-guide-column', 'servo-sheet-guide-intersection');
    });
  celulaGuiaAtual = null;
}

async function alternarEscopo(escopo) {
  if (escopoAtual === escopo) {
    return;
  }

  escopoAtual = escopo;
  atualizarBotoesEscopo();
  await carregarMatriz();
}

function atualizarBotoesEscopo() {
  refs.btnDia.classList.toggle('is-active', escopoAtual === 'dia');
  refs.btnGlobal.classList.toggle('is-active', escopoAtual === 'global');
}

function mostrarMensagem(texto, tipo = 'info') {
  refs.mensagem.textContent = texto;
  refs.mensagem.className = `message ${tipo}`;
}

function esconderMensagem() {
  refs.mensagem.textContent = '';
  refs.mensagem.className = 'message hidden';
}

async function carregarMatriz() {
  esconderMensagem();
  refs.btnAtualizar.disabled = true;

  try {
    const response = await fetch(`${apiBaseUrl}?escopo=${encodeURIComponent(escopoAtual)}`, {
      credentials: 'same-origin'
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Nao foi possivel carregar a planilha.');
    }

    matrizAtual = data;
    renderizarCabecalho();
    renderizarResumo();
    renderizarTabela();
  } finally {
    refs.btnAtualizar.disabled = false;
  }
}

function renderizarCabecalho() {
  const data = matrizAtual?.data_referencia || '-';
  refs.titulo.textContent = `Consulta de servos - ${escopoAtual === 'dia' ? 'Pedidos do dia' : 'Visao global'}`;
  if (refs.subtitulo) {
    refs.subtitulo.textContent = `Referencia ${data}.`;
  }
}

function renderizarResumo() {
  if (!refs.resumo) {
    return;
  }

  const resumo = matrizAtual?.resumo;
  if (!resumo) {
    refs.resumo.innerHTML = '';
    return;
  }

  const chips = [
    ['Escopo', resumo.escopo === 'dia' ? 'Dia' : 'Global'],
    ['Pedidos', resumo.pedidos],
    ['Modelos', resumo.modelos],
    ['Demanda', formatNumber(resumo.demanda_total)],
    ['Estoque', formatNumber(resumo.estoque_total)],
    ['Corpos', formatNumber(resumo.corpos_total)],
    ['Zinco', formatNumber(resumo.zinco_total)],
    ['Usinagem', formatNumber(resumo.usinagem_total)],
    ['Total final', formatNumber(resumo.saldo_total)]
  ];

  refs.resumo.innerHTML = chips.map(([label, value]) => `
    <span class="summary-chip">
      <small>${label}</small>
      <strong>${value}</strong>
    </span>
  `).join('');
}

function renderizarTabela() {
  const pedidos = matrizAtual?.pedidos || [];
  const rows = matrizAtual?.rows || [];

  refs.thead.innerHTML = `
    <tr>
      <th class="sticky-col servo-sheet-model-col">
        <div class="servo-sheet-model-head">
          <span>MODELO</span>
          <strong>${matrizAtual?.data_referencia || '-'}</strong>
        </div>
      </th>
      <th class="servo-sheet-total-col servo-sheet-head-accent">TOTAL</th>
      ${pedidos.map((pedido) => `
        <th class="servo-sheet-vertical-col" title="${escapeHtml(`${pedido.cliente_nome} | ${pedido.codigo_pedido}`)}">
          <strong>${escapeHtml(pedido.cliente_nome)}</strong>
        </th>
      `).join('')}
      <th class="servo-sheet-resource-col servo-sheet-divider-left"><span>ESTOQUE</span></th>
      <th class="servo-sheet-resource-col"><span>CORPOS</span></th>
      <th class="servo-sheet-resource-col"><span>ZINCO</span></th>
      <th class="servo-sheet-resource-col"><span>USINAGEM</span></th>
      <th class="servo-sheet-resource-col" title="Estoque, Corpos e Zinco menos o total devido; Usinagem nao entra no calculo"><span>TOTAL FINAL</span></th>
    </tr>
  `;

  if (!rows.length) {
    refs.tbody.innerHTML = `<tr><td colspan="${2 + pedidos.length + 5}" class="empty-state">Nenhum modelo encontrado para este escopo.</td></tr>`;
    return;
  }

  const totalPedidos = Object.fromEntries(pedidos.map((pedido) => [String(pedido.id), 0]));
  rows.forEach((row) => {
    pedidos.forEach((pedido) => {
      totalPedidos[String(pedido.id)] += Number(row.pedidos[String(pedido.id)] || 0);
    });
  });

  refs.tbody.innerHTML = `
    ${rows.map((row) => {
      const corpoMarker = row.corpo_compartilhado
        ? `<span class="servo-sheet-body-marker" title="Corpo compartilhado com outro modelo">*</span>`
        : '';

      return `
        <tr class="servo-sheet-row">
          <th class="sticky-col servo-sheet-model-cell">
            <div class="servo-sheet-model-title">${escapeHtml(row.label)}${corpoMarker}</div>
          </th>
          <td class="servo-sheet-total-cell ${Number(row.total || 0) === 0 ? 'is-zero' : ''}">${formatNumberOrEmpty(row.total)}</td>
          ${pedidos.map((pedido) => renderMetricCell(row.pedidos[String(pedido.id)] || 0)).join('')}
          ${renderMetricCell(row.estoque, 'servo-sheet-divider-left')}
          ${renderMetricCell(row.corpos)}
          ${renderMetricCell(row.zinco)}
          ${renderMetricCell(row.usinagem)}
          ${renderSaldoCell(row.saldo_final)}
        </tr>
      `;
    }).join('')}
    <tr class="servo-sheet-total-row">
      <th class="sticky-col servo-sheet-model-cell">TOTAL GERAL</th>
      <td class="servo-sheet-total-cell">${formatNumberOrEmpty(rows.reduce((sum, row) => sum + Number(row.total || 0), 0))}</td>
      ${pedidos.map((pedido) => `<td class="servo-sheet-cell servo-sheet-total-inline">${formatNumberOrEmpty(totalPedidos[String(pedido.id)] || 0)}</td>`).join('')}
      <td class="servo-sheet-cell servo-sheet-divider-left servo-sheet-total-inline">${formatNumberOrEmpty(matrizAtual?.resumo?.estoque_total || 0)}</td>
      <td class="servo-sheet-cell servo-sheet-total-inline">${formatNumberOrEmpty(matrizAtual?.resumo?.corpos_total || 0)}</td>
      <td class="servo-sheet-cell servo-sheet-total-inline">${formatNumberOrEmpty(matrizAtual?.resumo?.zinco_total || 0)}</td>
      <td class="servo-sheet-cell servo-sheet-total-inline">${formatNumberOrEmpty(matrizAtual?.resumo?.usinagem_total || 0)}</td>
      ${renderSaldoCell(matrizAtual?.resumo?.saldo_total, 'servo-sheet-total-inline')}
    </tr>
  `;
}

function renderMetricCell(value, extraClass = '') {
  const number = Number(value || 0);
  const isZero = number === 0;
  return `<td class="servo-sheet-cell ${extraClass} ${isZero ? 'is-zero' : 'is-valued'}">${formatNumberOrEmpty(number)}</td>`;
}

function renderSaldoCell(value, extraClass = '') {
  if (value === null || value === undefined || value === '') {
    return `<td class="servo-sheet-cell servo-sheet-balance-cell ${extraClass} is-empty"></td>`;
  }

  const number = Number(value || 0);
  const signalClass = number < 0 ? 'is-negative' : (number > 0 ? 'is-positive' : 'is-zero');
  return `<td class="servo-sheet-cell servo-sheet-balance-cell ${extraClass} ${signalClass}">${formatNumber(number)}</td>`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) {
    return String(number);
  }

  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatNumberOrEmpty(value) {
  const number = Number(value || 0);
  return number === 0 ? '' : formatNumber(number);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
