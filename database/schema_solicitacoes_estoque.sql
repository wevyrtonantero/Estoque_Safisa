CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

CREATE TABLE IF NOT EXISTS solicitacoes_estoque (
  id INT AUTO_INCREMENT PRIMARY KEY,
  area_origem ENUM('EXPEDICAO', 'MONTAGEM') NOT NULL,
  id_peca INT NOT NULL,
  quantidade_solicitada DECIMAL(12, 2) NOT NULL,
  quantidade_atendida DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status ENUM(
    'PENDENTE',
    'EM_SEPARACAO',
    'ATENDIDA_PARCIAL',
    'ATENDIDA',
    'CANCELADA'
  ) NOT NULL DEFAULT 'PENDENTE',
  observacao VARCHAR(255) NULL,
  data_solicitacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_inicio_separacao DATETIME NULL,
  data_atendimento DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_solicitacao_peca
    FOREIGN KEY (id_peca) REFERENCES pecas(id),
  CONSTRAINT chk_solicitacao_quantidade
    CHECK (quantidade_solicitada > 0),
  CONSTRAINT chk_solicitacao_atendida
    CHECK (quantidade_atendida >= 0),
  INDEX idx_solicitacao_area (area_origem),
  INDEX idx_solicitacao_status (status),
  INDEX idx_solicitacao_data (data_solicitacao)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
