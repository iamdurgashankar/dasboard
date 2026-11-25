-- =============================================================================
-- DevInquire Production MySQL Database Schema & Initial Seed
-- Compatible with MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+ (Hostinger / cPanel / RDS)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table (Dashboard Admin, Developer, Viewer Accounts)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(191) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL DEFAULT 'DevInquire Admin',
    `role` VARCHAR(50) DEFAULT 'Admin',
    `status` VARCHAR(50) DEFAULT 'active',
    `avatar` VARCHAR(255) DEFAULT NULL,
    `join_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Projects Table (Client Projects & Milestone Tracking)
CREATE TABLE IF NOT EXISTS `projects` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `clientName` VARCHAR(150) DEFAULT NULL,
    `assignedDeveloper` VARCHAR(100) DEFAULT NULL,
    `assignedViewer` VARCHAR(150) DEFAULT NULL,
    `dueDate` VARCHAR(50) DEFAULT NULL,
    `updates` JSON DEFAULT NULL,
    `description` TEXT,
    `language` VARCHAR(100) DEFAULT 'TypeScript',
    `status` VARCHAR(50) DEFAULT 'active',
    `health` INT DEFAULT 100,
    `progress` INT DEFAULT 0,
    `repo_url` VARCHAR(255) DEFAULT NULL,
    `last_update` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tasks Table (Engineering Issues & Sprint Tasks)
CREATE TABLE IF NOT EXISTS `tasks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `project_id` INT DEFAULT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `assignee_id` INT DEFAULT NULL,
    `status` VARCHAR(50) DEFAULT 'todo',
    `priority` VARCHAR(50) DEFAULT 'Medium',
    `due_date` DATE DEFAULT NULL,
    `points` INT DEFAULT 0,
    `tags` JSON DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Subtasks Table
CREATE TABLE IF NOT EXISTS `subtasks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` INT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `completed` TINYINT(1) DEFAULT 0,
    `completed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Task Comments Table
CREATE TABLE IF NOT EXISTS `task_comments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` INT NOT NULL,
    `user_id` INT DEFAULT NULL,
    `text` TEXT NOT NULL,
    `is_system_log` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Blog Posts Table (Editorial Studio & Live Website Feed)
CREATE TABLE IF NOT EXISTS `blog_posts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) DEFAULT NULL,
    `excerpt` TEXT,
    `content` LONGTEXT,
    `author_id` INT DEFAULT NULL,
    `author_name` VARCHAR(150) DEFAULT 'DevInquire Editorial',
    `category` VARCHAR(100) DEFAULT 'Engineering',
    `tags` JSON DEFAULT NULL,
    `status` VARCHAR(50) DEFAULT 'draft',
    `featured_image` VARCHAR(500) DEFAULT NULL,
    `read_time` INT DEFAULT 5,
    `is_featured` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Contacts Table (Client Inquiries & Auto-Synced Website Submissions)
CREATE TABLE IF NOT EXISTS `contacts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(255) DEFAULT '',
    `message` TEXT,
    `company` VARCHAR(200) DEFAULT NULL,
    `phone` VARCHAR(50) DEFAULT NULL,
    `service` VARCHAR(150) DEFAULT NULL,
    `timeline` VARCHAR(100) DEFAULT NULL,
    `reply_message` TEXT DEFAULT NULL,
    `replied_at` VARCHAR(100) DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `status` VARCHAR(50) DEFAULT 'new',
    `priority` VARCHAR(50) DEFAULT 'Medium',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT DEFAULT NULL,
    `type` VARCHAR(50) DEFAULT 'info',
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `link` VARCHAR(255) DEFAULT NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. System Settings Table (Persists Mail/Inquiry & Editorial Studio Configurations)
CREATE TABLE IF NOT EXISTS `system_settings` (
    `setting_key` VARCHAR(100) PRIMARY KEY,
    `setting_value` JSON NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9b. Social Posts Table (Instagram & Facebook Omnichannel Studio Posts)
CREATE TABLE IF NOT EXISTS `social_posts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `blog_id` INT DEFAULT NULL,
    `platform` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `caption` LONGTEXT,
    `status` VARCHAR(50) DEFAULT 'draft',
    `payload` LONGTEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Default Admin Provisioning (Email: admin@devinquire.com | Password: DevInquire2025!)
INSERT INTO `users` (`email`, `password`, `name`, `role`, `status`)
VALUES (
    'admin@devinquire.com',
    '$2a$10$ZEO/utHoK6FKsCg9unf5QuMDLUA4H3RHwj1cAdFicgilMhWPFGp1a',
    'DevInquire Admin',
    'Admin',
    'active'
) ON DUPLICATE KEY UPDATE `password` = VALUES(`password`), `role` = 'Admin', `status` = 'active';

SET FOREIGN_KEY_CHECKS = 1;
