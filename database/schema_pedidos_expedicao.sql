CREATE TABLE IF NOT EXISTS pedidos_expedicao (
  id BIGINT NOT NULL AUTO_INCREMENT,
  codigo_pedido VARCHAR(20) NULL,
  cliente_nome VARCHAR(160) NOT NULL,
  cidade VARCHAR(120) NOT NULL,
  data_pedido DATE NOT NULL,
  observacao TEXT NULL,
  possui_nota_fiscal TINYINT(1) NOT NULL DEFAULT 0,
  numero_nota_fiscal VARCHAR(80) NULL,
  transportadora VARCHAR(160) NULL,
  vendedora VARCHAR(120) NULL,
  peso_total_override_kg DECIMAL(10, 3) NULL,
  quantidade_volumes INT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'AGUARDANDO MONTAGEM',
  prioridade_ordem INT NOT NULL DEFAULT 0,
  data_coleta DATETIME NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pedidos_expedicao_codigo (codigo_pedido),
  KEY idx_pedidos_expedicao_status (status),
  KEY idx_pedidos_expedicao_prioridade (prioridade_ordem),
  KEY idx_pedidos_expedicao_cliente (cliente_nome),
  KEY idx_pedidos_expedicao_data (data_pedido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedido_expedicao_itens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  id_pedido BIGINT NOT NULL,
  id_peca INT NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  classificacao VARCHAR(40) NOT NULL,
  quantidade INT NOT NULL,
  massa_unitaria_kg DECIMAL(10, 3) NULL,
  exige_numero_serie TINYINT(1) NOT NULL DEFAULT 0,
  separado_avulso TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pedido_expedicao_itens_pedido (id_pedido),
  KEY idx_pedido_expedicao_itens_peca (id_peca),
  CONSTRAINT fk_pedido_expedicao_itens_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedidos_expedicao(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pedido_expedicao_itens_peca
    FOREIGN KEY (id_peca) REFERENCES pecas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedido_expedicao_item_seriais (
  id BIGINT NOT NULL AUTO_INCREMENT,
  id_pedido_item BIGINT NOT NULL,
  id_submontagem_serial BIGINT NOT NULL,
  numero_serie VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pedido_item_serial_registro (id_submontagem_serial),
  KEY idx_pedido_item_serial_item (id_pedido_item),
  CONSTRAINT fk_pedido_item_serial_item
    FOREIGN KEY (id_pedido_item) REFERENCES pedido_expedicao_itens(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pedido_item_serial_serial
    FOREIGN KEY (id_submontagem_serial) REFERENCES submontagem_seriais(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
