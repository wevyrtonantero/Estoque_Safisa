const EtiquetaModel = require('../models/EtiquetaModel');
const { recordAuditLog } = require('../audit/auditLogger');
const { gerarZplEtiqueta, getDefaultLayoutJson } = require('../services/EtiquetaZplService');
const fs = require('fs/promises');
const path = require('path');

const LEGACY_FOLDER_PATH = 'D:\\n apagar\\expedição\\folha de kit';

function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'sim', 'yes'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'nao', 'não', 'no'].includes(normalized)) {
    return false;
  }

  return null;
}

function buildAuditSnapshot(etiqueta) {
  if (!etiqueta) {
    return null;
  }

  return {
    id: etiqueta.id,
    codigo_item: etiqueta.codigo_item,
    categoria: etiqueta.categoria,
    titulo: etiqueta.titulo,
    aplicacao_linha_1: etiqueta.aplicacao_linha_1,
    aplicacao_linha_2: etiqueta.aplicacao_linha_2,
    aplicacao_linha_3: etiqueta.aplicacao_linha_3,
    codigo_barras: etiqueta.codigo_barras,
    ativo: etiqueta.ativo,
    layout_json: etiqueta.layout_json,
    updated_at: etiqueta.updated_at || null
  };
}

function parseLegacyEtiquetaContent(fileName, content) {
  const lines = String(content || '').split(/\r?\n/);
  const activeCodeLines = lines
    .map((line) => line.trim())
    .filter((line) => line.includes('cmds +=') && !line.startsWith('//'));

  const extractValueByRegex = (regex) => {
    for (const line of activeCodeLines) {
      const match = line.match(regex);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return '';
  };

  const extractApplications = () => {
    const applicationEntries = [];
    for (const line of activeCodeLines) {
      const match = line.match(/\^FO50,(\d+)\^FD(.+?)\^FS/);
      if (!match?.[2]) {
        continue;
      }

      const y = Number.parseInt(match[1], 10);
      const text = match[2].trim();

      if (!Number.isFinite(y) || text.toLowerCase().startsWith('aplicacao')) {
        continue;
      }

      if (y >= 300 && y <= 500) {
        applicationEntries.push({ y, text });
      }
    }

    return applicationEntries
      .sort((a, b) => a.y - b.y)
      .slice(0, 3)
      .map((entry) => entry.text);
  };

  const codigoItem = path.parse(fileName).name.trim().toUpperCase();
  const titulo = extractValueByRegex(/\^FO220,195\^FD(.+?)\^FS/);
  const codigoBarras = extractValueByRegex(/\^FO280,650\^BC[^^]*\^FD(.+?)\^FS/);
  const aplicacoes = extractApplications();

  return {
    codigo_item: codigoItem,
    titulo,
    aplicacao_linha_1: aplicacoes[0] || '',
    aplicacao_linha_2: aplicacoes[1] || '',
    aplicacao_linha_3: aplicacoes[2] || '',
    codigo_barras: codigoBarras
  };
}

const EtiquetaController = {
  async getAll(req, res) {
    try {
      const etiquetas = await EtiquetaModel.findAll({
        codigo_item: req.query.codigo_item ? String(req.query.codigo_item).trim() : '',
        categoria: req.query.categoria ? String(req.query.categoria).trim() : '',
        ativo: normalizeOptionalBoolean(req.query.ativo)
      });

      return res.status(200).json(etiquetas);
    } catch (error) {
      console.error('Erro ao listar etiquetas:', error);
      return res.status(500).json({ message: 'Erro ao listar etiquetas.' });
    }
  },

  async getByCodigo(req, res) {
    try {
      const codigoItem = String(req.params.codigoItem || '').trim().toUpperCase();
      const etiqueta = await EtiquetaModel.findByCodigo(codigoItem);

      if (!etiqueta) {
        return res.status(404).json({ message: 'Etiqueta nao encontrada para o codigo informado.' });
      }

      return res.status(200).json(etiqueta);
    } catch (error) {
      console.error('Erro ao buscar etiqueta por codigo:', error);
      return res.status(500).json({ message: 'Erro ao buscar a etiqueta pelo codigo.' });
    }
  },

  async create(req, res) {
    try {
      const payload = {
        codigo_item: req.body?.codigo_item,
        categoria: req.body?.categoria,
        titulo: req.body?.titulo,
        aplicacao_linha_1: req.body?.aplicacao_linha_1,
        aplicacao_linha_2: req.body?.aplicacao_linha_2,
        aplicacao_linha_3: req.body?.aplicacao_linha_3,
        codigo_barras: req.body?.codigo_barras,
        ativo: req.body?.ativo,
        layout_json: req.body?.layout_json || getDefaultLayoutJson()
      };

      const criada = await EtiquetaModel.create(payload);

      await recordAuditLog(req, {
        modulo: 'ETIQUETAS',
        acao: 'CREATE',
        entidade_tipo: 'ETIQUETA',
        entidade_id: criada.id,
        descricao: `Etiqueta criada para o codigo ${criada.codigo_item}.`,
        depois: buildAuditSnapshot(criada)
      });

      return res.status(201).json(criada);
    } catch (error) {
      console.error('Erro ao criar etiqueta:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao criar etiqueta.' });
    }
  },

  async update(req, res) {
    try {
      const antes = await EtiquetaModel.findById(req.params.id);
      if (!antes) {
        return res.status(404).json({ message: 'Etiqueta nao encontrada.' });
      }

      const atualizado = await EtiquetaModel.update(req.params.id, {
        codigo_item: req.body?.codigo_item,
        categoria: req.body?.categoria,
        titulo: req.body?.titulo,
        aplicacao_linha_1: req.body?.aplicacao_linha_1,
        aplicacao_linha_2: req.body?.aplicacao_linha_2,
        aplicacao_linha_3: req.body?.aplicacao_linha_3,
        codigo_barras: req.body?.codigo_barras,
        ativo: req.body?.ativo,
        layout_json: req.body?.layout_json
      });

      await recordAuditLog(req, {
        modulo: 'ETIQUETAS',
        acao: 'UPDATE',
        entidade_tipo: 'ETIQUETA',
        entidade_id: atualizado.id,
        descricao: `Etiqueta ${atualizado.codigo_item} atualizada.`,
        antes: buildAuditSnapshot(antes),
        depois: buildAuditSnapshot(atualizado)
      });

      return res.status(200).json(atualizado);
    } catch (error) {
      console.error('Erro ao atualizar etiqueta:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao atualizar etiqueta.' });
    }
  },

  async updateStatus(req, res) {
    try {
      const antes = await EtiquetaModel.findById(req.params.id);
      if (!antes) {
        return res.status(404).json({ message: 'Etiqueta nao encontrada.' });
      }

      const ativo = normalizeOptionalBoolean(req.body?.ativo);
      if (ativo === null) {
        return res.status(400).json({ message: 'Informe um status valido para a etiqueta.' });
      }

      const atualizado = await EtiquetaModel.updateStatus(req.params.id, ativo);

      await recordAuditLog(req, {
        modulo: 'ETIQUETAS',
        acao: 'UPDATE_STATUS',
        entidade_tipo: 'ETIQUETA',
        entidade_id: atualizado.id,
        descricao: `Status da etiqueta ${atualizado.codigo_item} atualizado para ${atualizado.ativo ? 'ativo' : 'inativo'}.`,
        antes: buildAuditSnapshot(antes),
        depois: buildAuditSnapshot(atualizado)
      });

      return res.status(200).json(atualizado);
    } catch (error) {
      console.error('Erro ao atualizar status da etiqueta:', error);
      return res.status(500).json({ message: 'Erro ao atualizar o status da etiqueta.' });
    }
  },

  async gerarZpl(req, res) {
    try {
      const codigoItem = String(req.body?.codigoItem || '').trim().toUpperCase();
      const numeroSerie = String(req.body?.numeroSerie || '').trim();

      if (!codigoItem) {
        return res.status(400).json({ message: 'Informe o codigoItem para gerar o ZPL.' });
      }

      if (!numeroSerie) {
        return res.status(400).json({ message: 'Informe o numeroSerie para gerar o ZPL de teste.' });
      }

      const etiqueta = await EtiquetaModel.findActiveByCodigo(codigoItem);
      if (!etiqueta) {
        return res.status(404).json({ message: 'Nao existe etiqueta ativa para o codigo informado.' });
      }

      const zpl = gerarZplEtiqueta(etiqueta, {
        numeroSerie,
        dataHora: req.body?.dataHora,
        pedido: req.body?.pedido || null
      });

      return res.status(200).json({
        etiqueta: {
          id: etiqueta.id,
          codigo_item: etiqueta.codigo_item,
          categoria: etiqueta.categoria,
          titulo: etiqueta.titulo
        },
        numero_serie: numeroSerie,
        zpl
      });
    } catch (error) {
      console.error('Erro ao gerar ZPL da etiqueta:', error);
      return res.status(500).json({ message: error.message || 'Erro ao gerar o ZPL da etiqueta.' });
    }
  },

  async importLegacyFolder(req, res) {
    try {
      const entries = await fs.readdir(LEGACY_FOLDER_PATH, { withFileTypes: true });
      const htmlFiles = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));

      let created = 0;
      let updated = 0;
      const skipped = [];

      for (const fileName of htmlFiles) {
        const fullPath = path.join(LEGACY_FOLDER_PATH, fileName);
        const content = await fs.readFile(fullPath, 'utf8');
        const parsed = parseLegacyEtiquetaContent(fileName, content);

        if (!parsed.codigo_item || !parsed.titulo || !parsed.aplicacao_linha_1 || !parsed.codigo_barras) {
          skipped.push({ arquivo: fileName, motivo: 'Campos obrigatorios nao encontrados no HTML legado.' });
          continue;
        }

        const peca = await EtiquetaModel.findPecaByCodigo(parsed.codigo_item);
        if (!peca) {
          skipped.push({ arquivo: fileName, motivo: `Codigo ${parsed.codigo_item} nao encontrado no cadastro de pecas.` });
          continue;
        }

        const existente = await EtiquetaModel.findByCodigo(parsed.codigo_item);
        const payload = {
          ...parsed,
          ativo: existente ? existente.ativo : true,
          layout_json: existente?.layout_json || getDefaultLayoutJson()
        };

        const etiqueta = await EtiquetaModel.upsertByCodigo(payload);
        if (existente) {
          updated += 1;
        } else {
          created += 1;
        }

        await recordAuditLog(req, {
          modulo: 'ETIQUETAS',
          acao: existente ? 'IMPORT_UPDATE' : 'IMPORT_CREATE',
          entidade_tipo: 'ETIQUETA',
          entidade_id: etiqueta.id,
          descricao: `Etiqueta ${etiqueta.codigo_item} importada do legado (${fileName}).`,
          depois: buildAuditSnapshot(etiqueta)
        });
      }

      return res.status(200).json({
        message: 'Importacao do legado concluida.',
        folder: LEGACY_FOLDER_PATH,
        created,
        updated,
        skipped
      });
    } catch (error) {
      console.error('Erro ao importar etiquetas do legado:', error);
      return res.status(500).json({ message: 'Erro ao importar etiquetas do legado.' });
    }
  },

  async replicateLayout(req, res) {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'ID da etiqueta invalido para replicar layout.' });
      }

      const result = await EtiquetaModel.replicateLayoutToCategory(id);
      if (!result) {
        return res.status(404).json({ message: 'Etiqueta de origem nao encontrada.' });
      }

      await recordAuditLog(req, {
        modulo: 'ETIQUETAS',
        acao: 'REPLICATE_LAYOUT',
        entidade_tipo: 'ETIQUETA',
        entidade_id: result.origem.id,
        descricao: `Layout da etiqueta ${result.origem.codigo_item} replicado para as demais etiquetas.`,
        depois: {
          codigo_item: result.origem.codigo_item,
          categoria: result.origem.categoria,
          replicated_count: result.replicated_count
        }
      });

      return res.status(200).json({
        message: `Layout replicado para ${result.replicated_count} etiqueta(s) da categoria ${result.origem.categoria}.`,
        origem: {
          id: result.origem.id,
          codigo_item: result.origem.codigo_item,
          categoria: result.origem.categoria
        },
        replicated_count: result.replicated_count
      });
    } catch (error) {
      console.error('Erro ao replicar layout das etiquetas:', error);
      return res.status(500).json({ message: 'Erro ao replicar o layout das etiquetas.' });
    }
  }
};

module.exports = EtiquetaController;
