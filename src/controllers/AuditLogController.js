const AuditLogModel = require('../models/AuditLogModel');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

class AuditLogController {
  static async getAll(req, res) {
    try {
      const logs = await AuditLogModel.findAll({
        data_inicio: req.query.data_inicio ? String(req.query.data_inicio).trim() : '',
        data_fim: req.query.data_fim ? String(req.query.data_fim).trim() : '',
        usuario: req.query.usuario ? String(req.query.usuario).trim() : '',
        modulo: req.query.modulo ? String(req.query.modulo).trim() : '',
        acao: req.query.acao ? String(req.query.acao).trim() : '',
        q: req.query.q ? String(req.query.q).trim() : '',
        limit: normalizeOptionalInteger(req.query.limit)
      });

      res.status(200).json(logs);
    } catch (error) {
      console.error('Erro ao listar logs de auditoria:', error);
      res.status(500).json({ message: 'Erro ao listar logs de auditoria.' });
    }
  }

  static async getById(req, res) {
    try {
      const log = await AuditLogModel.findById(req.params.id);

      if (!log) {
        return res.status(404).json({ message: 'Log de auditoria nao encontrado.' });
      }

      return res.status(200).json(log);
    } catch (error) {
      console.error('Erro ao buscar log de auditoria:', error);
      return res.status(500).json({ message: 'Erro ao buscar log de auditoria.' });
    }
  }
}

module.exports = AuditLogController;
