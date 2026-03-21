-- Estrutura oficial do modulo de fornecedores.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

-- Remove a tabela antiga para alinhar o schema ao modulo atual.
DROP TABLE IF EXISTS materia_prima_fornecedor;
DROP TABLE IF EXISTS peca_fornecedor;
DROP TABLE IF EXISTS fornecedores;

CREATE TABLE fornecedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  telefone VARCHAR(30) NULL,
  contato VARCHAR(100) NULL,
  email VARCHAR(150) NULL,
  cep VARCHAR(20) NULL,
  endereco VARCHAR(200) NULL,
  cidade VARCHAR(100) NULL,
  observacao TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fornecedores_nome (nome),
  INDEX idx_fornecedores_contato (contato),
  INDEX idx_fornecedores_cidade (cidade)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
