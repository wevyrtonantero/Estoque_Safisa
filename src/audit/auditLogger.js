const AuditLogModel = require('../models/AuditLogModel');

const SENSITIVE_KEYS = new Set([
  'senha',
  'senha_hash',
  'senhahash',
  'password',
  'accesspassword',
  'sessionsecret',
  'token'
]);

function sanitizeAuditValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAuditValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
      const normalizedKey = String(key).trim().toLowerCase();
      if (SENSITIVE_KEYS.has(normalizedKey)) {
        return accumulator;
      }

      accumulator[key] = sanitizeAuditValue(entryValue);
      return accumulator;
    }, {});
  }

  return value;
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
}

async function recordAuditLog(req, entry = {}) {
  try {
    const actor = entry.actor || req.currentUser || null;

    await AuditLogModel.record({
      id_usuario: actor?.id ?? null,
      usuario_login: actor?.login ?? null,
      usuario_nome: actor?.nome ?? null,
      usuario_role: actor?.role ?? null,
      modulo: entry.modulo,
      acao: entry.acao,
      entidade_tipo: entry.entidade_tipo,
      entidade_id: entry.entidade_id,
      descricao: entry.descricao,
      detalhes_antes: sanitizeAuditValue(entry.antes ?? null),
      detalhes_depois: sanitizeAuditValue(entry.depois ?? null),
      ip: getRequestIp(req),
      user_agent: req.get ? req.get('user-agent') : req.headers?.['user-agent']
    });
  } catch (error) {
    console.error('Falha ao registrar auditoria:', error);
  }
}

module.exports = {
  recordAuditLog,
  sanitizeAuditValue
};
