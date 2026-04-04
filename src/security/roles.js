const ROLES = Object.freeze({
  OPERACAO: 'OPERACAO',
  ADM: 'ADM',
  GESTOR: 'GESTOR',
  SUPERADMIN: 'SUPERADMIN'
});

const ALL_ROLES = Object.freeze([
  ROLES.OPERACAO,
  ROLES.ADM,
  ROLES.GESTOR,
  ROLES.SUPERADMIN
]);

const ADMIN_READ_ROLES = Object.freeze([ROLES.ADM, ROLES.GESTOR, ROLES.SUPERADMIN]);
const ADMIN_WRITE_ROLES = Object.freeze([ROLES.ADM, ROLES.SUPERADMIN]);
const ADMIN_DELETE_ROLES = Object.freeze([ROLES.SUPERADMIN]);
const SUPERADMIN_ONLY_ROLES = Object.freeze([ROLES.SUPERADMIN]);

const OPERATION_READ_ROLES = Object.freeze([ROLES.OPERACAO, ROLES.GESTOR, ROLES.SUPERADMIN]);
const OPERATION_WRITE_ROLES = Object.freeze([ROLES.OPERACAO, ROLES.SUPERADMIN]);

const STOCK_READ_ROLES = Object.freeze([ROLES.OPERACAO, ROLES.ADM, ROLES.GESTOR, ROLES.SUPERADMIN]);
const STOCK_WRITE_ROLES = Object.freeze([ROLES.OPERACAO, ROLES.ADM, ROLES.SUPERADMIN]);

const REMESSA_READ_ROLES = Object.freeze([ROLES.OPERACAO, ROLES.ADM, ROLES.GESTOR, ROLES.SUPERADMIN]);
const REMESSA_WRITE_ROLES = Object.freeze([ROLES.OPERACAO, ROLES.ADM, ROLES.SUPERADMIN]);

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function isValidRole(role) {
  return ALL_ROLES.includes(normalizeRole(role));
}

function getDefaultRedirectForRole(role) {
  const normalized = normalizeRole(role);

  if (normalized === ROLES.OPERACAO) {
    return '/pagina-operacao';
  }

  if (normalized === ROLES.ADM) {
    return '/pagina-adm';
  }

  return '/pagina-acesso';
}

module.exports = {
  ROLES,
  ALL_ROLES,
  ADMIN_READ_ROLES,
  ADMIN_WRITE_ROLES,
  ADMIN_DELETE_ROLES,
  SUPERADMIN_ONLY_ROLES,
  OPERATION_READ_ROLES,
  OPERATION_WRITE_ROLES,
  STOCK_READ_ROLES,
  STOCK_WRITE_ROLES,
  REMESSA_READ_ROLES,
  REMESSA_WRITE_ROLES,
  normalizeRole,
  isValidRole,
  getDefaultRedirectForRole
};
