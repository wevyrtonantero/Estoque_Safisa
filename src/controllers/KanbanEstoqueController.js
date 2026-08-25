const KanbanEstoqueModel = require('../models/KanbanEstoqueModel');
const PedidoExpedicaoModel = require('../models/PedidoExpedicaoModel');
const { recordAuditLog } = require('../audit/auditLogger');

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function databaseError(error, duplicateMessage) {
  if (error?.code === 'ER_DUP_ENTRY') {
    return { status: 409, message: duplicateMessage };
  }
  if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
    return { status: 400, message: 'A categoria ou peça selecionada não existe.' };
  }
  return null;
}

const KanbanEstoqueController = {
  async list(req, res) {
    try {
      const categorias = await KanbanEstoqueModel.listBoard();
      return res.status(200).json({ categorias });
    } catch (error) {
      console.error('Erro ao carregar o Kanban de estoque:', error);
      return res.status(500).json({ message: 'Erro ao carregar o Kanban de estoque.' });
    }
  },

  async listPieces(req, res) {
    try {
      const pecas = await KanbanEstoqueModel.listAvailablePieces();
      return res.status(200).json(pecas);
    } catch (error) {
      console.error('Erro ao listar peças para o Kanban:', error);
      return res.status(500).json({ message: 'Erro ao listar as peças disponíveis.' });
    }
  },

  async listExpeditionShortages(req, res) {
    try {
      const pedidos = await PedidoExpedicaoModel.findAll({ ativos: true });
      const pedidosComFaltas = pedidos
        .filter((pedido) => Array.isArray(pedido.faltantes) && pedido.faltantes.length > 0)
        .map((pedido) => {
          const faltantesAgrupados = new Map();

          pedido.faltantes.forEach((item) => {
            const chave = `${item.tipo || ''}:${item.codigo || ''}`;
            if (!faltantesAgrupados.has(chave)) {
              faltantesAgrupados.set(chave, {
                id_peca: item.id_peca,
                codigo: item.codigo,
                descricao: item.descricao,
                tipo: item.tipo,
                quantidade_solicitada: 0,
                quantidade_disponivel: 0,
                quantidade_faltante: 0,
                componentes: new Map()
              });
            }

            const agrupado = faltantesAgrupados.get(chave);
            agrupado.quantidade_solicitada += Number(item.quantidade_solicitada || 0);
            agrupado.quantidade_disponivel += Number(item.quantidade_disponivel || 0);
            agrupado.quantidade_faltante += Number(item.quantidade_faltante || 0);

            (Array.isArray(item.componentes_faltantes) ? item.componentes_faltantes : [])
              .filter((componente) => Number(componente.quantidade_faltante || 0) > 0)
              .forEach((componente) => {
                const chaveComponente = `${Number(componente.id_peca || 0)}:${componente.codigo || ''}`;
                const atual = agrupado.componentes.get(chaveComponente) || {
                  id_peca: componente.id_peca,
                  codigo: componente.codigo,
                  descricao: componente.descricao,
                  quantidade_faltante: 0
                };
                atual.quantidade_faltante += Number(componente.quantidade_faltante || 0);
                agrupado.componentes.set(chaveComponente, atual);
              });
          });

          const faltantes = Array.from(faltantesAgrupados.values()).map((item) => ({
            id_peca: item.id_peca,
            codigo: item.codigo,
            descricao: item.descricao,
            tipo: item.tipo,
            quantidade_solicitada: Number(item.quantidade_solicitada.toFixed(2)),
            quantidade_disponivel: Number(item.quantidade_disponivel.toFixed(2)),
            quantidade_faltante: Number(item.quantidade_faltante.toFixed(2)),
            mensagem: `Faltam ${Number(item.quantidade_faltante.toFixed(2))} unidade(s) de ${item.codigo}.`,
            componentes_faltantes: Array.from(item.componentes.values()).map((componente) => ({
              ...componente,
              quantidade_faltante: Number(componente.quantidade_faltante.toFixed(2))
            }))
          }));

          return {
            id: pedido.id,
            codigo_pedido: pedido.codigo_pedido,
            cliente_nome: pedido.cliente_nome,
            cidade: pedido.cidade,
            status: pedido.status,
            data_pedido: pedido.data_pedido,
            data_programacao_saida: pedido.data_programacao_saida,
            faltantes
          };
        });

      const resumoMap = new Map();
      pedidosComFaltas.forEach((pedido) => {
        pedido.faltantes.forEach((item) => {
          const faltasReais = item.componentes_faltantes.length
            ? item.componentes_faltantes
            : [{
              id_peca: item.id_peca,
              codigo: item.codigo,
              descricao: item.descricao,
              quantidade_faltante: item.quantidade_faltante
            }];

          faltasReais.forEach((falta) => {
            const chave = `${Number(falta.id_peca || 0)}:${falta.codigo || ''}`;
            const atual = resumoMap.get(chave) || {
              id_peca: falta.id_peca,
              codigo: falta.codigo,
              descricao: falta.descricao,
              quantidade_faltante: 0,
              pedidos: new Set()
            };
            atual.quantidade_faltante += Number(falta.quantidade_faltante || 0);
            atual.pedidos.add(Number(pedido.id));
            resumoMap.set(chave, atual);
          });
        });
      });

      const resumoFaltantes = Array.from(resumoMap.values())
        .map((item) => ({
          id_peca: item.id_peca,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade_faltante: Number(item.quantidade_faltante.toFixed(2)),
          pedidos_afetados: item.pedidos.size
        }))
        .sort((a, b) => b.quantidade_faltante - a.quantidade_faltante
          || String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));

      return res.status(200).json({
        total_pedidos: pedidosComFaltas.length,
        total_pendencias: resumoFaltantes.length,
        quantidade_faltante: Number(resumoFaltantes
          .reduce((total, item) => total + Number(item.quantidade_faltante || 0), 0)
          .toFixed(2)),
        resumo_faltantes: resumoFaltantes,
        pedidos: pedidosComFaltas
      });
    } catch (error) {
      console.error('Erro ao carregar as faltas da Expedição para o Kanban:', error);
      return res.status(500).json({ message: 'Erro ao carregar as peças faltantes da Expedição.' });
    }
  },

  async createCategory(req, res) {
    const nome = String(req.body.nome || '').trim();
    if (!nome || nome.length > 100) {
      return res.status(400).json({ message: 'Informe um nome de categoria com até 100 caracteres.' });
    }

    try {
      const categoria = await KanbanEstoqueModel.createCategory({ nome });
      await recordAuditLog(req, {
        modulo: 'KANBAN_ESTOQUE', acao: 'CRIAR', entidade_tipo: 'CATEGORIA_KANBAN',
        entidade_id: categoria.id, descricao: `Categoria ${categoria.nome} criada no Kanban.`, depois: categoria
      });
      return res.status(201).json(categoria);
    } catch (error) {
      const dbError = databaseError(error, 'Já existe uma categoria com esse nome.');
      if (dbError) return res.status(dbError.status).json({ message: dbError.message });
      console.error('Erro ao criar categoria do Kanban:', error);
      return res.status(500).json({ message: 'Erro ao criar a categoria.' });
    }
  },

  async updateCategory(req, res) {
    const id = parseId(req.params.id);
    const nome = String(req.body.nome || '').trim();
    if (!id || !nome || nome.length > 100) {
      return res.status(400).json({ message: 'Informe uma categoria e um nome válidos.' });
    }

    try {
      const antes = await KanbanEstoqueModel.findCategoryById(id);
      if (!antes) return res.status(404).json({ message: 'Categoria não encontrada.' });
      const categoria = await KanbanEstoqueModel.updateCategory(id, { nome });
      await recordAuditLog(req, {
        modulo: 'KANBAN_ESTOQUE', acao: 'ATUALIZAR', entidade_tipo: 'CATEGORIA_KANBAN',
        entidade_id: id, descricao: `Categoria ${categoria.nome} atualizada no Kanban.`, antes, depois: categoria
      });
      return res.status(200).json(categoria);
    } catch (error) {
      const dbError = databaseError(error, 'Já existe uma categoria com esse nome.');
      if (dbError) return res.status(dbError.status).json({ message: dbError.message });
      console.error('Erro ao atualizar categoria do Kanban:', error);
      return res.status(500).json({ message: 'Erro ao atualizar a categoria.' });
    }
  },

  async deleteCategory(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Categoria inválida.' });
    try {
      const antes = await KanbanEstoqueModel.findCategoryById(id);
      if (!antes) return res.status(404).json({ message: 'Categoria não encontrada.' });
      await KanbanEstoqueModel.deleteCategory(id);
      await recordAuditLog(req, {
        modulo: 'KANBAN_ESTOQUE', acao: 'EXCLUIR', entidade_tipo: 'CATEGORIA_KANBAN',
        entidade_id: id, descricao: `Categoria ${antes.nome} excluída do Kanban.`, antes
      });
      return res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir categoria do Kanban:', error);
      return res.status(500).json({ message: 'Erro ao excluir a categoria.' });
    }
  },

  async createItem(req, res) {
    const data = {
      id_categoria: parseId(req.body.id_categoria),
      id_peca: parseId(req.body.id_peca),
      quantidade_pacote: Number.parseFloat(req.body.quantidade_pacote)
    };
    if (!data.id_categoria || !data.id_peca || !Number.isFinite(data.quantidade_pacote) || data.quantidade_pacote <= 0) {
      return res.status(400).json({ message: 'Selecione a categoria, a peça e informe uma quantidade por pacote maior que zero.' });
    }

    try {
      const item = await KanbanEstoqueModel.createItem(data);
      await recordAuditLog(req, {
        modulo: 'KANBAN_ESTOQUE', acao: 'CRIAR', entidade_tipo: 'ITEM_KANBAN',
        entidade_id: item.id, descricao: `Peça ${item.codigo} adicionada ao Kanban.`, depois: item
      });
      return res.status(201).json(item);
    } catch (error) {
      const dbError = databaseError(error, 'Essa peça já está nessa categoria.');
      if (dbError) return res.status(dbError.status).json({ message: dbError.message });
      console.error('Erro ao adicionar peça ao Kanban:', error);
      return res.status(500).json({ message: 'Erro ao adicionar a peça ao Kanban.' });
    }
  },

  async updateItem(req, res) {
    const id = parseId(req.params.id);
    const data = {
      id_categoria: parseId(req.body.id_categoria),
      id_peca: parseId(req.body.id_peca),
      quantidade_pacote: Number.parseFloat(req.body.quantidade_pacote)
    };
    if (!id || !data.id_categoria || !data.id_peca || !Number.isFinite(data.quantidade_pacote) || data.quantidade_pacote <= 0) {
      return res.status(400).json({ message: 'Informe dados válidos para o item.' });
    }

    try {
      const antes = await KanbanEstoqueModel.findItemById(id);
      if (!antes) return res.status(404).json({ message: 'Item do Kanban não encontrado.' });
      const item = await KanbanEstoqueModel.updateItem(id, data);
      await recordAuditLog(req, {
        modulo: 'KANBAN_ESTOQUE', acao: 'ATUALIZAR', entidade_tipo: 'ITEM_KANBAN',
        entidade_id: id, descricao: `Peça ${item.codigo} atualizada no Kanban.`, antes, depois: item
      });
      return res.status(200).json(item);
    } catch (error) {
      const dbError = databaseError(error, 'Essa peça já está nessa categoria.');
      if (dbError) return res.status(dbError.status).json({ message: dbError.message });
      console.error('Erro ao atualizar peça do Kanban:', error);
      return res.status(500).json({ message: 'Erro ao atualizar a peça do Kanban.' });
    }
  },

  async deleteItem(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Item inválido.' });
    try {
      const antes = await KanbanEstoqueModel.findItemById(id);
      if (!antes) return res.status(404).json({ message: 'Item do Kanban não encontrado.' });
      await KanbanEstoqueModel.deleteItem(id);
      await recordAuditLog(req, {
        modulo: 'KANBAN_ESTOQUE', acao: 'EXCLUIR', entidade_tipo: 'ITEM_KANBAN',
        entidade_id: id, descricao: `Peça ${antes.codigo} removida do Kanban.`, antes
      });
      return res.status(204).send();
    } catch (error) {
      console.error('Erro ao remover peça do Kanban:', error);
      return res.status(500).json({ message: 'Erro ao remover a peça do Kanban.' });
    }
  }
};

module.exports = KanbanEstoqueController;
