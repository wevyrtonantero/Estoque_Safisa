const SETORES = Object.freeze({
  ALMOXARIFADO: 'ALMOXARIFADO',
  MONTAGEM: 'MONTAGEM',
  EXPEDICAO: 'EXPEDICAO',
  PRODUCAO: 'PRODUCAO',
  ADMINISTRATIVO: 'ADMINISTRATIVO'
});

const ALL_SETORES = Object.freeze(Object.values(SETORES));

function normalizeSetor(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ALL_SETORES.includes(normalized) ? normalized : '';
}

function isValidSetor(value) {
  return ALL_SETORES.includes(normalizeSetor(value));
}

function getSetorLabel(setor) {
  const labels = {
    ALMOXARIFADO: 'Almoxarifado',
    MONTAGEM: 'Montagem',
    EXPEDICAO: 'Expedicao',
    PRODUCAO: 'Producao',
    ADMINISTRATIVO: 'Administrativo'
  };

  return labels[normalizeSetor(setor)] || '-';
}

module.exports = {
  SETORES,
  ALL_SETORES,
  normalizeSetor,
  isValidSetor,
  getSetorLabel
};
