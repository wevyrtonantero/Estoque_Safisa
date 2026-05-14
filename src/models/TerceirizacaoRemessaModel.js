const { pool } = require('../../database/connection');
const TratamentoExternoModel = require('./TratamentoExternoModel');
const EstoqueMateriaPrimaModel = require('./EstoqueMateriaPrimaModel');

class TerceirizacaoRemessaModel {
  static buildMateriaPrimaReturnCode(codigoPeca) {
    const codigo = String(codigoPeca || '').trim();
    return codigo.toUpperCase().startsWith('MP') ? codigo : `MP${codigo}`;
  }

  static PROVIDERS = [
    {
      key: 'MULTIELOS',
      nome: 'Multielos Zincagem',
      aliases: [
        'Multielos Zincagem',
        'Multielos Banhos Quimicos'
      ],
      lookupTokens: [
        '51.284.727/0001-89',
        'Multielos'
      ],
      cidade: 'Campinas',
      endereco: 'Rua Lauro Vannucci, 515',
      cep: '13087-548',
      observacao: 'Multielos Banhos Quimicos | Multielos Servicos de Galvanoplastia Ltda | CNPJ 51.284.727/0001-89 | Bairro Fazenda Santa Candida | Campinas - SP',
      servicos: ['ZINCAGEM PRATA', 'ZINCAGEM AMARELA', 'ZINCAGEM PRETA', 'CROMO']
    },
    {
      key: 'TEMPERA',
      nome: 'GCTerm',
      aliases: [
        'GCTerm',
        'Temperaco (Tratamento Termico)'
      ],
      lookupTokens: [
        '31.716.626/0001-22',
        'GCTerm'
      ],
      cidade: 'Sumare',
      endereco: 'Rua Serra Negra, 51',
      cep: '13178-420',
      observacao: 'GCTerm | Gcterm Tratamento Termico Ltda | CNPJ 31.716.626/0001-22 | AR2 - Administracao Regional de Nova Veneza | Sumare - SP',
      servicos: ['TRATAMENTO TERMICO'],
      dureza_padrao: '56 a 58 HRC',
      profundidade_padrao: '0,3 a 0,6 mm'
    }
  ];

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static buildProviderSnapshot(provider, supplierRow = null) {
    return {
      key: provider.key,
      nome: supplierRow?.nome || provider.nome,
      cidade: supplierRow?.cidade || provider.cidade,
      endereco: supplierRow?.endereco || provider.endereco,
      cep: supplierRow?.cep || provider.cep,
      observacao: supplierRow?.observacao || provider.observacao,
      servicos: provider.servicos,
      dureza_padrao: provider.dureza_padrao || '',
      profundidade_padrao: provider.profundidade_padrao || ''
    };
  }

  static async findProviderSupplier(connection, provider) {
    const clauses = [];
    const values = [];

    if (Array.isArray(provider.aliases) && provider.aliases.length > 0) {
      clauses.push(`nome IN (${provider.aliases.map(() => '?').join(', ')})`);
      values.push(...provider.aliases);
    }

    if (Array.isArray(provider.lookupTokens) && provider.lookupTokens.length > 0) {
      clauses.push(provider.lookupTokens.map(() => 'observacao LIKE ?').join(' OR '));
      values.push(...provider.lookupTokens.map((token) => `%${token}%`));
    }

    if (clauses.length === 0) {
      return null;
    }

    const [rows] = await connection.query(
      `
        SELECT
          id,
          nome,
          endereco,
          cidade,
          cep,
          observacao
        FROM fornecedores
        WHERE ${clauses.map((clause) => `(${clause})`).join(' OR ')}
        ORDER BY id ASC
        LIMIT 1
      `,
      values
    );

    return rows[0] || null;
  }

