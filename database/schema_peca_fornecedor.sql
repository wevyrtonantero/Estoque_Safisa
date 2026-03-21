-- Estrutura preparada porque uma peca pode ter varios fornecedores.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

DROP TABLE IF EXISTS peca_fornecedor;

CREATE TABLE peca_fornecedor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_peca INT NOT NULL,
  id_fornecedor INT NOT NULL,
  observacao VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pf_peca
    FOREIGN KEY (id_peca) REFERENCES pecas(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pf_fornecedor
    FOREIGN KEY (id_fornecedor) REFERENCES fornecedores(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_pf_peca_fornecedor UNIQUE (id_peca, id_fornecedor),
  INDEX idx_pf_peca (id_peca),
  INDEX idx_pf_fornecedor (id_fornecedor)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
