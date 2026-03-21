USE safisa;

-- Recria a tabela da composicao interna de cada submontagem.
DROP TABLE IF EXISTS estrutura_submontagem;

CREATE TABLE estrutura_submontagem (
  id INT PRIMARY KEY AUTO_INCREMENT,
  id_submontagem INT NOT NULL,
  id_item_componente INT NOT NULL,
  quantidade DECIMAL(10, 2) NOT NULL DEFAULT 1,
  observacao VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_submontagem_componente UNIQUE (id_submontagem, id_item_componente),
  CONSTRAINT chk_submontagem_quantidade CHECK (quantidade > 0),
  CONSTRAINT fk_estrutura_submontagem
    FOREIGN KEY (id_submontagem) REFERENCES pecas(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_estrutura_item
    FOREIGN KEY (id_item_componente) REFERENCES pecas(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  INDEX idx_estrutura_submontagem (id_submontagem),
  INDEX idx_estrutura_item (id_item_componente)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
