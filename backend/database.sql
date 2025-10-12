-- Arquivo de configuração do banco de dados para "Crônicas de Aventuras"

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `license_key` VARCHAR(255) NOT NULL,
  `google_api_key_encrypted` TEXT, -- Armazenará a chave de API de forma criptografada
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `characters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `character_name` VARCHAR(255) NOT NULL,
  `character_data` JSON NOT NULL, -- O estado completo do personagem será armazenado aqui
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `game_sessions` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY, -- UUID para o ID da sessão
  `session_name` VARCHAR(255) NOT NULL,
  `game_state` JSON, -- Armazena o estado completo do jogo, incluindo logs, worldState, etc.
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `session_characters` (
  `session_id` VARCHAR(36) NOT NULL,
  `character_id` INT NOT NULL,
  PRIMARY KEY (`session_id`, `character_id`),
  FOREIGN KEY (`session_id`) REFERENCES `game_sessions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notas:
-- 1. `users.password` deve armazenar hashes de senha (ex: bcrypt), nunca senhas em texto puro.
-- 2. `users.google_api_key_encrypted` armazenará a chave de API do usuário criptografada usando a SECRET_KEY do servidor.
-- 3. `characters.character_data` é um campo JSON para flexibilidade máxima, armazenando a ficha completa do personagem.
-- 4. `game_sessions` e `session_characters` preparam a base para o modo multiplayer.
