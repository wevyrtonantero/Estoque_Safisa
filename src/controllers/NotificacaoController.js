const NotificacaoModel = require('../models/NotificacaoModel');

function extractErrorResponse(error, fallbackMessage) {
  if (error.statusCode) {
    return { status: error.statusCode, body: { message: error.message } };
  }

  console.error(fallbackMessage, error);
  return { status: 500, body: { message: fallbackMessage } };
}

class NotificacaoController {
  static async list(req, res) {
    try {
      const result = await NotificacaoModel.listForUser(req.currentUser.id, {
        limit: req.query.limit
      });

      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao listar notificacoes.');
      return res.status(response.status).json(response.body);
    }
  }

  static async markAsRead(req, res) {
    try {
      const result = await NotificacaoModel.markAsRead(req.params.id, req.currentUser.id);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao marcar notificacao como lida.');
      return res.status(response.status).json(response.body);
    }
  }

  static async markAllAsRead(req, res) {
    try {
      const result = await NotificacaoModel.markAllAsRead(req.currentUser.id);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao marcar notificacoes como lidas.');
      return res.status(response.status).json(response.body);
    }
  }
}

module.exports = NotificacaoController;
