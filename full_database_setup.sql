-- DevInquire Full Database Schema
-- Run this in phpMyAdmin to create all necessary tables.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(191) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100),
  `role` ENUM('Admin', 'Editor', 'User', 'Developer') DEFAULT 'User',
  `status` ENUM('active', 'inactive', 'pending') DEFAULT 'active',
  `avatar` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `language` VARCHAR(100),
  `status` VARCHAR(50) DEFAULT 'active',
  `health` INT DEFAULT 100,
  `progress` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tasks Table
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `assignee_id` INT,
  `status` ENUM('todo', 'in-progress', 'completed', 'blocked') DEFAULT 'todo',
  `priority` ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
  `due_date` DATE,
  `points` INT DEFAULT 0,
  `tags` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Subtasks Table
CREATE TABLE IF NOT EXISTS `subtasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `task_id` INT,
  `title` VARCHAR(255) NOT NULL,
  `completed` TINYINT(1) DEFAULT 0,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Task Comments Table
CREATE TABLE IF NOT EXISTS `task_comments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `task_id` INT,
  `user_id` INT,
  `text` TEXT NOT NULL,
  `is_system_log` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Blog Posts Table
CREATE TABLE IF NOT EXISTS `blog_posts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `excerpt` TEXT,
  `content` LONGTEXT,
  `author_id` INT,
  `category` VARCHAR(100) DEFAULT 'Engineering',
  `tags` JSON,
  `status` ENUM('draft', 'published') DEFAULT 'draft',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `type` VARCHAR(50),
  `title` VARCHAR(255),
  `message` TEXT,
  `link` VARCHAR(255),
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Contacts (Inquiries) Table
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(255),
  `message` TEXT,
  `status` VARCHAR(50) DEFAULT 'new',
  `priority` VARCHAR(50) DEFAULT 'normal',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
