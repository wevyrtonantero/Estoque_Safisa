-- Estrutura dos saldos atuais por estoque e por item.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

CREATE TABLE IF NOT EXISTS estoque_saldos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_estoque INT NOT NULL,
  id_peca INT NOT NULL,
  quantidade DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_estoque_saldos_estoque
    FOREIGN KEY (id_estoque) REFERENCES estoques (id),
  CONSTRAINT fk_estoque_saldos_peca
    FOREIGN KEY (id_peca) REFERENCES pecas (id),
  CONSTRAINT chk_estoque_saldos_quantidade
    CHECK (quantidade >= 0),
  UNIQUE KEY uq_estoque_saldos_estoque_peca (id_estoque, id_peca),
  INDEX idx_estoque_saldos_estoque (id_estoque),
  INDEX idx_estoque_saldos_peca (id_peca)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
