-- Cria o banco principal do modulo SAFISA.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

-- Recria a base da tabela pecas para garantir a estrutura atual.
DROP TABLE IF EXISTS estrutura_submontagem;
DROP TABLE IF EXISTS peca_fornecedor;
DROP TABLE IF EXISTS pecas;

-- Cria a tabela de pecas, incluindo itens simples e submontagens.
CREATE TABLE pecas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  codigo VARCHAR(100) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  comprimento_mm DECIMAL(10, 2) NULL,
  tipo ENUM('COMPRADA', 'PRODUZIDA') NOT NULL,
  classificacao ENUM('ITEM', 'SUBMONTAGEM') NOT NULL DEFAULT 'ITEM',
  id_materia_prima INT NULL,
  id_fornecedor INT NULL,
  id_maquina INT NULL,
  estoque_minimo INT NULL,
  estoque_seguranca INT NULL,
  consumo_mensal DECIMAL(10, 2) NULL,
  massa_kg DECIMAL(10, 3) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pecas_codigo (codigo),
  INDEX idx_pecas_classificacao (classificacao),
  INDEX idx_pecas_tipo (tipo),
  INDEX idx_pecas_ativo (ativo)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