  static async ensureDefaultProviders(connection = pool) {
    const providers = [];

    for (const provider of this.PROVIDERS) {
      const supplierRow = await this.findProviderSupplier(connection, provider);

      if (supplierRow) {
        providers.push({
          ...this.buildProviderSnapshot(provider, supplierRow),
          id: supplierRow.id
        });
        continue;
      }

      const [result] = await connection.query(
        `
          INSERT INTO fornecedores (
            nome,
            endereco,
            cidade,
            cep,
            observacao
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          provider.nome,
          provider.endereco,
          provider.cidade,
          provider.cep,
          provider.observacao
        ]
      );

      providers.push({
        ...this.buildProviderSnapshot(provider),
        id: result.insertId
      });
    }

    return providers;
  }

  static async getProviderOptions() {
    return this.ensureDefaultProviders();
  }

  static async findFornecedorById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          nome,
          endereco,
          cidade,
          cep,
          observacao
        FROM fornecedores
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async findFornecedorByName(nome, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          nome,
          endereco,
          cidade,
          cep,
          observacao
        FROM fornecedores
        WHERE TRIM(nome) = ?
        ORDER BY id ASC
        LIMIT 1
      `,
      [String(nome || '').trim()]
    );

    return rows[0] || null;
  }

  static async createFornecedorFromName(connection, nome) {
    const [result] = await connection.query(
      `
        INSERT INTO fornecedores (
          nome,
          observacao
        ) VALUES (?, ?)
      `,
      [
        nome,
        'Cadastro criado automaticamente pelo encaminhamento de tratamento externo.'
      ]
    );

    return this.findFornecedorById(result.insertId, connection);
  }

  static buildGenericProvider(fornecedor) {
    return {
      id: fornecedor.id,
      key: 'EXTERNO',
      nome: fornecedor.nome,
      cidade: fornecedor.cidade || '',
      endereco: fornecedor.endereco || '',
      cep: fornecedor.cep || '',
      observacao: fornecedor.observacao || '',
      servicos: [],
      dureza_padrao: '',
      profundidade_padrao: ''
    };
  }

  static normalizeProviderName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  static async resolveDispatchProvider(connection, idFornecedor, empresaDestino = '') {
    const providers = await this.ensureDefaultProviders(connection);

    if (Number.isInteger(idFornecedor)) {
      const specialProvider = providers.find((entry) => Number(entry.id) === Number(idFornecedor));

      if (specialProvider) {
        return specialProvider;
      }

      const fornecedor = await this.findFornecedorById(idFornecedor, connection);
      if (fornecedor) {
        return this.buildGenericProvider(fornecedor);
      }
    }

    const typedName = String(empresaDestino || '').trim();
    if (!typedName) {
      return null;
    }

    const specialProviderByName = providers.find(
      (entry) => this.normalizeProviderName(entry.nome) === this.normalizeProviderName(typedName)
    );

    if (specialProviderByName) {
      return specialProviderByName;
    }

    const fornecedorPorNome = await this.findFornecedorByName(typedName, connection);
    const fornecedor = fornecedorPorNome || await this.createFornecedorFromName(connection, typedName);
    return this.buildGenericProvider(fornecedor);
  }

  static buildWeightSnapshot(massaKg, quantidade) {
    if (!massaKg || Number(massaKg) <= 0) {
      return null;
    }

    return Number((Number(massaKg) * Number(quantidade)).toFixed(4));
  }

  static async findOpenRemessaByProvider(connection, idFornecedor) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          id_fornecedor,
          nome_empresa,
          status,
          numero_nf,
          data_nf,
          enviada_sem_nf,
          data_envio,
          observacao
        FROM terceirizacao_remessas
        WHERE id_fornecedor = ?
          AND status IN ('ENVIADA', 'RETORNO_PARCIAL')
          AND numero_nf IS NULL
          AND DATE(data_envio) = CURRENT_DATE()
        ORDER BY id DESC
        LIMIT 1
      `,
      [idFornecedor]
    );

    return rows[0] || null;
  }

  static async findPecaById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          codigo,
          descricao,
          massa_kg
        FROM pecas
        WHERE id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async findAll(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.empresa) {
      conditions.push('COALESCE(NULLIF(f.nome, \'\'), r.nome_empresa) LIKE ?');
      values.push(`%${filters.empresa}%`);
    }

    if (filters.status === 'ATIVAS') {
      conditions.push("r.status IN ('ENVIADA', 'RETORNO_PARCIAL')");
    } else if (filters.status === 'ENCERRADAS') {
      conditions.push("r.status IN ('RETORNO_TOTAL', 'CANCELADA')");
    } else if (filters.status === 'PENDENTES_NF') {
      conditions.push("r.status IN ('ENVIADA', 'RETORNO_PARCIAL')");
      conditions.push("(r.numero_nf IS NULL OR r.numero_nf = '')");
    } else if (filters.status) {
      conditions.push('r.status = ?');
      values.push(filters.status);
    }

    if (filters.nf) {
      conditions.push('COALESCE(r.numero_nf, \'\') LIKE ?');
      values.push(`%${filters.nf}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          r.id,
          r.id_fornecedor,
          COALESCE(NULLIF(f.nome, ''), r.nome_empresa) AS nome_empresa,
          r.status,
          r.numero_nf,
          r.data_nf,
          r.enviada_sem_nf,
          r.data_envio,
          r.observacao,
          f.endereco,
          f.cidade,
          f.cep,
          COALESCE(GROUP_CONCAT(DISTINCT p.codigo ORDER BY p.codigo SEPARATOR ' | '), '') AS pecas_codigos,
          COUNT(ri.id) AS total_itens,
          COALESCE(SUM(ri.quantidade_enviada), 0) AS quantidade_enviada_total,
          COALESCE(SUM(ri.quantidade_retorno), 0) AS quantidade_retorno_total,
          COALESCE(SUM(
            CASE
              WHEN COALESCE(ri.encerrado_manualmente, 0) = 1 THEN 0
              ELSE GREATEST(ri.quantidade_enviada - ri.quantidade_retorno, 0)
            END
          ), 0) AS quantidade_pendente_total,
          COALESCE(SUM(CASE WHEN COALESCE(ri.encerrado_manualmente, 0) = 1 THEN 1 ELSE 0 END), 0) AS itens_encerrados_manualmente,
          COALESCE(SUM(ri.peso_total_enviado_kg), 0) AS peso_total_enviado_kg
        FROM terceirizacao_remessas r
        INNER JOIN fornecedores f ON f.id = r.id_fornecedor
        LEFT JOIN terceirizacao_remessa_itens ri ON ri.id_remessa = r.id
        LEFT JOIN pecas p ON p.id = ri.id_peca
        WHERE ${conditions.join(' AND ')}
        GROUP BY
          r.id,
          r.id_fornecedor,
          f.nome,
          r.nome_empresa,
          r.status,
          r.numero_nf,
          r.data_nf,
          r.enviada_sem_nf,
          r.data_envio,
          r.observacao,
          f.endereco,
          f.cidade,
          f.cep
        ORDER BY r.id DESC
      `,
      values
    );

    return rows;
  }

  static async findById(id, connection = pool) {
    const [remessas] = await connection.query(
      `
        SELECT
          r.id,
          r.id_fornecedor,
          COALESCE(NULLIF(f.nome, ''), r.nome_empresa) AS nome_empresa,
          r.status,
          r.numero_nf,
          r.data_nf,
          r.enviada_sem_nf,
          r.data_envio,
          r.observacao,
          f.endereco,
          f.cidade,
          f.cep
        FROM terceirizacao_remessas r
        INNER JOIN fornecedores f ON f.id = r.id_fornecedor
        WHERE r.id = ?
      `,
      [id]
    );

    const remessa = remessas[0] || null;
    if (!remessa) {
      return null;
    }

    const [items] = await connection.query(
      `
        SELECT
          ri.id,
          ri.id_remessa,
          ri.id_peca,
          ri.tipo_tratamento,
          ri.servicos,
          ri.dureza_hrc,
          ri.profundidade,
          ri.quantidade_enviada,
          ri.quantidade_retorno,
          ri.massa_unitaria_kg,
          ri.peso_total_enviado_kg,
          ri.observacao,
          COALESCE(ri.encerrado_manualmente, 0) AS encerrado_manualmente,
          ri.justificativa_encerramento,
          ri.data_encerramento,
          CASE
            WHEN COALESCE(ri.encerrado_manualmente, 0) = 1 THEN 0
            ELSE GREATEST(ri.quantidade_enviada - ri.quantidade_retorno, 0)
          END AS quantidade_pendente,
          ri.status,
          ri.created_at,
          ri.updated_at,
          p.codigo,
          p.descricao
        FROM terceirizacao_remessa_itens ri
        INNER JOIN pecas p ON p.id = ri.id_peca
        WHERE ri.id_remessa = ?
        ORDER BY p.codigo ASC, ri.id ASC
      `,
      [id]
    );

    return {
      ...remessa,
      itens: items
    };
  }

  static async findPendingReturnItems(filters = {}) {
    const conditions = [
      "r.status IN ('ENVIADA', 'RETORNO_PARCIAL')",
      'ri.quantidade_enviada > ri.quantidade_retorno',
      'COALESCE(ri.encerrado_manualmente, 0) = 0'
    ];
    const values = [];

    if (filters.codigo) {
      conditions.push('p.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('p.descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          ri.id AS id_item,
          ri.id_remessa,
          ri.id_peca,
          ri.tipo_tratamento,
          ri.servicos,
          ri.dureza_hrc,
          ri.profundidade,
          ri.quantidade_enviada,
          ri.quantidade_retorno,
          CASE
            WHEN COALESCE(ri.encerrado_manualmente, 0) = 1 THEN 0
            ELSE GREATEST(ri.quantidade_enviada - ri.quantidade_retorno, 0)
          END AS quantidade_pendente,
          COALESCE(ri.encerrado_manualmente, 0) AS encerrado_manualmente,
          ri.justificativa_encerramento,
          ri.data_encerramento,
          ri.status AS item_status,
          ri.updated_at,
          p.codigo,
          p.descricao,
          COALESCE(NULLIF(f.nome, ''), r.nome_empresa) AS nome_empresa,
          r.numero_nf,
          r.data_envio,
          r.status AS remessa_status
        FROM terceirizacao_remessa_itens ri
        INNER JOIN terceirizacao_remessas r ON r.id = ri.id_remessa
        INNER JOIN pecas p ON p.id = ri.id_peca
        INNER JOIN fornecedores f ON f.id = r.id_fornecedor
        WHERE ${conditions.join(' AND ')}
        ORDER BY r.data_envio ASC, r.id ASC, p.codigo ASC, ri.id ASC
      `,
      values
    );

