CREATE TABLE IF NOT EXISTS etiquetas (
  id INT NOT NULL AUTO_INCREMENT,
  id_peca INT NOT NULL,
  codigo_item VARCHAR(80) NOT NULL,
  categoria VARCHAR(40) NOT NULL DEFAULT 'SERVO_COM_KIT',
  titulo VARCHAR(160) NOT NULL,
  aplicacao_linha_1 VARCHAR(255) NOT NULL,
  aplicacao_linha_2 VARCHAR(255) NULL,
  aplicacao_linha_3 VARCHAR(255) NULL,
  codigo_barras VARCHAR(160) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  layout_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_etiquetas_id_peca (id_peca),
  UNIQUE KEY uq_etiquetas_codigo_item (codigo_item),
  KEY idx_etiquetas_categoria (categoria),
  KEY idx_etiquetas_ativo (ativo),
  CONSTRAINT fk_etiquetas_peca
    FOREIGN KEY (id_peca) REFERENCES pecas (id)
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS etiqueta_historico_impressao (
  id BIGINT NOT NULL AUTO_INCREMENT,
  id_etiqueta INT NOT NULL,
  id_peca INT NOT NULL,
  codigo_item VARCHAR(80) NOT NULL,
  codigo_pedido VARCHAR(80) NULL,
  numero_serie VARCHAR(40) NOT NULL,
  impressora_nome VARCHAR(160) NULL,
  id_usuario INT NULL,
  usuario_nome VARCHAR(120) NULL,
  dados_pedido_json JSON NULL,
  zpl_gerado MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_etiqueta_historico_etiqueta (id_etiqueta),
  KEY idx_etiqueta_historico_codigo_item (codigo_item),
  KEY idx_etiqueta_historico_pedido (codigo_pedido),
  KEY idx_etiqueta_historico_numero_serie (numero_serie),
  CONSTRAINT fk_etiqueta_historico_etiqueta
    FOREIGN KEY (id_etiqueta) REFERENCES etiquetas (id)
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
