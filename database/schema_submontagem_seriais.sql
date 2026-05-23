CREATE TABLE IF NOT EXISTS submontagem_seriais (
  id BIGINT NOT NULL AUTO_INCREMENT,
  numero_sequencial BIGINT NOT NULL,
  numero_serie VARCHAR(20) NOT NULL,
  id_modelo_servo INT NOT NULL,
  modelo_servo_codigo VARCHAR(100) NOT NULL,
  modelo_servo_descricao VARCHAR(255) NOT NULL,
  data_montagem TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_montador INT NULL,
  montador_nome VARCHAR(120) NOT NULL,
  numero_pedido VARCHAR(80) NULL,
  data_saida TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_submontagem_seriais_numero_sequencial (numero_sequencial),
  UNIQUE KEY uq_submontagem_seriais_numero_serie (numero_serie),
  KEY idx_submontagem_seriais_modelo (id_modelo_servo),
  KEY idx_submontagem_seriais_data_montagem (data_montagem),
  KEY idx_submontagem_seriais_pedido (numero_pedido),
  KEY idx_submontagem_seriais_data_saida (data_saida)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
