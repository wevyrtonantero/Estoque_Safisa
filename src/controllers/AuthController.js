const { appConfig } = require('../../database/config');
const UsuarioModel = require('../models/UsuarioModel');
const { verifyPassword } = require('../security/passwordUtils');
const { getDefaultRedirectForRole } = require('../security/roles');
const { markUsersConfigured } = require('../middleware/authMiddleware');
const { recordAuditLog } = require('../audit/auditLogger');

function buildUserPayload(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    nome: user.nome,
    login: user.login,
    role: user.role,
    ativo: user.ativo,
    ultimo_login_em: user.ultimo_login_em || null
  };
}

function resolveRedirectTarget(rawValue, fallback = '/pagina-acesso') {
  const value = String(rawValue || '').trim();
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  if (value === '/pagina-login' || value.startsWith('/api/auth/')) {
    return fallback;
  }

  return value;
}

function destroySession(req, res, callback) {
  if (!req.session) {
    callback();
    return;
  }

  req.session.destroy(() => {
    res.clearCookie(appConfig.sessionCookieName);
    callback();
  });
}

class AuthController {
  static getStatus(req, res) {
    res.json({
      authEnabled: Boolean(req.authEnabled),
      authenticated: req.authEnabled ? Boolean(req.currentUser) : true,
      user: buildUserPayload(req.currentUser)
    });
  }

  static getMe(req, res) {
    if (!req.authEnabled) {
      res.json({
        authEnabled: false,
        authenticated: true,
        user: null
      });
      return;
    }

    if (!req.currentUser) {
      res.status(401).json({ message: 'Nao autenticado.' });
      return;
    }

    res.json({
      authEnabled: true,
      authenticated: true,
      user: buildUserPayload(req.currentUser)
    });
  }

  static async login(req, res) {
    try {
      if (!req.authEnabled) {
        res.json({
          authEnabled: false,
          authenticated: true,
          redirectTo: resolveRedirectTarget(req.body?.next)
        });
        return;
      }

      const login = UsuarioModel.normalizeLogin(req.body?.login);
      const password = String(req.body?.password || '');

      if (!login || !password) {
        res.status(400).json({ message: 'Informe login e senha.' });
        return;
      }

      const user = await UsuarioModel.findByLogin(login);
      if (!user || !user.ativo || !verifyPassword(password, user.senha_hash)) {
        res.status(401).json({ message: 'Login ou senha invalidos.' });
        return;
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userLogin = user.login;
      req.session.authenticatedAt = new Date().toISOString();

      await UsuarioModel.touchLastLogin(user.id);
      markUsersConfigured(true);

      req.session.save(async (error) => {
        if (error) {
          res.status(500).json({ message: 'Nao foi possivel iniciar a sessao.' });
          return;
        }

        await recordAuditLog(req, {
          actor: user,
          modulo: 'AUTENTICACAO',
          acao: 'LOGIN',
          entidade_tipo: 'USUARIO',
          entidade_id: user.id,
          descricao: `Login realizado por ${user.login}.`,
          depois: {
            id: user.id,
            login: user.login,
            nome: user.nome,
            role: user.role
          }
        });

        const defaultRedirect = getDefaultRedirectForRole(user.role);
        res.json({
          authEnabled: true,
          authenticated: true,
          user: buildUserPayload(user),
          redirectTo: resolveRedirectTarget(req.body?.next, defaultRedirect)
        });
      });
    } catch (error) {
      console.error('Erro ao autenticar usuario:', error);
      res.status(500).json({ message: 'Nao foi possivel autenticar o usuario.' });
    }
  }

  static logout(req, res) {
    const actor = req.currentUser ? { ...req.currentUser } : null;
    recordAuditLog(req, {
      actor,
      modulo: 'AUTENTICACAO',
      acao: 'LOGOUT',
      entidade_tipo: 'USUARIO',
      entidade_id: actor?.id ?? null,
      descricao: actor ? `Logout realizado por ${actor.login}.` : 'Logout de sessao.'
    });

    destroySession(req, res, () => {
      res.json({ success: true });
    });
  }

  static logoutRedirect(req, res) {
    const actor = req.currentUser ? { ...req.currentUser } : null;
    recordAuditLog(req, {
      actor,
      modulo: 'AUTENTICACAO',
      acao: 'LOGOUT',
      entidade_tipo: 'USUARIO',
      entidade_id: actor?.id ?? null,
      descricao: actor ? `Logout realizado por ${actor.login}.` : 'Logout de sessao.'
    });

    destroySession(req, res, () => {
      res.redirect('/pagina-login');
    });
  }
}

module.exports = AuthController;
