const submontagemSeriaisApiBaseUrl = '/api/submontagem-seriais';

let registrosNumeroSerieCache = [];
let filtroDebounceTimer = null;

const refs = {
  mensagem: document.getElementById('historico-seriais-mensagem'),
  voltar: document.getElementById('historico-seriais-voltar'),
  filtros: document.getElementById('historico-seriais-filtros'),
  numero: document.getElementById('historico-seriais-numero'),
  modelo: document.getElementById('historico-seriais-modelo'),
  montador: document.getElementById('historico-seriais-montador'),
  clientePedido: document.getElementById('historico-seriais-cliente-pedido'),
  data: document.getElementById('historico-seriais-data'),
  situacao: document.getElementById('historico-seriais-situacao'),
  limpar: document.getElementById('historico-seriais-limpar'),
  total: document.getElementById('historico-seriais-total'),
  cardRegistros: document.getElementById('historico-seriais-card-registros'),
  cardDisponiveis: document.getElementById('historico-seriais-card-disponiveis'),
  cardSaidas: document.getElementById('historico-seriais-card-saidas'),
  tbody: document.getElementById('historico-seriais-tbody')
};

document.addEventListener('DOMContentLoaded', () => {
  configurarVoltar();
  bindEvents();
  carregarRegistrosNumeroSerie();
});

function bindEvents() {
  refs.filtros.addEventListener('submit', (event) => {
    event.preventDefault();
    renderizarRegistrosNumeroSerie();
  });

  refs.limpar.addEventListener('click', limparFiltros);

  refs.filtros.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', agendarRenderizacao);
    field.addEventListener('change', agendarRenderizacao);
  });
}

function configurarVoltar() {
  const params = new URLSearchParams(window.location.search);
  const origem = params.get('voltar');

  if (origem === 'expedicao') {
    refs.voltar.href = '/pagina-expedicao';
    refs.voltar.querySelector('.btn-label').textContent = 'Voltar para Expedicao';
    return;
  }

  refs.voltar.href = '/pagina-montagem';
  refs.voltar.querySelector('.btn-label').textContent = 'Voltar para Montagem';
}

function agendarRenderizacao() {
  window.clearTimeout(filtroDebounceTimer);
  filtroDebounceTimer = window.setTimeout(renderizarRegistrosNumeroSerie, 200);
}

async function carregarRegistrosNumeroSerie() {
  refs.mensagem.className = 'message hidden';
  refs.mensagem.textContent = '';

  try {
    const response = await fetch(`${submontagemSeriaisApiBaseUrl}?limit=1000`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar os registros de numeros de serie.');
    }

    registrosNumeroSerieCache = Array.isArray(result) ? result : [];
    renderizarRegistrosNumeroSerie();
  } catch (error) {
    registrosNumeroSerieCache = [];
    renderizarRegistrosNumeroSerie();
    refs.mensagem.textContent = error.message;
    refs.mensagem.className = 'message error';
    refs.mensagem.classList.remove('hidden');
  }
}

function limparFiltros() {
  refs.filtros.reset();
  renderizarRegistrosNumeroSerie();
}

function obterRegistrosNumeroSerieFiltrados() {
  const filtroNumero = normalizarBusca(refs.numero.value.trim());
  const filtroModelo = normalizarBusca(refs.modelo.value.trim());
  const filtroMontador = normalizarBusca(refs.montador.value.trim());
  const filtroClientePedido = normalizarBusca(refs.clientePedido.value.trim());
  const filtroData = refs.data.value;
  const filtroSituacao = refs.situacao.value;

  return registrosNumeroSerieCache.filter((registro) => {
    if (filtroNumero && !normalizarBusca(registro.numero_serie).includes(filtroNumero)) {
      return false;
    }

    if (filtroModelo) {
      const textoModelo = normalizarBusca(`${registro.modelo_servo_codigo} ${registro.modelo_servo_descricao}`);
      if (!textoModelo.includes(filtroModelo)) {
        return false;
      }
    }

    if (filtroMontador && !normalizarBusca(registro.montador_nome).includes(filtroMontador)) {
      return false;
    }

    if (filtroClientePedido) {
      const textoClientePedido = normalizarBusca(`${registro.cliente_nome} ${registro.numero_pedido}`);
      if (!textoClientePedido.includes(filtroClientePedido)) {
        return false;
      }
    }

    if (filtroData && normalizeDateToInput(registro.data_montagem) !== filtroData) {
      return false;
    }

    if (filtroSituacao === 'disponivel' && registro.data_saida) {
      return false;
    }

    if (filtroSituacao === 'com_saida' && !registro.data_saida) {
      return false;
    }

    return true;
  });
}

function renderizarRegistrosNumeroSerie() {
  const registros = obterRegistrosNumeroSerieFiltrados();
  const disponiveis = registrosNumeroSerieCache.filter((registro) => !registro.data_saida).length;
  const comSaida = registrosNumeroSerieCache.filter((registro) => registro.data_saida).length;

  refs.cardRegistros.textContent = formatInteger(registrosNumeroSerieCache.length);
  refs.cardDisponiveis.textContent = formatInteger(disponiveis);
  refs.cardSaidas.textContent = formatInteger(comSaida);
  refs.total.textContent = `${registros.length} registro(s) encontrado(s)`;

  if (!registrosNumeroSerieCache.length) {
    refs.tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum numero de serie registrado ainda.</td></tr>';
    return;
  }

  if (!registros.length) {
    refs.tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum registro encontrado com os filtros informados.</td></tr>';
    return;
  }

  refs.tbody.innerHTML = registros.map((registro) => `
    <tr>
      <td class="table-code">${escapeHtml(registro.numero_serie || '-')}</td>
      <td class="table-description">
        ${escapeHtml(registro.modelo_servo_descricao || '-')}
        ${renderizarCodigoModelo(registro)}
      </td>
      <td>${formatDate(registro.data_montagem)}</td>
      <td>${escapeHtml(registro.montador_nome || '-')}</td>
      <td>${renderizarPedido(registro)}</td>
      <td>${formatDate(registro.data_saida)}</td>
    </tr>
  `).join('');
}

function renderizarCodigoModelo(registro) {
  if (!registro.modelo_servo_codigo) {
    return '';
  }

  return `<div class="table-subtext">${escapeHtml(registro.modelo_servo_codigo)}</div>`;
}

function renderizarPedido(registro) {
  if (!registro.numero_pedido) {
    return '-';
  }

  const clienteNome = registro.cliente_nome || 'Sem cliente';
  const href = `/pagina-gerenciamento-pedidos?pedido=${encodeURIComponent(registro.numero_pedido)}`;
  return `
    <a class="table-link" href="${href}">
      ${escapeHtml(clienteNome)}
    </a>
    <div class="table-subtext">${escapeHtml(registro.numero_pedido)}</div>
  `;
}

function normalizarBusca(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const data = new Date(value);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleString('pt-BR');
}

function normalizeDateToInput(value) {
  if (!value) {
    return '';
  }

  const data = new Date(value);
  if (Number.isNaN(data.getTime())) {
    return '';
  }

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
