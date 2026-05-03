-- Relatorio estruturado das saidas finais registradas pela Expedicao.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

CREATE TABLE IF NOT EXISTS expedicao_saidas (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tipo_saida VARCHAR(30) NOT NULL DEFAULT 'VENDA',
  observacao VARCHAR(255) NULL,
  id_usuario INT NULL,
  usuario_login VARCHAR(80) NULL,
  usuario_nome VARCHAR(120) NULL,
  data_saida TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exp_saidas_data (data_saida),
  KEY idx_exp_saidas_tipo (tipo_saida)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expedicao_saida_itens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  id_saida BIGINT NOT NULL,
  solicitacao_ref INT NOT NULL,
  id_peca_solicitada INT NOT NULL,
  codigo_solicitado VARCHAR(80) NOT NULL,
  descricao_solicitada VARCHAR(255) NOT NULL,
  classificacao_solicitada VARCHAR(30) NOT NULL,
  quantidade_solicitada DECIMAL(10, 2) NOT NULL,
  quantidade_pronta DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantidade_composicao_venda DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantidade_componentes DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exp_saida_itens_saida (id_saida),
  KEY idx_exp_saida_itens_ref (id_saida, solicitacao_ref),
  KEY idx_exp_saida_itens_peca (id_peca_solicitada),
  CONSTRAINT fk_exp_saida_itens_saida
    FOREIGN KEY (id_saida) REFERENCES expedicao_saidas (id)
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expedicao_saida_baixas (
  id BIGINT NOT NULL AUTO_INCREMENT,
  id_saida BIGINT NOT NULL,
  id_saida_item BIGINT NOT NULL,
  id_movimentacao_estoque INT NULL,
  id_peca_baixada INT NOT NULL,
  codigo_baixado VARCHAR(80) NOT NULL,
  descricao_baixado VARCHAR(255) NOT NULL,
  classificacao_baixada VARCHAR(30) NOT NULL,
  quantidade_baixada DECIMAL(10, 2) NOT NULL,
  forma_atendimento VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exp_saida_baixas_saida (id_saida),
  KEY idx_exp_saida_baixas_item (id_saida_item),
  KEY idx_exp_saida_baixas_peca (id_peca_baixada),
  KEY idx_exp_saida_baixas_forma (forma_atendimento),
  CONSTRAINT fk_exp_saida_baixas_saida
    FOREIGN KEY (id_saida) REFERENCES expedicao_saidas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exp_saida_baixas_item
    FOREIGN KEY (id_saida_item) REFERENCES expedicao_saida_itens (id)
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
