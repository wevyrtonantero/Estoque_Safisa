// Controller da estrutura interna das submontagens.
const EstruturaSubmontagemModel = require('../models/EstruturaSubmontagemModel');

// Normaliza o payload do componente antes de salvar.
function buildComponentPayload(body) {
  return {
    id_item_componente: Number.parseInt(body.id_item_componente, 10),
    quantidade: Number(body.quantidade),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

// Valida as regras basicas da estrutura.
function validateComponentPayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.id_item_componente)) {
    errors.push('O componente informado deve ser um item valido.');
  }

  if (!Number.isInteger(payload.quantidade) || payload.quantidade <= 0) {
    errors.push('A quantidade deve ser um numero inteiro maior que zero.');
  }

  if (payload.observacao && payload.observacao.length > 255) {
    errors.push('A observacao deve ter no maximo 255 caracteres.');
  }

  return errors;
}

const EstruturaSubmontagemController = {
  // Rota para listar os componentes da submontagem selecionada.
  async getComponents(req, res) {
    try {
      const submontagem = await EstruturaSubmontagemModel.submontagemExists(req.params.id);

      if (!submontagem) {
        return res.status(404).json({ message: 'Submontagem nao encontrada.' });
      }

      const componentes = await EstruturaSubmontagemModel.findBySubmontagemId(req.params.id);
      return res.status(200).json(componentes);
    } catch (error) {
      console.error('Erro ao listar componentes da submontagem:', error);
      return res.status(500).json({ message: 'Erro ao listar componentes da submontagem.' });
    }
  },

  // Rota para adicionar componente na estrutura.
  async createComponent(req, res) {
    try {
      const submontagemId = Number.parseInt(req.params.id, 10);
      const payload = buildComponentPayload(req.body);
      const errors = validateComponentPayload(payload);

      if (submontagemId === payload.id_item_componente) {
        errors.push('A submontagem nao pode ser componente dela mesma.');
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const submontagem = await EstruturaSubmontagemModel.submontagemExists(submontagemId);

      if (!submontagem) {
        return res.status(404).json({ message: 'Submontagem nao encontrada.' });
      }

      const simpleItem = await EstruturaSubmontagemModel.simpleItemExists(payload.id_item_componente);

      if (!simpleItem) {
        return res.status(400).json({ message: 'Somente itens com classificacao ITEM podem ser adicionados.' });
      }

      const duplicateComponent = await EstruturaSubmontagemModel.findComponent(
        submontagemId,
        payload.id_item_componente
      );

      if (duplicateComponent) {
        return res.status(400).json({ message: 'Este componente ja esta cadastrado na submontagem.' });
      }

      const createdComponent = await EstruturaSubmontagemModel.create(submontagemId, payload);
      return res.status(201).json(createdComponent);
    } catch (error) {
      console.error('Erro ao adicionar componente na submontagem:', error);
      return res.status(500).json({ message: 'Erro ao adicionar componente na submontagem.' });
    }
  },

  // Rota para atualizar um componente da estrutura.
  async updateComponent(req, res) {
    try {
      const submontagemId = Number.parseInt(req.params.id, 10);
      const componenteIdAtual = Number.parseInt(req.params.componenteId, 10);
      const payload = buildComponentPayload(req.body);
      const errors = validateComponentPayload(payload);

      if (submontagemId === payload.id_item_componente) {
        errors.push('A submontagem nao pode ser componente dela mesma.');
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const submontagem = await EstruturaSubmontagemModel.submontagemExists(submontagemId);

      if (!submontagem) {
        return res.status(404).json({ message: 'Submontagem nao encontrada.' });
      }

      const currentComponent = await EstruturaSubmontagemModel.findComponent(submontagemId, componenteIdAtual);

      if (!currentComponent) {
        return res.status(404).json({ message: 'Componente nao encontrado na estrutura.' });
      }

      const simpleItem = await EstruturaSubmontagemModel.simpleItemExists(payload.id_item_componente);

      if (!simpleItem) {
        return res.status(400).json({ message: 'Somente itens com classificacao ITEM podem ser adicionados.' });
      }

      if (payload.id_item_componente !== componenteIdAtual) {
        const duplicateComponent = await EstruturaSubmontagemModel.findComponent(
          submontagemId,
          payload.id_item_componente
        );

        if (duplicateComponent) {
          return res.status(400).json({ message: 'Este componente ja esta cadastrado na submontagem.' });
        }
      }

      const updatedComponent = await EstruturaSubmontagemModel.update(
        submontagemId,
        componenteIdAtual,
        payload
      );

      return res.status(200).json(updatedComponent);
    } catch (error) {
      console.error('Erro ao atualizar componente da submontagem:', error);
      return res.status(500).json({ message: 'Erro ao atualizar componente da submontagem.' });
    }
  },

  // Rota para remover componente da estrutura.
  async deleteComponent(req, res) {
    try {
      const deleted = await EstruturaSubmontagemModel.delete(req.params.id, req.params.componenteId);

      if (!deleted) {
        return res.status(404).json({ message: 'Componente nao encontrado na estrutura.' });
      }

      return res.status(200).json({ message: 'Componente removido com sucesso.' });
    } catch (error) {
      console.error('Erro ao remover componente da submontagem:', error);
      return res.status(500).json({ message: 'Erro ao remover componente da submontagem.' });
    }
  }
};

module.exports = EstruturaSubmontagemController;
