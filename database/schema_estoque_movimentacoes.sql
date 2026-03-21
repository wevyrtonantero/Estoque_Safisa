-- Historico das movimentacoes entre os estoques operacionais.
CREATE DATABASE IF NOT EXISTS safisa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisa;

CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_peca INT NOT NULL,
  id_estoque_origem INT NULL,
  id_estoque_destino INT NULL,
  tipo_movimentacao ENUM('ENTRADA_INICIAL', 'TRANSFERENCIA', 'AJUSTE', 'SAIDA') NOT NULL,
  quantidade DECIMAL(10, 2) NOT NULL,
  observacao VARCHAR(255) NULL,
  data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_estoque_movimentacoes_peca
    FOREIGN KEY (id_peca) REFERENCES pecas (id),
  CONSTRAINT fk_estoque_movimentacoes_origem
    FOREIGN KEY (id_estoque_origem) REFERENCES estoques (id),
  CONSTRAINT fk_estoque_movimentacoes_destino
    FOREIGN KEY (id_estoque_destino) REFERENCES estoques (id),
  CONSTRAINT chk_estoque_movimentacoes_quantidade
    CHECK (quantidade > 0),
  INDEX idx_estoque_movimentacoes_peca (id_peca),
  INDEX idx_estoque_movimentacoes_origem (id_estoque_origem),
  INDEX idx_estoque_movimentacoes_destino (id_estoque_destino),
  INDEX idx_estoque_movimentacoes_data (data_movimentacao)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
