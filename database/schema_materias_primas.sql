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
  categoria VARCHAR(30) NOT NULL DEFAULT 'TREFILADO',
  material VARCHAR(180) NULL,
  liga VARCHAR(120) NULL,
  geometria VARCHAR(100) NOT NULL,
  bitola VARCHAR(100) NULL,
  bitola_mm DECIMAL(10, 3) NULL,
  comprimento_padrao_mm DECIMAL(10, 2) NULL,
  peso_por_metro DECIMAL(10, 4) NULL,
  peso_unitario_kg DECIMAL(10, 4) NULL,
  densidade_g_cm3 DECIMAL(10, 4) NULL,
  estoque_minimo DECIMAL(10, 3) NOT NULL DEFAULT 0,
  unidade_estoque VARCHAR(20) NOT NULL DEFAULT 'KG',
  id_fornecedor_principal INT NULL,
  observacao VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_materias_primas_codigo (codigo),
  INDEX idx_materias_primas_categoria (categoria),
  INDEX idx_materias_primas_nome (nome),
  INDEX idx_materias_primas_material (material),
  INDEX idx_materias_primas_liga (liga),
  INDEX idx_materias_primas_geometria (geometria),
  INDEX idx_materias_primas_bitola (bitola),
  INDEX idx_materias_primas_fornecedor_principal (id_fornecedor_principal),
  CONSTRAINT fk_materias_primas_fornecedor_principal
    FOREIGN KEY (id_fornecedor_principal) REFERENCES fornecedores(id)
    ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
