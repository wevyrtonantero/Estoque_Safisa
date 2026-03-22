-- Saldos e movimentacoes da etapa de tratamento externo.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

CREATE TABLE IF NOT EXISTS tratamento_externo_saldos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_peca INT NOT NULL,
  quantidade DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_te_saldos_peca
    FOREIGN KEY (id_peca) REFERENCES pecas(id),
  CONSTRAINT chk_te_saldos_quantidade
    CHECK (quantidade >= 0),
  CONSTRAINT uq_te_saldos_peca UNIQUE (id_peca),
  INDEX idx_te_saldos_peca (id_peca)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tratamento_externo_movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_peca INT NOT NULL,
  id_producao_ordem INT NULL,
  tipo_movimentacao ENUM('ENTRADA_PRODUCAO', 'AJUSTE', 'SAIDA') NOT NULL,
  quantidade DECIMAL(12, 2) NOT NULL,
  saldo_resultante DECIMAL(12, 2) NULL,
  observacao VARCHAR(255) NULL,
  data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_te_mov_peca
    FOREIGN KEY (id_peca) REFERENCES pecas(id),
  CONSTRAINT fk_te_mov_producao
    FOREIGN KEY (id_producao_ordem) REFERENCES producao_ordens(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_te_mov_quantidade
    CHECK (quantidade > 0),
  INDEX idx_te_mov_peca (id_peca),
  INDEX idx_te_mov_producao (id_producao_ordem),
  INDEX idx_te_mov_data (data_movimentacao)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
