const painelApiBaseUrl = '/api/painel/resumo';

const screenConfig = {
  '/pagina-diretoria': {
    kicker: 'Diretoria',
    titulo: 'Dashboard Executivo',
    subtitulo: 'Painel somente leitura com foco em visibilidade, gargalos e tendencia operacional.'
  },
  '/pagina-relatorios': {
    kicker: 'Relatorios',
    titulo: 'Relatorios Operacionais',
    subtitulo: 'Consolidados de estoque, producao, terceirizacao, remessas e solicitacoes internas.'
  }
};

const currentScreen = screenConfig[window.location.pathname] || screenConfig['/pagina-diretoria'];

document.addEventListener('DOMContentLoaded', async () => {
  document.title = `SAFISA | ${currentScreen.titulo}`;
  document.getElementById('painel-kicker').textContent = currentScreen.kicker;
  document.getElementById('painel-titulo').textContent = currentScreen.titulo;
  document.getElementById('painel-subtitulo').textContent = currentScreen.subtitulo;
  document.getElementById('painel-section-pill').textContent = currentScreen.kicker;

  await carregarResumo();
});

async function carregarResumo() {
  try {
    const response = await fetch(painelApiBaseUrl);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel carregar o painel.');
    }

    renderizarIndicadores(result.indicadores);
    renderizarDepositos(result.estoque_por_deposito);
    renderizarRankings(result.estoque_maiores, result.estoque_menores);
    renderizarSaidas(result.saidas_top);
    renderizarMaquinas(result.producao_por_maquina);
    renderizarTratamento(result.tratamento_status);
  } catch (error) {
    const mensagem = document.getElementById('painel-mensagem');
    mensagem.textContent = error.message;
    mensagem.className = 'message error';
    mensagem.classList.remove('hidden');
  }
}

function renderizarIndicadores(indicadores) {
  document.getElementById('painel-card-estoque').textContent = formatInteger(indicadores.estoque.registros);
  document.getElementById('painel-card-sem-nf').textContent = formatInteger(indicadores.remessas_sem_nf.total);
  document.getElementById('painel-card-refugo').textContent = formatInteger(indicadores.producao.total_refugo);

  const grid = document.getElementById('painel-indicadores-grid');
  const cards = [
    ['Quantidade Total em Estoque', formatInteger(indicadores.estoque.quantidade_total)],
    ['Quantidade Total MP', formatDecimal(indicadores.materia_prima.quantidade_total)],
    ['Itens em Terceirizacao', formatInteger(indicadores.terceirizacao.itens_pendentes)],
    ['Qtd Pendente em Terceirizacao', formatDecimal(indicadores.terceirizacao.quantidade_pendente)],
    ['Ordens Finalizadas', formatInteger(indicadores.producao.ordens_finalizadas)],
    ['Quantidade Produzida', formatInteger(indicadores.producao.total_produzido)],
    ['Solicitacoes Abertas', formatInteger(indicadores.solicitacoes.abertas)],
    ['Remessas sem NF', formatInteger(indicadores.remessas_sem_nf.total)]
  ];

  grid.innerHTML = cards.map(([label, value]) => `
    <article class="helper-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join('');
}

function renderizarDepositos(items) {
  const target = document.getElementById('painel-estoque-deposito');
  target.innerHTML = renderBarList(items.map((item) => ({
    label: item.nome,
    value: Number(item.quantidade_total || 0),
    meta: `${formatInteger(item.registros)} registro(s)`
  })));
}

function renderizarRankings(maiores, menores) {
  document.getElementById('painel-maiores').innerHTML = renderBarList(maiores.map((item) => ({
    label: `${item.codigo} - ${item.descricao}`,
    value: Number(item.quantidade || 0),
    meta: item.estoque_nome
  })));

  document.getElementById('painel-menores').innerHTML = renderBarList(menores.map((item) => ({
    label: `${item.codigo} - ${item.descricao}`,
    value: Number(item.quantidade || 0),
    meta: item.estoque_nome
  })));
}

function renderizarSaidas(items) {
  const body = document.getElementById('painel-saidas-body');
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="2" class="empty-state">Sem movimentacoes de saida.</td></tr>';
    return;
  }

  body.innerHTML = items.map((item) => `
    <tr>
      <td class="table-description">${escapeHtml(`${item.codigo} - ${item.descricao}`)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_saida)}</td>
    </tr>
  `).join('');
}

function renderizarMaquinas(items) {
  const body = document.getElementById('painel-maquinas-body');
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="3" class="empty-state">Sem producao finalizada.</td></tr>';
    return;
  }

  body.innerHTML = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.maquina_nome)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_produzida)}</td>
      <td class="table-quantity">${formatInteger(item.quantidade_refugo)}</td>
    </tr>
  `).join('');
}

function renderizarTratamento(items) {
  const body = document.getElementById('painel-tratamento-body');
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="3" class="empty-state">Sem registros de terceirizacao.</td></tr>';
    return;
  }

  body.innerHTML = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.status)}</td>
      <td class="table-quantity">${formatInteger(item.total_itens)}</td>
      <td class="table-quantity">${formatDecimal(item.quantidade_pendente)}</td>
    </tr>
  `).join('');
}

function renderBarList(items) {
  if (!items.length) {
    return '<div class="empty-state">Sem dados suficientes para exibir.</div>';
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return items.map((item) => {
    const percentage = Math.max(8, Math.round((item.value / max) * 100));
    return `
      <div class="bar-row">
        <div class="bar-copy">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.meta || '')}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${percentage}%"></div>
        </div>
        <div class="bar-value">${escapeHtml(formatDecimal(item.value))}</div>
      </div>
    `;
  }).join('');
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
