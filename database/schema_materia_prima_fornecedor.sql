-- Vinculo de multiplos fornecedores por materia-prima.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

DROP TABLE IF EXISTS materia_prima_fornecedor;

CREATE TABLE materia_prima_fornecedor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_materia_prima INT NOT NULL,
  id_fornecedor INT NOT NULL,
  observacao VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_mpf_materia_prima
    FOREIGN KEY (id_materia_prima) REFERENCES materias_primas(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_mpf_fornecedor
    FOREIGN KEY (id_fornecedor) REFERENCES fornecedores(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_mpf_materia_prima_fornecedor UNIQUE (id_materia_prima, id_fornecedor),
  INDEX idx_mpf_materia_prima (id_materia_prima),
  INDEX idx_mpf_fornecedor (id_fornecedor)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