    return rows;
  }

  static async updateRemessaStatus(connection, idRemessa) {
    const [rows] = await connection.query(
      `
        SELECT
          COUNT(*) AS total_itens,
          SUM(CASE WHEN status = 'RETORNADO' OR COALESCE(encerrado_manualmente, 0) = 1 THEN 1 ELSE 0 END) AS retornados,
          SUM(CASE WHEN status = 'RETORNO_PARCIAL' THEN 1 ELSE 0 END) AS retorno_parcial
        FROM terceirizacao_remessa_itens
        WHERE id_remessa = ?
      `,
      [idRemessa]
    );

    const resumo = rows[0];
    let novoStatus = 'ENVIADA';

    if (Number(resumo.retornados || 0) === Number(resumo.total_itens || 0) && Number(resumo.total_itens || 0) > 0) {
      novoStatus = 'RETORNO_TOTAL';
    } else if (Number(resumo.retornados || 0) > 0 || Number(resumo.retorno_parcial || 0) > 0) {
      novoStatus = 'RETORNO_PARCIAL';
    }

    await connection.query(
      `
        UPDATE terceirizacao_remessas
        SET status = ?
        WHERE id = ?
      `,
      [novoStatus, idRemessa]
    );
  }

  static async createOrAppendDispatch(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const provider = await this.resolveDispatchProvider(connection, data.id_fornecedor, data.empresa_destino);

      if (!provider) {
        throw this.createBusinessError('Empresa de tratamento nao encontrada.');
      }

      const peca = await this.findPecaById(data.id_peca, connection);
      if (!peca) {
        throw this.createBusinessError('Peca nao encontrada para encaminhamento.');
      }

      await TratamentoExternoModel.consumeForDispatch(connection, {
        id_peca: data.id_peca,
        quantidade: data.quantidade,
        observacao: `Encaminhamento para ${provider.nome}.`.slice(0, 255)
      });

      let remessa = await this.findOpenRemessaByProvider(connection, provider.id);

      if (!remessa) {
        const [result] = await connection.query(
          `
            INSERT INTO terceirizacao_remessas (
              id_fornecedor,
              nome_empresa,
              status,
              numero_nf,
              data_nf,
              enviada_sem_nf,
              observacao
            ) VALUES (?, ?, 'ENVIADA', ?, ?, ?, ?)
          `,
          [
            provider.id,
            provider.nome,
            data.numero_nf || null,
            data.data_nf || null,
            data.numero_nf || data.data_nf ? 0 : 1,
            data.observacao || null
          ]
        );

        remessa = await this.findById(result.insertId, connection);
      } else if (data.numero_nf || data.data_nf) {
        await connection.query(
          `
            UPDATE terceirizacao_remessas
            SET
              numero_nf = ?,
              data_nf = ?,
              enviada_sem_nf = 0
            WHERE id = ?
          `,
          [data.numero_nf || null, data.data_nf || null, remessa.id]
        );
      }

      const pesoTotal = this.buildWeightSnapshot(peca.massa_kg, data.quantidade);

      const [itemResult] = await connection.query(
        `
          INSERT INTO terceirizacao_remessa_itens (
            id_remessa,
            id_peca,
            tipo_tratamento,
            servicos,
            dureza_hrc,
            profundidade,
            quantidade_enviada,
            massa_unitaria_kg,
            peso_total_enviado_kg,
            observacao
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          remessa.id,
          data.id_peca,
          data.tipo_tratamento,
          data.servicos || null,
          data.dureza_hrc || null,
          data.profundidade || null,
          data.quantidade,
          peca.massa_kg || null,
          pesoTotal,
          data.observacao || null
        ]
      );

      await connection.commit();

      const remessaAtualizada = await this.findById(remessa.id);
      return {
        remessa: remessaAtualizada,
        item: remessaAtualizada.itens.find((entry) => Number(entry.id) === Number(itemResult.insertId)) || null
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateNf(idRemessa, data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const remessa = await this.findById(idRemessa, connection);
      if (!remessa) {
        throw this.createBusinessError('Remessa nao encontrada.');
      }

      await connection.query(
        `
          UPDATE terceirizacao_remessas
          SET
            numero_nf = ?,
            data_nf = ?,
            enviada_sem_nf = ?,
            observacao = ?
          WHERE id = ?
        `,
        [
          data.numero_nf || null,
          data.data_nf || null,
          data.numero_nf || data.data_nf ? 0 : 1,
          data.observacao || remessa.observacao || null,
          idRemessa
        ]
      );

      await connection.commit();
      return this.findById(idRemessa);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async registerReturn(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
          SELECT
            ri.id,
            ri.id_remessa,
            ri.id_peca,
            ri.quantidade_enviada,
            ri.quantidade_retorno,
            COALESCE(ri.encerrado_manualmente, 0) AS encerrado_manualmente,
            ri.status,
            p.codigo,
            p.descricao
          FROM terceirizacao_remessa_itens ri
          INNER JOIN pecas p ON p.id = ri.id_peca
          WHERE ri.id = ?
          FOR UPDATE
        `,
        [data.id_item]
      );

      const item = rows[0] || null;
      if (!item) {
        throw this.createBusinessError('Item da remessa nao encontrado.');
      }

      if (Number(item.encerrado_manualmente || 0) === 1) {
        throw this.createBusinessError('Este item ja foi encerrado manualmente e nao aceita novo retorno.');
      }

      const pendente = Number((Number(item.quantidade_enviada) - Number(item.quantidade_retorno)).toFixed(2));
      const quantidadeRetorno = Number(Number(data.quantidade_retorno).toFixed(2));

      if (quantidadeRetorno <= 0) {
        throw this.createBusinessError('Informe uma quantidade de retorno maior que zero.');
      }

      if (quantidadeRetorno > pendente) {
        throw this.createBusinessError('A quantidade de retorno e maior que o saldo pendente da remessa.');
      }

      const observacaoRetorno = `Retorno de terceirizacao de ${item.codigo} - ${item.descricao}.`.slice(0, 255);

      if (data.destino_tipo === 'MATERIA_PRIMA') {
        const codigoMateriaPrimaDestino = this.buildMateriaPrimaReturnCode(item.codigo);
        const materiaPrimaDestino = await EstoqueMateriaPrimaModel.findMateriaPrimaByCode(codigoMateriaPrimaDestino, connection);

        if (!materiaPrimaDestino) {
          throw this.createBusinessError(
            `Nao existe materia-prima cadastrada com o codigo ${codigoMateriaPrimaDestino} para receber este retorno.`
          );
        }

        await EstoqueMateriaPrimaModel.registerThirdPartyReturn(connection, {
          id_materia_prima: materiaPrimaDestino.id,
          quantidade: quantidadeRetorno,
          observacao: observacaoRetorno
        });
      } else {
        await TratamentoExternoModel.receiveFromThirdParty(connection, {
          id_peca: item.id_peca,
          quantidade: quantidadeRetorno,
          id_estoque_destino: data.id_estoque_destino,
          observacao: observacaoRetorno
        });
      }

      const novoRetorno = Number((Number(item.quantidade_retorno) + quantidadeRetorno).toFixed(2));
      const novoStatus = novoRetorno >= Number(item.quantidade_enviada) ? 'RETORNADO' : 'RETORNO_PARCIAL';

      await connection.query(
        `
          UPDATE terceirizacao_remessa_itens
          SET
            quantidade_retorno = ?,
            status = ?
          WHERE id = ?
        `,
        [novoRetorno, novoStatus, data.id_item]
      );

      await this.updateRemessaStatus(connection, item.id_remessa);

      await connection.commit();
      return this.findById(item.id_remessa);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async finalizePendingItem(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
          SELECT
            ri.id,
            ri.id_remessa,
            ri.id_peca,
            ri.quantidade_enviada,
            ri.quantidade_retorno,
            COALESCE(ri.encerrado_manualmente, 0) AS encerrado_manualmente,
            ri.status,
            p.codigo,
            p.descricao
          FROM terceirizacao_remessa_itens ri
          INNER JOIN pecas p ON p.id = ri.id_peca
          WHERE ri.id = ?
          FOR UPDATE
        `,
        [data.id_item]
      );

      const item = rows[0] || null;
      if (!item) {
        throw this.createBusinessError('Item da remessa nao encontrado.');
      }

      const pendente = Number((Number(item.quantidade_enviada) - Number(item.quantidade_retorno)).toFixed(2));
      if (pendente <= 0) {
        throw this.createBusinessError('Este item nao possui saldo pendente para encerramento.');
      }

      if (Number(item.encerrado_manualmente || 0) === 1) {
        throw this.createBusinessError('Este item ja foi encerrado manualmente.');
      }

      if (!data.justificativa) {
        throw this.createBusinessError('Informe a justificativa para finalizar a pendencia.');
      }

      await connection.query(
        `
          UPDATE terceirizacao_remessa_itens
          SET
            encerrado_manualmente = 1,
            justificativa_encerramento = ?,
            data_encerramento = NOW(),
            status = 'RETORNADO'
          WHERE id = ?
        `,
        [data.justificativa, data.id_item]
      );

      await this.updateRemessaStatus(connection, item.id_remessa);

      await connection.commit();
      return this.findById(item.id_remessa);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = TerceirizacaoRemessaModel;
