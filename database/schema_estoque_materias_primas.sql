-- Saldos e movimentacoes do estoque de materias-primas.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

CREATE TABLE IF NOT EXISTS estoque_materias_primas_saldos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_materia_prima INT NOT NULL,
  quantidade DECIMAL(12, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_saldos_materia_prima
    FOREIGN KEY (id_materia_prima) REFERENCES materias_primas(id),
  CONSTRAINT uq_emp_saldos_materia_prima UNIQUE (id_materia_prima),
  INDEX idx_emp_saldos_materia_prima (id_materia_prima)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estoque_materias_primas_movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_materia_prima INT NOT NULL,
  id_producao_ordem INT NULL,
  tipo_movimentacao ENUM('ENTRADA', 'AJUSTE', 'CONSUMO_PRODUCAO') NOT NULL,
  quantidade DECIMAL(12, 4) NOT NULL,
  unidade VARCHAR(20) NOT NULL,
  saldo_resultante DECIMAL(12, 4) NULL,
  observacao VARCHAR(255) NULL,
  data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_mov_materia_prima
    FOREIGN KEY (id_materia_prima) REFERENCES materias_primas(id),
  CONSTRAINT fk_emp_mov_producao
    FOREIGN KEY (id_producao_ordem) REFERENCES producao_ordens(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_emp_mov_quantidade
    CHECK (quantidade > 0),
  INDEX idx_emp_mov_materia_prima (id_materia_prima),
  INDEX idx_emp_mov_producao (id_producao_ordem),
  INDEX idx_emp_mov_data (data_movimentacao)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
