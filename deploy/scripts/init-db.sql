-- ShadowLink Database Initialization
-- This script runs on first MySQL container start

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ── Work Modes ──
CREATE TABLE IF NOT EXISTS `work_mode` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `mode_id` VARCHAR(64) NOT NULL UNIQUE COMMENT 'Unique mode identifier',
    `name` VARCHAR(128) NOT NULL COMMENT 'Display name',
    `description` TEXT COMMENT 'Mode description',
    `icon` VARCHAR(32) DEFAULT '' COMMENT 'Icon emoji or name',
    `theme_config` JSON COMMENT 'UI theme overrides',
    `agent_config` JSON COMMENT 'Agent strategy overrides',
    `system_prompt` TEXT COMMENT 'Mode-specific system prompt',
    `tools_config` JSON COMMENT 'Enabled tools list',
    `sort_order` INT DEFAULT 0,
    `is_builtin` TINYINT DEFAULT 0 COMMENT '1=system preset, 0=user-created',
    `deleted` TINYINT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Chat Sessions ──
CREATE TABLE IF NOT EXISTS `chat_session` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `session_id` VARCHAR(64) NOT NULL UNIQUE,
    `mode_id` VARCHAR(64) NOT NULL DEFAULT 'general',
    `title` VARCHAR(256) DEFAULT '',
    `deleted` TINYINT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_mode_id` (`mode_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Chat Messages ──
CREATE TABLE IF NOT EXISTS `chat_message` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `session_id` VARCHAR(64) NOT NULL,
    `role` VARCHAR(16) NOT NULL COMMENT 'user | assistant | system | tool',
    `content` MEDIUMTEXT,
    `token_count` INT DEFAULT 0,
    `model` VARCHAR(128) DEFAULT '',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_session_id` (`session_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── RAG Trace Logs ──
CREATE TABLE IF NOT EXISTS `rag_trace_log` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `trace_id` VARCHAR(64) NOT NULL UNIQUE,
    `session_id` VARCHAR(64) DEFAULT '',
    `mode_id` VARCHAR(64) DEFAULT 'general',
    `original_query` TEXT,
    `rewritten_query` TEXT,
    `retrieval_method` VARCHAR(64) DEFAULT '',
    `retrieved_count` INT DEFAULT 0,
    `after_rerank_count` INT DEFAULT 0,
    `total_latency_ms` DOUBLE DEFAULT 0,
    `quality_metrics` JSON COMMENT '{"recall":0.8,"precision":0.7,"relevance":0.9}',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_session_id` (`session_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Agent Execution Logs ──
CREATE TABLE IF NOT EXISTS `agent_execution_log` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `execution_id` VARCHAR(64) NOT NULL UNIQUE,
    `session_id` VARCHAR(64) DEFAULT '',
    `mode_id` VARCHAR(64) DEFAULT 'general',
    `strategy` VARCHAR(32) DEFAULT 'react' COMMENT 'react | plan_execute | multi_agent',
    `total_steps` INT DEFAULT 0,
    `total_tokens` INT DEFAULT 0,
    `total_latency_ms` DOUBLE DEFAULT 0,
    `status` VARCHAR(16) DEFAULT 'running' COMMENT 'running | success | failed | cancelled',
    `error_message` TEXT,
    `steps_json` JSON COMMENT 'Array of step details',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `finished_at` DATETIME,
    INDEX `idx_session_id` (`session_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Default Work Modes ──
INSERT INTO `work_mode` (`mode_id`, `name`, `description`, `icon`, `is_builtin`, `sort_order`) VALUES
('general', 'General Assistant', 'Default general-purpose AI assistant', 'S', 1, 0),
('code', 'Code Workshop', 'Software development focused mode', 'C', 1, 1),
('research', 'Deep Research', 'Academic and technical research mode', 'R', 1, 2),
('writing', 'Creative Writing', 'Content creation and editing mode', 'W', 1, 3);
