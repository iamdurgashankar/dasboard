-- SQL Schema for Blog Integrated with DevInquire Dashboard

-- 1. Create Blog Posts Table
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
  INDEX (`category`),
  INDEX (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Ensure Users Table exists (for author relationship)
-- If you already have a users table, skip this.
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(191) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100),
  `role` ENUM('Admin', 'Editor', 'User') DEFAULT 'User',
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Optional: Add Foreign Key if you want strict integrity
-- ALTER TABLE `blog_posts` ADD CONSTRAINT `fk_blog_author` 
-- FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL;
