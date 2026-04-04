const UsuarioModel = require('../models/UsuarioModel');
const { ALL_ROLES, normalizeRole, ROLES } = require('../security/roles');
const { hashPassword } = require('../security/passwordUtils');
const { recordAuditLog } = require('../audit/auditLogger');

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'sim', 's', 'on'].includes(normalized);
}

function buildPayload(body, { requirePassword }) {
  return {
    nome: String(body.nome || '').trim(),
    login: String(body.login || '').trim(),
    role: normalizeRole(body.role),
    ativo: normalizeBoolean(body.ativo, true),
    senha: String(body.senha || '').trim(),
    requirePassword
  };
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.nome) {
    errors.push('O nome do usuario e obrigatorio.');
  }

  if (!payload.login) {
    errors.push('O login do usuario e obrigatorio.');
  }

  if (!payload.role || !ALL_ROLES.includes(payload.role)) {
    errors.push(`O perfil deve ser um destes: ${ALL_ROLES.join(', ')}.`);
  }

  if (payload.requirePassword && payload.senha.length < 6) {
    errors.push('A senha deve ter pelo menos 6 caracteres.');
  }

  if (!payload.requirePassword && payload.senha && payload.senha.length < 6) {
    errors.push('Quando informada, a senha deve ter pelo menos 6 caracteres.');
  }

  return errors;
}

async function ensureSuperadminSafety({ userId, nextRole, nextActive, currentUserId, action }) {
  const targetUser = await UsuarioModel.findById(userId);
  if (!targetUser) {
    return { ok: false, status: 404, message: 'Usuario nao encontrado.' };
  }

  if (Number(currentUserId) === Number(userId)) {
    if (action === 'delete') {
      return { ok: false, status: 400, message: 'Voce nao pode excluir o proprio usuario.' };
    }

    if (nextActive === false) {
      return { ok: false, status: 400, message: 'Voce nao pode desativar o proprio usuario.' };
    }
  }

  const willRemainSuperadmin = (nextRole ?? targetUser.role) === ROLES.SUPERADMIN;
  const willRemainActive = nextActive ?? targetUser.ativo;

  if (targetUser.role === ROLES.SUPERADMIN && (!willRemainSuperadmin || !willRemainActive || action === 'delete')) {
    const activeSuperadmins = await UsuarioModel.countActiveSuperadmins();
    if (activeSuperadmins <= 1) {
      return {
        ok: false,
        status: 400,
        message: 'O sistema precisa manter pelo menos um SUPERADMIN ativo.'
      };
    }
  }

  return { ok: true, user: targetUser };
}

class UsuarioController {
  static async getAll(req, res) {
    try {
      const usuarios = await UsuarioModel.findAll({
        nome: req.query.nome ? String(req.query.nome).trim() : '',
        login: req.query.login ? String(req.query.login).trim() : '',
        role: req.query.role ? String(req.query.role).trim() : '',
        ativo: req.query.ativo === '' || req.query.ativo === undefined
          ? undefined
          : normalizeBoolean(req.query.ativo, true)
      });

      res.status(200).json(usuarios);
    } catch (error) {
      console.error('Erro ao listar usuarios:', error);
      res.status(500).json({ message: 'Erro ao listar usuarios.' });
    }
  }

  static async getById(req, res) {
    try {
      const usuario = await UsuarioModel.findById(req.params.id);

      if (!usuario) {
        return res.status(404).json({ message: 'Usuario nao encontrado.' });
      }

      return res.status(200).json(usuario);
    } catch (error) {
      console.error('Erro ao buscar usuario:', error);
      return res.status(500).json({ message: 'Erro ao buscar usuario.' });
    }
  }

  static async create(req, res) {
    try {
      const payload = buildPayload(req.body, { requirePassword: true });
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const usuario = await UsuarioModel.create({
        nome: payload.nome,
        login: payload.login,
        senhaHash: hashPassword(payload.senha),
        role: payload.role,
        ativo: payload.ativo
      });

      await recordAuditLog(req, {
        modulo: 'USUARIOS',
        acao: 'CREATE',
        entidade_tipo: 'USUARIO',
        entidade_id: usuario.id,
        descricao: `Usuario ${usuario.login} criado.`,
        depois: usuario
      });

      return res.status(201).json(usuario);
    } catch (error) {
      console.error('Erro ao criar usuario:', error);
      return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao criar usuario.' });
    }
  }

  static async update(req, res) {
    try {
      const payload = buildPayload(req.body, { requirePassword: false });
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const safety = await ensureSuperadminSafety({
        userId: req.params.id,
        nextRole: payload.role,
        nextActive: payload.ativo,
        currentUserId: req.currentUser?.id,
        action: 'update'
      });

      if (!safety.ok) {
        return res.status(safety.status).json({ message: safety.message });
      }

      const usuario = await UsuarioModel.update(req.params.id, {
        nome: payload.nome,
        login: payload.login,
        senhaHash: payload.senha ? hashPassword(payload.senha) : undefined,
        role: payload.role,
        ativo: payload.ativo
      });

      if (!usuario) {
        return res.status(404).json({ message: 'Usuario nao encontrado.' });
      }

      await recordAuditLog(req, {
        modulo: 'USUARIOS',
        acao: 'UPDATE',
        entidade_tipo: 'USUARIO',
        entidade_id: usuario.id,
        descricao: `Usuario ${usuario.login} atualizado.`,
        antes: safety.user,
        depois: usuario
      });

      return res.status(200).json(usuario);
    } catch (error) {
      console.error('Erro ao atualizar usuario:', error);
      return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao atualizar usuario.' });
    }
  }

  static async delete(req, res) {
    try {
      const safety = await ensureSuperadminSafety({
        userId: req.params.id,
        currentUserId: req.currentUser?.id,
        action: 'delete'
      });

      if (!safety.ok) {
        return res.status(safety.status).json({ message: safety.message });
      }

      const deleted = await UsuarioModel.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Usuario nao encontrado.' });
      }

      await recordAuditLog(req, {
        modulo: 'USUARIOS',
        acao: 'DELETE',
        entidade_tipo: 'USUARIO',
        entidade_id: safety.user.id,
        descricao: `Usuario ${safety.user.login} excluido.`,
        antes: safety.user
      });

      return res.status(200).json({ message: 'Usuario excluido com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir usuario:', error);
      return res.status(500).json({ message: 'Erro ao excluir usuario.' });
    }
  }
}

module.exports = UsuarioController;
