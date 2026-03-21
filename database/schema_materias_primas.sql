-- Estrutura oficial do modulo de materias-primas.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

-- Remove o schema antigo para alinhar com o modulo atual.
DROP TABLE IF EXISTS materia_prima_fornecedor;
DROP TABLE IF EXISTS materias_primas;

CREATE TABLE materias_primas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL,
  nome VARCHAR(150) NOT NULL,
  geometria VARCHAR(100) NOT NULL,
  bitola VARCHAR(100) NOT NULL,
  peso_por_metro DECIMAL(10, 4) NOT NULL,
  estoque_minimo DECIMAL(10, 3) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_materias_primas_codigo (codigo),
  INDEX idx_materias_primas_nome (nome),
  INDEX idx_materias_primas_geometria (geometria),
  INDEX idx_materias_primas_bitola (bitola)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
