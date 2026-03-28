-- Remessas de terceirizacao para tratamento externo.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

CREATE TABLE IF NOT EXISTS terceirizacao_remessas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_fornecedor INT NOT NULL,
  nome_empresa VARCHAR(150) NOT NULL,
  status ENUM('ENVIADA', 'RETORNO_PARCIAL', 'RETORNO_TOTAL', 'CANCELADA') NOT NULL DEFAULT 'ENVIADA',
  numero_nf VARCHAR(60) NULL,
  data_nf DATE NULL,
  enviada_sem_nf TINYINT(1) NOT NULL DEFAULT 1,
  data_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacao VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_terc_remessa_fornecedor
    FOREIGN KEY (id_fornecedor) REFERENCES fornecedores(id),
  INDEX idx_terc_remessa_fornecedor (id_fornecedor),
  INDEX idx_terc_remessa_status (status),
  INDEX idx_terc_remessa_data_envio (data_envio)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS terceirizacao_remessa_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_remessa INT NOT NULL,
  id_peca INT NOT NULL,
  tipo_tratamento VARCHAR(40) NOT NULL,
  servicos VARCHAR(255) NULL,
  dureza_hrc VARCHAR(60) NULL,
  profundidade VARCHAR(60) NULL,
  quantidade_enviada DECIMAL(12, 2) NOT NULL,
  quantidade_retorno DECIMAL(12, 2) NOT NULL DEFAULT 0,
  massa_unitaria_kg DECIMAL(10, 4) NULL,
  peso_total_enviado_kg DECIMAL(12, 4) NULL,
  observacao VARCHAR(255) NULL,
  encerrado_manualmente TINYINT(1) NOT NULL DEFAULT 0,
  justificativa_encerramento VARCHAR(255) NULL,
  data_encerramento DATETIME NULL,
  status ENUM('ENVIADO', 'RETORNO_PARCIAL', 'RETORNADO') NOT NULL DEFAULT 'ENVIADO',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_terc_item_remessa
    FOREIGN KEY (id_remessa) REFERENCES terceirizacao_remessas(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_terc_item_peca
    FOREIGN KEY (id_peca) REFERENCES pecas(id),
  INDEX idx_terc_item_remessa (id_remessa),
  INDEX idx_terc_item_peca (id_peca),
  INDEX idx_terc_item_status (status),
  INDEX idx_terc_item_encerrado (encerrado_manualmente)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
