const kanbanApiUrl = '/api/kanban-estoque';

const kanbanState = {
  categorias: [],
  pecas: [],
  itemDetalhesId: null,
  filtro: '',
  categoriaFiltro: '',
  categoriasOrdenadas: new Set(),
  faltasExpedicao: { total_pedidos: 0, total_pendencias: 0, quantidade_faltante: 0, resumo_faltantes: [], pedidos: [] }
};

const kanbanRefs = {};

document.addEventListener('DOMContentLoaded', async () => {
  Object.assign(kanbanRefs, {
    board: document.getElementById('kanban-board'),
    mensagem: document.getElementById('kanban-mensagem'),
    busca: document.getElementById('kanban-busca'),
    categoriaFiltro: document.getElementById('kanban-filtro-categoria'),
    categoriaModal: document.getElementById('kanban-categoria-modal'),
    categoriaForm: document.getElementById('kanban-categoria-form'),
    categoriaId: document.getElementById('kanban-categoria-id'),
    categoriaNome: document.getElementById('kanban-categoria-nome'),
    categoriaTitulo: document.getElementById('kanban-categoria-modal-titulo'),
    categoriaMensagem: document.getElementById('kanban-categoria-mensagem'),
    itemModal: document.getElementById('kanban-item-modal'),
    itemForm: document.getElementById('kanban-item-form'),
    itemId: document.getElementById('kanban-item-id'),
    itemCategoria: document.getElementById('kanban-item-categoria'),
    itemPacote: document.getElementById('kanban-item-pacote'),
    itemPacoteHint: document.getElementById('kanban-item-pacote-hint'),
    itemPeca: document.getElementById('kanban-item-peca'),
    itemPecaSugestoes: document.getElementById('kanban-item-peca-sugestoes'),
    itemSelecionado: document.getElementById('kanban-item-selecionado'),
    itemBuscaPeca: document.getElementById('kanban-item-busca-peca'),
    itemTitulo: document.getElementById('kanban-item-modal-titulo'),
    itemMensagem: document.getElementById('kanban-item-mensagem'),
    detalhesModal: document.getElementById('kanban-detalhes-modal'),
    detalhesDialog: document.getElementById('kanban-detalhes-dialog'),
    faltasModal: document.getElementById('kanban-faltas-modal'),
    faltasConteudo: document.getElementById('kanban-faltas-conteudo')
  });

  bindKanbanEvents();

  try {
    await Promise.all([carregarKanban(), carregarPecas(), carregarFaltasExpedicao()]);
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
});

function bindKanbanEvents() {
  document.getElementById('btn-kanban-nova-categoria').addEventListener('click', () => abrirCategoriaModal());
  document.getElementById('btn-kanban-atualizar').addEventListener('click', atualizarKanban);
  document.getElementById('btn-kanban-faltas').addEventListener('click', abrirFaltasModal);
  document.getElementById('btn-fechar-kanban-categoria').addEventListener('click', () => fecharModal(kanbanRefs.categoriaModal));
  document.getElementById('btn-cancelar-kanban-categoria').addEventListener('click', () => fecharModal(kanbanRefs.categoriaModal));
  document.getElementById('btn-fechar-kanban-item').addEventListener('click', () => fecharModal(kanbanRefs.itemModal));
  document.getElementById('btn-cancelar-kanban-item').addEventListener('click', () => fecharModal(kanbanRefs.itemModal));
  document.getElementById('btn-fechar-kanban-detalhes').addEventListener('click', fecharDetalhesModal);
  document.getElementById('btn-cancelar-kanban-detalhes').addEventListener('click', fecharDetalhesModal);
  document.getElementById('btn-kanban-editar-item').addEventListener('click', editarItemAtual);
  document.getElementById('btn-kanban-excluir-item').addEventListener('click', excluirItemAtual);
  document.getElementById('btn-fechar-kanban-faltas').addEventListener('click', () => fecharModal(kanbanRefs.faltasModal));

  kanbanRefs.categoriaForm.addEventListener('submit', salvarCategoria);
  kanbanRefs.itemForm.addEventListener('submit', salvarItem);
  kanbanRefs.itemBuscaPeca.addEventListener('input', handleBuscaPecaInput);
  kanbanRefs.itemBuscaPeca.addEventListener('keydown', handleBuscaPecaKeydown);
  kanbanRefs.itemPecaSugestoes.addEventListener('click', handleSugestaoPecaClick);
  kanbanRefs.itemCategoria.addEventListener('change', () => {
    limparPecaSelecionada(false);
    renderPecasSelect();
  });
  document.getElementById('btn-limpar-kanban-item').addEventListener('click', () => limparPecaSelecionada(true));
  kanbanRefs.busca.addEventListener('input', () => {
    kanbanState.filtro = normalizarTexto(kanbanRefs.busca.value);
    renderKanban();
  });
  kanbanRefs.categoriaFiltro.addEventListener('change', () => {
    kanbanState.categoriaFiltro = kanbanRefs.categoriaFiltro.value;
    renderKanban();
  });
  kanbanRefs.board.addEventListener('click', handleBoardClick);

  document.querySelectorAll('[data-close-kanban-modal]').forEach((backdrop) => {
    backdrop.addEventListener('click', () => {
      const modalName = backdrop.dataset.closeKanbanModal;
      if (modalName === 'categoria') fecharModal(kanbanRefs.categoriaModal);
      if (modalName === 'item') fecharModal(kanbanRefs.itemModal);
      if (modalName === 'detalhes') fecharDetalhesModal();
      if (modalName === 'faltas') fecharModal(kanbanRefs.faltasModal);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    [kanbanRefs.categoriaModal, kanbanRefs.itemModal, kanbanRefs.detalhesModal, kanbanRefs.faltasModal]
      .filter((modal) => modal && !modal.classList.contains('hidden'))
      .forEach((modal) => fecharModal(modal));
  });
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir a operação.');
  return result;
}

async function carregarKanban() {
  const result = await apiRequest(kanbanApiUrl);
  kanbanState.categorias = Array.isArray(result.categorias) ? result.categorias : [];
  renderFiltroCategorias();
  renderKanban();
  renderCategoriasSelect();
}

async function carregarPecas() {
  kanbanState.pecas = await apiRequest(`${kanbanApiUrl}/pecas`);
  renderPecasSelect();
}

async function carregarFaltasExpedicao() {
  const result = await apiRequest(`${kanbanApiUrl}/faltas-expedicao`);
  kanbanState.faltasExpedicao = {
    total_pedidos: Number(result.total_pedidos || 0),
    total_pendencias: Number(result.total_pendencias || 0),
    quantidade_faltante: Number(result.quantidade_faltante || 0),
    resumo_faltantes: Array.isArray(result.resumo_faltantes) ? result.resumo_faltantes : [],
    pedidos: Array.isArray(result.pedidos) ? result.pedidos : []
  };
  renderFaltasExpedicao();
  atualizarBadgeFaltas();
}

async function atualizarKanban() {
  const button = document.getElementById('btn-kanban-atualizar');
  button.disabled = true;
  button.classList.add('is-loading');
  button.title = 'Atualizando saldos...';
  try {
    await Promise.all([carregarKanban(), carregarFaltasExpedicao()]);
    mostrarMensagem('Saldos e indicadores atualizados.', 'success');
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.title = 'Atualizar saldos';
  }
}

async function abrirFaltasModal() {
  abrirModal(kanbanRefs.faltasModal);
  kanbanRefs.faltasConteudo.innerHTML = '<div class="kanban-stock-loading">Atualizando as pendências da Expedição...</div>';
  try {
    await carregarFaltasExpedicao();
  } catch (error) {
    kanbanRefs.faltasConteudo.innerHTML = `<div class="message error">${escapeHtml(error.message)}</div>`;
  }
}

function atualizarBadgeFaltas() {
  const badge = document.getElementById('kanban-faltas-badge');
  const total = Number(kanbanState.faltasExpedicao.total_pendencias || 0);
  badge.textContent = formatarNumero(total);
  badge.classList.toggle('hidden', total <= 0);
  const button = document.getElementById('btn-kanban-faltas');
  button.title = total > 0
    ? `${total} pendência(s) em pedidos da Expedição`
    : 'Nenhuma peça faltante na Expedição';
}

function renderFaltasExpedicao() {
  const resumo = kanbanState.faltasExpedicao;
  document.getElementById('kanban-faltas-total-pedidos').textContent = formatarNumero(resumo.total_pedidos);
  document.getElementById('kanban-faltas-total-pendencias').textContent = formatarNumero(resumo.total_pendencias);
  document.getElementById('kanban-faltas-total-quantidade').textContent = formatarNumero(resumo.quantidade_faltante);

  if (!resumo.pedidos.length) {
    kanbanRefs.faltasConteudo.innerHTML = `
      <div class="kanban-shortages-empty">
        <strong>Nenhuma peça faltante agora</strong>
        <span>Todos os pedidos abertos podem ser atendidos com a disponibilidade atual.</span>
      </div>
    `;
    return;
  }

  kanbanRefs.faltasConteudo.innerHTML = `
    <section class="kanban-shortages-report">
      <div class="kanban-shortages-section-heading">
        <div>
          <span class="section-pill">Resumo geral</span>
          <h3>Peças realmente faltantes</h3>
          <p>Quantidades somadas por código em todos os pedidos abertos.</p>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Quantidade faltante</th>
              <th>Pedidos afetados</th>
            </tr>
          </thead>
          <tbody>
            ${resumo.resumo_faltantes.map((item) => `
              <tr>
                <td class="table-code">${escapeHtml(item.codigo)}</td>
                <td>${escapeHtml(item.descricao || '-')}</td>
                <td><strong class="kanban-shortage-value">${formatarNumero(item.quantidade_faltante)}</strong></td>
                <td>${formatarNumero(item.pedidos_afetados)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <div class="kanban-shortages-explanation">
      <strong>Como interpretar:</strong>
      <span>“Falta” no pedido indica quantos produtos ou servos não podem ser concluídos. Os códigos em “Peças/componentes ausentes” são o material realmente necessário e entram no resumo geral acima.</span>
    </div>

    <section class="kanban-shortages-orders">
      <div class="kanban-shortages-section-heading">
        <div>
          <span class="section-pill">Por pedido</span>
          <h3>Pedidos afetados</h3>
          <p>Clique em um pedido para visualizar os detalhes.</p>
        </div>
      </div>
      ${resumo.pedidos.map((pedido) => `
        <details class="kanban-shortage-order">
          <summary>
            <div>
              <span class="section-pill">Pedido ${escapeHtml(pedido.codigo_pedido || String(pedido.id))}</span>
              <h3>${escapeHtml(pedido.cliente_nome || 'Cliente não informado')}</h3>
              <p>${escapeHtml(pedido.cidade || '-')} · ${escapeHtml(pedido.status || '-')} · ${formatarDataKanban(pedido.data_pedido)}</p>
            </div>
            <div class="kanban-shortage-order-summary-actions">
              <strong class="kanban-shortage-count">${formatarNumero(pedido.faltantes.length)} falta(s)</strong>
              <span class="kanban-shortage-chevron" aria-hidden="true">⌄</span>
            </div>
          </summary>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Produto/servo</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Disponível</th>
                  <th>Não atendido</th>
                  <th>Peças/componentes ausentes</th>
                </tr>
              </thead>
              <tbody>
                ${pedido.faltantes.map((item) => `
                  <tr>
                    <td class="table-code">${escapeHtml(item.codigo)}</td>
                    <td>${escapeHtml(item.descricao)}</td>
                    <td>${escapeHtml(item.tipo === 'NUMERO_SERIE' ? 'Número de série' : 'Avulso')}</td>
                    <td>${formatarNumero(item.quantidade_disponivel)}</td>
                    <td><strong class="kanban-shortage-value">${formatarNumero(item.quantidade_faltante)}</strong></td>
                    <td>${renderDetalheFalta(item)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </details>
      `).join('')}
    </section>
  `;
}

function renderDetalheFalta(item) {
  const componentes = Array.isArray(item.componentes_faltantes) ? item.componentes_faltantes : [];
  if (!componentes.length) {
    return `
      <div class="kanban-shortage-detail">
        <span>A própria peça <strong>${escapeHtml(item.codigo)}</strong> está faltando.</span>
        <div class="kanban-shortage-components">
          <span>${escapeHtml(item.codigo)} <strong>−${formatarNumero(item.quantidade_faltante)}</strong></span>
        </div>
      </div>
    `;
  }
  return `
    <div class="kanban-shortage-detail">
      <span>Para concluir ${formatarNumero(item.quantidade_faltante)} unidade(s) de <strong>${escapeHtml(item.codigo)}</strong>:</span>
      <div class="kanban-shortage-components">
        ${componentes.map((componente) => `
          <span title="${escapeHtml(componente.descricao || componente.codigo)}">
            ${escapeHtml(componente.codigo)} <strong>−${formatarNumero(componente.quantidade_faltante)}</strong>
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function formatarDataKanban(value) {
  if (!value) return '-';
  const dateOnly = String(value).slice(0, 10);
  const [year, month, day] = dateOnly.split('-');
  return year && month && day ? `${day}/${month}/${year}` : escapeHtml(String(value));
}

function renderKanban() {
  const categorias = kanbanState.categorias;
  const todosItens = categorias.flatMap((categoria) => categoria.itens || []);
  document.getElementById('kanban-metrica-categorias').textContent = formatarNumero(categorias.length);
  document.getElementById('kanban-metrica-pecas').textContent = formatarNumero(todosItens.length);
  document.getElementById('kanban-metrica-zeradas').textContent = formatarNumero(
    todosItens.filter((item) => Number(item.quantidade_almoxarifado) <= 0).length
  );
  document.getElementById('kanban-metrica-criticas').textContent = formatarNumero(
    todosItens.filter((item) => Number(item.quantidade_almoxarifado) > 0
      && Number(item.quantidade_almoxarifado) <= Number(item.quantidade_pacote)).length
  );

  if (!categorias.length) {
    kanbanRefs.board.innerHTML = `
      <div class="kanban-stock-empty-board">
        <span class="section-pill">Comece por aqui</span>
        <h2>Crie a primeira categoria</h2>
        <p>Depois adicione as peças que deseja acompanhar visualmente.</p>
        <button class="btn btn-primary" type="button" data-action="nova-categoria">+ Criar categoria</button>
      </div>
    `;
    return;
  }

  const html = categorias.map((categoria) => renderCategoria(categoria)).filter(Boolean).join('');
  kanbanRefs.board.innerHTML = html || `
    <div class="kanban-stock-empty-board">
      <h2>Nenhum resultado encontrado</h2>
      <p>Altere a busca para visualizar os cards.</p>
    </div>
  `;
}

function renderFiltroCategorias() {
  const current = String(kanbanState.categoriaFiltro || '');
  const categoriaExiste = kanbanState.categorias.some((categoria) => String(categoria.id) === current);
  if (current && !categoriaExiste) {
    kanbanState.categoriaFiltro = '';
  }

  kanbanRefs.categoriaFiltro.innerHTML = `
    <option value="">Todas</option>
    ${kanbanState.categorias.map((categoria) => `
      <option value="${categoria.id}" ${String(categoria.id) === String(kanbanState.categoriaFiltro) ? 'selected' : ''}>${escapeHtml(categoria.nome)}</option>
    `).join('')}
  `;
}

function renderCategoria(categoria) {
  if (kanbanState.categoriaFiltro && String(categoria.id) !== String(kanbanState.categoriaFiltro)) {
    return '';
  }

  let itens = (categoria.itens || []).filter((item) => itemCombinaFiltro(item, categoria));
  const ordenarPorCor = kanbanState.categoriasOrdenadas.has(Number(categoria.id));
  if (ordenarPorCor) {
    itens = [...itens].sort((a, b) => {
      const prioridade = obterPrioridadeCor(a) - obterPrioridadeCor(b);
      if (prioridade !== 0) return prioridade;
      return String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR', { numeric: true });
    });
  }
  const categoriaCombina = normalizarTexto(categoria.nome).includes(kanbanState.filtro);
  if (kanbanState.filtro && !categoriaCombina && !itens.length) return '';

  return `
    <article class="kanban-stock-category">
      <header class="kanban-stock-category-header">
        <div>
          <span class="section-pill">Categoria</span>
          <h2>${escapeHtml(categoria.nome)}</h2>
          <p>${formatarNumero(itens.length)} peça(s) visível(is)</p>
        </div>
        <div class="kanban-stock-category-actions">
          <button class="btn btn-small btn-secondary" type="button" data-action="adicionar-item" data-category-id="${categoria.id}">+ Peça</button>
          <button class="icon-btn kanban-sort-icon ${ordenarPorCor ? 'is-active' : ''}" type="button" title="${ordenarPorCor ? 'Voltar à ordem normal' : 'Ordenar por cor: roxo, vermelho, amarelo e verde'}" aria-label="${ordenarPorCor ? 'Voltar à ordem normal' : 'Ordenar cards por cor'}" aria-pressed="${ordenarPorCor}" data-action="ordenar-categoria" data-category-id="${categoria.id}">⇅</button>
          <button class="icon-btn" type="button" title="Editar categoria" aria-label="Editar categoria" data-action="editar-categoria" data-category-id="${categoria.id}">✎</button>
          <button class="icon-btn kanban-delete-icon" type="button" title="Excluir categoria" aria-label="Excluir categoria" data-action="excluir-categoria" data-category-id="${categoria.id}">×</button>
        </div>
      </header>
      <div class="kanban-stock-cards">
        ${itens.length ? itens.map((item) => renderCard(item)).join('') : `
          <button class="kanban-stock-add-card" type="button" data-action="adicionar-item" data-category-id="${categoria.id}">
            <strong>+ Adicionar peça</strong>
            <span>Escolha um item do cadastro SAFISA.</span>
          </button>
        `}
      </div>
    </article>
  `;
}

function renderCard(item) {
  const quantidade = Number(item.quantidade_almoxarifado) || 0;
  const pacote = Number(item.quantidade_pacote) || 1;
  const color = obterFaixaCor(quantidade, pacote);
  const pacotes = quantidade / pacote;
  return `
    <button class="kanban-stock-card ${color.className}" type="button" data-action="detalhes-item" data-item-id="${item.id}">
      <strong class="kanban-stock-card-code">${escapeHtml(item.codigo)}</strong>
      <span class="kanban-stock-card-description">${escapeHtml(item.descricao)}</span>
      <span class="kanban-stock-card-quantity">${formatarNumero(quantidade)} <small>peças</small></span>
      <span class="kanban-stock-card-packages">${formatarDecimal(pacotes)} pacote(s) de ${formatarNumero(pacote)}</span>
    </button>
  `;
}

function handleBoardClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const categoryId = Number(button.dataset.categoryId);
  const itemId = Number(button.dataset.itemId);

  if (action === 'nova-categoria') abrirCategoriaModal();
  if (action === 'adicionar-item') abrirItemModal(null, categoryId);
  if (action === 'ordenar-categoria') alternarOrdenacaoCategoria(categoryId);
  if (action === 'editar-categoria') abrirCategoriaModal(categoryId);
  if (action === 'excluir-categoria') excluirCategoria(categoryId);
  if (action === 'detalhes-item') abrirDetalhesModal(itemId);
}

function alternarOrdenacaoCategoria(categoryId) {
  const id = Number(categoryId);
  if (kanbanState.categoriasOrdenadas.has(id)) {
    kanbanState.categoriasOrdenadas.delete(id);
  } else {
    kanbanState.categoriasOrdenadas.add(id);
  }
  renderKanban();
}

function obterPrioridadeCor(item) {
  const quantidade = Number(item.quantidade_almoxarifado) || 0;
  const pacote = Number(item.quantidade_pacote) || 1;
  if (quantidade <= 0) return 0;
  if (quantidade <= pacote) return 1;
  if (quantidade <= pacote * 2) return 2;
  return 3;
}

function abrirCategoriaModal(id = null) {
  const categoria = id ? kanbanState.categorias.find((item) => Number(item.id) === Number(id)) : null;
  kanbanRefs.categoriaForm.reset();
  kanbanRefs.categoriaId.value = categoria?.id || '';
  kanbanRefs.categoriaNome.value = categoria?.nome || '';
  kanbanRefs.categoriaTitulo.textContent = categoria ? 'Editar categoria' : 'Nova categoria';
  limparMensagem(kanbanRefs.categoriaMensagem);
  abrirModal(kanbanRefs.categoriaModal);
  kanbanRefs.categoriaNome.focus();
}

async function salvarCategoria(event) {
  event.preventDefault();
  const id = Number(kanbanRefs.categoriaId.value) || null;
  const submit = kanbanRefs.categoriaForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await apiRequest(id ? `${kanbanApiUrl}/categorias/${id}` : `${kanbanApiUrl}/categorias`, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ nome: kanbanRefs.categoriaNome.value.trim() })
    });
    fecharModal(kanbanRefs.categoriaModal);
    await carregarKanban();
    mostrarMensagem(id ? 'Categoria atualizada.' : 'Categoria criada.', 'success');
  } catch (error) {
    mostrarMensagemModal(kanbanRefs.categoriaMensagem, error.message);
  } finally {
    submit.disabled = false;
  }
}

async function excluirCategoria(id) {
  const categoria = kanbanState.categorias.find((item) => Number(item.id) === Number(id));
  if (!categoria) return;
  const total = (categoria.itens || []).length;
  const complemento = total ? ` e seus ${total} card(s)` : '';
  if (!window.confirm(`Excluir a categoria "${categoria.nome}"${complemento}? Os saldos das peças não serão alterados.`)) return;

  try {
    await apiRequest(`${kanbanApiUrl}/categorias/${id}`, { method: 'DELETE' });
    await carregarKanban();
    mostrarMensagem('Categoria removida do Kanban.', 'success');
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function abrirItemModal(item = null, categoryId = null) {
  if (!kanbanState.categorias.length) {
    mostrarMensagem('Crie uma categoria antes de adicionar peças.', 'error');
    abrirCategoriaModal();
    return;
  }

  kanbanRefs.itemForm.reset();
  kanbanRefs.itemId.value = item?.id || '';
  kanbanRefs.itemPacote.value = item ? Number(item.quantidade_pacote) : '';
  kanbanRefs.itemBuscaPeca.value = '';
  kanbanRefs.itemTitulo.textContent = item ? 'Editar peça monitorada' : 'Adicionar peça';
  document.getElementById('btn-salvar-kanban-item').textContent = item ? 'Salvar alteração' : 'Adicionar peça';
  renderCategoriasSelect(item?.id_categoria || categoryId);
  limparPecaSelecionada(false);
  if (item) {
    selecionarPeca(item.id_peca);
  } else {
    renderPecasSelect();
  }
  limparMensagem(kanbanRefs.itemMensagem);
  abrirModal(kanbanRefs.itemModal);
  kanbanRefs.itemBuscaPeca.focus();
}

function renderCategoriasSelect(selectedId = null) {
  if (!kanbanRefs.itemCategoria) return;
  const current = selectedId || kanbanRefs.itemCategoria.value;
  kanbanRefs.itemCategoria.innerHTML = kanbanState.categorias.map((categoria) => `
    <option value="${categoria.id}" ${Number(categoria.id) === Number(current) ? 'selected' : ''}>${escapeHtml(categoria.nome)}</option>
  `).join('');
}

function renderPecasSelect(selectedId = null) {
  if (!kanbanRefs.itemPecaSugestoes) return;
  if (selectedId) {
    selecionarPeca(selectedId);
    return;
  }

  const filtro = normalizarTexto(kanbanRefs.itemBuscaPeca?.value || '');
  if (filtro.length < 1 || kanbanRefs.itemPeca.value) {
    kanbanRefs.itemPecaSugestoes.classList.add('hidden');
    kanbanRefs.itemPecaSugestoes.innerHTML = '';
    return;
  }

  const categoriaId = Number(kanbanRefs.itemCategoria.value);
  const itemEditadoId = Number(kanbanRefs.itemId.value);
  const categoria = kanbanState.categorias.find((entry) => Number(entry.id) === categoriaId);
  const idsJaAdicionados = new Set((categoria?.itens || [])
    .filter((entry) => Number(entry.id) !== itemEditadoId)
    .map((entry) => Number(entry.id_peca)));
  const pecas = kanbanState.pecas
    .filter((peca) => !idsJaAdicionados.has(Number(peca.id)))
    .filter((peca) => normalizarTexto(`${peca.codigo} ${peca.descricao}`).includes(filtro))
    .slice(0, 12);

  kanbanRefs.itemPecaSugestoes.innerHTML = pecas.length
    ? pecas.map((peca) => `
        <button type="button" data-piece-id="${peca.id}">
          <strong>${escapeHtml(peca.codigo)}</strong>
          <span>${escapeHtml(peca.descricao)}</span>
        </button>
      `).join('')
    : '<div class="kanban-piece-no-result">Nenhuma peça disponível encontrada.</div>';
  kanbanRefs.itemPecaSugestoes.classList.remove('hidden');
}

function handleBuscaPecaInput() {
  kanbanRefs.itemPeca.value = '';
  kanbanRefs.itemSelecionado.classList.add('hidden');
  renderPecasSelect();
}

function handleBuscaPecaKeydown(event) {
  if (event.key !== 'Enter' || kanbanRefs.itemPeca.value) return;
  const firstSuggestion = kanbanRefs.itemPecaSugestoes.querySelector('[data-piece-id]');
  if (!firstSuggestion) return;
  event.preventDefault();
  selecionarPeca(firstSuggestion.dataset.pieceId);
}

function handleSugestaoPecaClick(event) {
  const button = event.target.closest('[data-piece-id]');
  if (!button) return;
  selecionarPeca(button.dataset.pieceId);
}

function selecionarPeca(id) {
  const peca = kanbanState.pecas.find((entry) => Number(entry.id) === Number(id));
  if (!peca) return;
  kanbanRefs.itemPeca.value = String(peca.id);
  kanbanRefs.itemBuscaPeca.value = `${peca.codigo} — ${peca.descricao}`;
  document.getElementById('kanban-item-selecionado-codigo').textContent = peca.codigo;
  document.getElementById('kanban-item-selecionado-descricao').textContent = peca.descricao;
  kanbanRefs.itemSelecionado.classList.remove('hidden');
  kanbanRefs.itemPecaSugestoes.classList.add('hidden');
  const pacoteCadastro = Number(peca.quantidade_pacote || 0);
  if (!Number(kanbanRefs.itemId.value)) {
    kanbanRefs.itemPacote.value = pacoteCadastro > 0 ? pacoteCadastro : '';
  }
  atualizarPacoteCadastroHint(peca);
}

function limparPecaSelecionada(focus = false) {
  kanbanRefs.itemPeca.value = '';
  kanbanRefs.itemBuscaPeca.value = '';
  kanbanRefs.itemSelecionado.classList.add('hidden');
  kanbanRefs.itemPecaSugestoes.classList.add('hidden');
  kanbanRefs.itemPecaSugestoes.innerHTML = '';
  if (!Number(kanbanRefs.itemId.value)) {
    kanbanRefs.itemPacote.value = '';
    kanbanRefs.itemPacoteHint.textContent = 'Selecione uma peça para carregar o valor do cadastro.';
  }
  if (focus) kanbanRefs.itemBuscaPeca.focus();
}

function atualizarPacoteCadastroHint(peca) {
  const pacoteCadastro = Number(peca?.quantidade_pacote || 0);
  kanbanRefs.itemPacoteHint.textContent = pacoteCadastro > 0
    ? `Valor do cadastro da peça: ${formatarNumero(pacoteCadastro)}.`
    : 'A peça não possui quantidade por pacote cadastrada. Informe o valor para continuar.';
}

async function salvarItem(event) {
  event.preventDefault();
  const id = Number(kanbanRefs.itemId.value) || null;
  const payload = {
    id_categoria: Number(kanbanRefs.itemCategoria.value),
    id_peca: Number(kanbanRefs.itemPeca.value),
    quantidade_pacote: Number(kanbanRefs.itemPacote.value)
  };
  if (!payload.id_peca) {
    mostrarMensagemModal(kanbanRefs.itemMensagem, 'Pesquise e selecione uma peça antes de adicionar.');
    kanbanRefs.itemBuscaPeca.focus();
    return;
  }
  const submit = kanbanRefs.itemForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await apiRequest(id ? `${kanbanApiUrl}/itens/${id}` : `${kanbanApiUrl}/itens`, {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    await carregarKanban();
    if (id) {
      fecharModal(kanbanRefs.itemModal);
      mostrarMensagem('Peça atualizada no Kanban.', 'success');
    } else {
      limparPecaSelecionada(true);
      mostrarMensagemModal(kanbanRefs.itemMensagem, 'Peça adicionada. Pesquise a próxima peça.', 'success');
    }
  } catch (error) {
    mostrarMensagemModal(kanbanRefs.itemMensagem, error.message);
  } finally {
    submit.disabled = false;
  }
}

function localizarItem(id) {
  for (const categoria of kanbanState.categorias) {
    const item = (categoria.itens || []).find((entry) => Number(entry.id) === Number(id));
    if (item) return { item, categoria };
  }
  return null;
}

function abrirDetalhesModal(id) {
  const registro = localizarItem(id);
  if (!registro) return;
  const { item, categoria } = registro;
  kanbanState.itemDetalhesId = Number(item.id);
  const quantidade = Number(item.quantidade_almoxarifado) || 0;
  const pacote = Number(item.quantidade_pacote) || 1;
  const color = obterFaixaCor(quantidade, pacote);
  const duracao = item.duracao_estimada_dias === null || item.duracao_estimada_dias === ''
    ? 'Sem saída cadastrada'
    : `${formatarDecimal(Number(item.duracao_estimada_dias))} dias`;

  document.getElementById('kanban-detalhes-categoria').textContent = categoria.nome;
  document.getElementById('kanban-detalhes-titulo').textContent = item.codigo;
  document.getElementById('kanban-detalhes-descricao').textContent = item.descricao;
  document.getElementById('kanban-detalhes-almox').textContent = `${formatarNumero(quantidade)} peças`;
  document.getElementById('kanban-detalhes-pacotes').textContent = `${formatarDecimal(quantidade / pacote)} pacotes`;
  document.getElementById('kanban-detalhes-montagem').textContent = formatarNumero(item.quantidade_montagem);
  document.getElementById('kanban-detalhes-expedicao').textContent = formatarNumero(item.quantidade_expedicao);
  document.getElementById('kanban-detalhes-producao').textContent = formatarNumero(item.quantidade_producao);
  document.getElementById('kanban-detalhes-producao-info').textContent = `OPs: ${formatarNumero(item.quantidade_producao_ordens)} · fila: ${formatarNumero(item.quantidade_fila_tratamento)}`;
  const tratamentoQuantidade = Number(item.quantidade_tratamento_externo || 0);
  document.getElementById('kanban-detalhes-tratamento').textContent = formatarNumero(tratamentoQuantidade);
  document.getElementById('kanban-detalhes-tratamento-card').classList.toggle('hidden', tratamentoQuantidade <= 0);
  document.getElementById('kanban-detalhes-vendido').textContent = formatarNumero(item.quantidade_pedidos_abertos);
  document.getElementById('kanban-detalhes-duracao').textContent = duracao;
  document.getElementById('kanban-detalhes-duracao-info').textContent = `Saldo disponível: ${formatarNumero(item.quantidade_saldo_disponivel)} · saída/mês: ${formatarNumero(item.consumo_mensal_cadastro)}`;
  document.getElementById('kanban-detalhes-regra').textContent = `Pacote: ${formatarNumero(pacote)} peças · Faixa: ${color.label}`;
  kanbanRefs.detalhesDialog.className = `modal-dialog kanban-stock-details-dialog ${color.className}`;
  abrirModal(kanbanRefs.detalhesModal);
}

function fecharDetalhesModal() {
  kanbanState.itemDetalhesId = null;
  fecharModal(kanbanRefs.detalhesModal);
}

function editarItemAtual() {
  const registro = localizarItem(kanbanState.itemDetalhesId);
  if (!registro) return;
  fecharDetalhesModal();
  abrirItemModal(registro.item);
}

async function excluirItemAtual() {
  const registro = localizarItem(kanbanState.itemDetalhesId);
  if (!registro) return;
  if (!window.confirm(`Remover a peça ${registro.item.codigo} do Kanban? O saldo no estoque não será alterado.`)) return;
  try {
    await apiRequest(`${kanbanApiUrl}/itens/${registro.item.id}`, { method: 'DELETE' });
    fecharDetalhesModal();
    await carregarKanban();
    mostrarMensagem('Peça removida do Kanban.', 'success');
  } catch (error) {
    mostrarMensagem(error.message, 'error');
  }
}

function obterFaixaCor(quantidade, pacote) {
  if (quantidade <= 0) return { className: 'is-purple', label: 'Sem saldo' };
  if (quantidade <= pacote) return { className: 'is-red', label: 'Até 1 pacote' };
  if (quantidade <= pacote * 2) return { className: 'is-yellow', label: 'Até 2 pacotes' };
  return { className: 'is-green', label: 'Acima de 2 pacotes' };
}

function itemCombinaFiltro(item, categoria) {
  if (!kanbanState.filtro) return true;
  return normalizarTexto(`${item.codigo} ${item.descricao} ${categoria.nome}`).includes(kanbanState.filtro);
}

function abrirModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function fecharModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  const hasOpenModal = Array.from(document.querySelectorAll('.modal')).some((item) => !item.classList.contains('hidden'));
  document.body.classList.toggle('has-modal', hasOpenModal);
}

function mostrarMensagem(texto, tipo) {
  kanbanRefs.mensagem.textContent = texto;
  kanbanRefs.mensagem.className = `message ${tipo}`;
  window.clearTimeout(mostrarMensagem.timeoutId);
  mostrarMensagem.timeoutId = window.setTimeout(() => limparMensagem(kanbanRefs.mensagem), 5000);
}

function mostrarMensagemModal(ref, texto, tipo = 'error') {
  ref.textContent = texto;
  ref.className = `message ${tipo}`;
}

function limparMensagem(ref) {
  ref.textContent = '';
  ref.className = 'message hidden';
}

function formatarNumero(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatarDecimal(value) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function normalizarTexto(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
