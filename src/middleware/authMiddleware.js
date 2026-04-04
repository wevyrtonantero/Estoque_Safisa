const { appConfig } = require('../../database/config');
const UsuarioModel = require('../models/UsuarioModel');

const authState = {
  hasUsers: null
};

function buildLoginRedirect(req) {
  return `/pagina-login?next=${encodeURIComponent(req.originalUrl || req.url || '/pagina-acesso')}`;
}

async function resolveAuthEnabled() {
  if (authState.hasUsers === true) {
    return true;
  }

  const hasUsers = await UsuarioModel.hasActiveUsers();
  authState.hasUsers = hasUsers;
  return hasUsers;
}

function markUsersConfigured(value = true) {
  authState.hasUsers = Boolean(value);
}

async function attachAuthContext(req, res, next) {
  try {
    req.authEnabled = await resolveAuthEnabled();
    req.currentUser = null;

    if (req.session?.userId) {
      const user = await UsuarioModel.findById(req.session.userId);
      if (user && user.ativo) {
        req.currentUser = user;
      } else if (req.session) {
        req.session.destroy(() => {});
        res.clearCookie(appConfig.sessionCookieName);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

function requirePageRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.authEnabled) {
      next();
      return;
    }

    if (!req.currentUser) {
      res.redirect(buildLoginRedirect(req));
      return;
    }

    if (allowedRoles.includes(req.currentUser.role)) {
      next();
      return;
    }

    res.redirect('/pagina-acesso?erro=sem-permissao');
  };
}

function requireApiRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.authEnabled) {
      next();
      return;
    }

    if (!req.currentUser) {
      res.status(401).json({ message: 'Nao autenticado.' });
      return;
    }

    if (allowedRoles.includes(req.currentUser.role)) {
      next();
      return;
    }

    res.status(403).json({ message: 'Seu usuario nao tem permissao para esta acao.' });
  };
}

module.exports = {
  attachAuthContext,
  requirePageRoles,
  requireApiRoles,
  markUsersConfigured
};
