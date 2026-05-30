const ChatModel = require('../models/ChatModel');

function extractErrorResponse(error, fallbackMessage) {
  if (error.statusCode) {
    return { status: error.statusCode, body: { message: error.message } };
  }

  console.error(fallbackMessage, error);
  return { status: 500, body: { message: fallbackMessage } };
}

class ChatController {
  static async listUsers(req, res) {
    try {
      const users = await ChatModel.listUsers(req.currentUser.id);
      return res.status(200).json(users);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao listar usuarios do chat.');
      return res.status(response.status).json(response.body);
    }
  }

  static async touchPresence(req, res) {
    try {
      const result = await ChatModel.touchPresence(req.currentUser.id);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao atualizar presenca no chat.');
      return res.status(response.status).json(response.body);
    }
  }

  static async getConversation(req, res) {
    try {
      const result = await ChatModel.getConversation(req.currentUser.id, req.params.usuarioId);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao carregar conversa.');
      return res.status(response.status).json(response.body);
    }
  }

  static async sendMessage(req, res) {
    try {
      const result = await ChatModel.sendMessage(
        req.currentUser.id,
        req.params.usuarioId,
        req.body?.conteudo
      );

      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao enviar mensagem.');
      return res.status(response.status).json(response.body);
    }
  }

  static async markConversationAsRead(req, res) {
    try {
      const result = await ChatModel.markConversationAsRead(req.currentUser.id, req.params.usuarioId);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao atualizar leitura da conversa.');
      return res.status(response.status).json(response.body);
    }
  }
}

module.exports = ChatController;
