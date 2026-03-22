-- Estrutura inicial do modulo de producao.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

DROP TABLE IF EXISTS producao_ordens;

CREATE TABLE producao_ordens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_maquina INT NOT NULL,
  id_peca INT NOT NULL,
  id_materia_prima INT NULL,
  quantidade_planejada INT NOT NULL,
  quantidade_produzida INT NULL,
  quantidade_refugo INT NULL,
  quantidade_consumida_materia_prima DECIMAL(12, 4) NULL,
  unidade_consumo VARCHAR(20) NULL,
  peso_consumido_kg DECIMAL(12, 4) NULL,
  comprimento_corte_mm DECIMAL(10, 2) NULL,
  status ENUM('EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA') NOT NULL DEFAULT 'EM_ANDAMENTO',
  observacao_inicio VARCHAR(255) NULL,
  observacao_fim VARCHAR(255) NULL,
  data_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_fim DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_producao_maquina
    FOREIGN KEY (id_maquina) REFERENCES maquinas(id),
  CONSTRAINT fk_producao_peca
    FOREIGN KEY (id_peca) REFERENCES pecas(id),
  CONSTRAINT fk_producao_materia_prima
    FOREIGN KEY (id_materia_prima) REFERENCES materias_primas(id),
  INDEX idx_producao_status (status),
  INDEX idx_producao_maquina (id_maquina),
  INDEX idx_producao_peca (id_peca),
  INDEX idx_producao_data_inicio (data_inicio)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
