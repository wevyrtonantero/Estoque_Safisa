CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

CREATE TABLE IF NOT EXISTS solicitacoes_producao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  area_origem ENUM('EXPEDICAO', 'MONTAGEM') NOT NULL,
  id_peca INT NOT NULL,
  quantidade_solicitada DECIMAL(12, 2) NOT NULL,
  status ENUM(
    'PENDENTE',
    'EM_ANALISE',
    'EM_PRODUCAO',
    'CONCLUIDA',
    'CANCELADA'
  ) NOT NULL DEFAULT 'PENDENTE',
  observacao VARCHAR(255) NULL,
  data_solicitacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_status DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_solicitacao_producao_peca
    FOREIGN KEY (id_peca) REFERENCES pecas(id),
  CONSTRAINT chk_solicitacao_producao_quantidade
    CHECK (quantidade_solicitada > 0),
  INDEX idx_solicitacao_producao_area (area_origem),
  INDEX idx_solicitacao_producao_status (status),
  INDEX idx_solicitacao_producao_data (data_solicitacao)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
