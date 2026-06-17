CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`raw_item_id` int,
	`category_code` varchar(64),
	`summary` text NOT NULL,
	`heat` int NOT NULL,
	`tags` json,
	`critical` boolean DEFAULT false,
	`trend_comment` text,
	`processed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`label` varchar(128) NOT NULL,
	`color` varchar(16) NOT NULL,
	`sort_order` int DEFAULT 0,
	`enabled` boolean DEFAULT true,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `collect_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_id` int NOT NULL,
	`status` enum('RUNNING','SUCCESS','FAILED') NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`finished_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`items_fetched` int DEFAULT 0,
	`items_new` int DEFAULT 0,
	`error` text,
	CONSTRAINT `collect_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`article_id` int NOT NULL,
	`type` enum('USEFUL','USELESS','COLLECT') NOT NULL,
	`note` text,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`report_id` int,
	`channel` varchar(32) NOT NULL,
	`status` enum('PENDING','SUCCESS','FAILED') NOT NULL,
	`payload` json,
	`idempotency_key` varchar(128),
	`error` text,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notification_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `raw_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_id` int NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`url` text NOT NULL,
	`title` varchar(512) NOT NULL,
	`raw_text` text,
	`published_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`captured_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`dedupe_key` varchar(64),
	CONSTRAINT `raw_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `raw_items_fingerprint_unique` UNIQUE(`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `report_items` (
	`report_id` int NOT NULL,
	`article_id` int NOT NULL,
	`sort_order` int NOT NULL,
	`section` varchar(32),
	CONSTRAINT `report_items_report_id_article_id_pk` PRIMARY KEY(`report_id`,`article_id`)
);
--> statement-breakpoint
CREATE TABLE `report_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`cron` varchar(64) NOT NULL,
	`period_hours` int NOT NULL,
	`enabled` boolean DEFAULT true,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `report_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`issue_no` varchar(32) NOT NULL,
	`user_id` int NOT NULL,
	`schedule_id` int NOT NULL,
	`period_start` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`period_end` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`headline_json` json,
	`body_json` json,
	`status` enum('GENERATING','READY','SENT','FAILED') NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`sent_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`type` varchar(32) NOT NULL,
	`config` json,
	`enabled` boolean DEFAULT true,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `sources_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`schedule_id` int NOT NULL,
	`category_codes` json,
	`keywords` json,
	`channels` json,
	`active` boolean DEFAULT true,
	`updated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`external_id` varchar(128) NOT NULL,
	`name` varchar(128) NOT NULL,
	`role` enum('USER','ADMIN') NOT NULL DEFAULT 'USER',
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`last_seen_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_external_id_unique` UNIQUE(`external_id`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_raw_item_id_raw_items_id_fk` FOREIGN KEY (`raw_item_id`) REFERENCES `raw_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_category_code_categories_code_fk` FOREIGN KEY (`category_code`) REFERENCES `categories`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collect_logs` ADD CONSTRAINT `collect_logs_source_id_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_article_id_articles_id_fk` FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_report_id_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `raw_items` ADD CONSTRAINT `raw_items_source_id_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_items` ADD CONSTRAINT `report_items_report_id_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_items` ADD CONSTRAINT `report_items_article_id_articles_id_fk` FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_schedule_id_report_schedules_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `report_schedules`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_schedule_id_report_schedules_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `report_schedules`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `articles_category_idx` ON `articles` (`category_code`);--> statement-breakpoint
CREATE INDEX `articles_heat_idx` ON `articles` (`heat`);--> statement-breakpoint
CREATE INDEX `articles_critical_idx` ON `articles` (`critical`);--> statement-breakpoint
CREATE INDEX `collect_logs_source_status_idx` ON `collect_logs` (`source_id`,`status`);--> statement-breakpoint
CREATE INDEX `collect_logs_started_idx` ON `collect_logs` (`started_at`);--> statement-breakpoint
CREATE INDEX `feedback_user_article_idx` ON `feedback` (`user_id`,`article_id`);--> statement-breakpoint
CREATE INDEX `notification_logs_report_channel_idx` ON `notification_logs` (`report_id`,`channel`);--> statement-breakpoint
CREATE INDEX `notification_logs_idem_idx` ON `notification_logs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `raw_items_source_idx` ON `raw_items` (`source_id`);--> statement-breakpoint
CREATE INDEX `raw_items_dedupe_idx` ON `raw_items` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `report_items_report_idx` ON `report_items` (`report_id`);--> statement-breakpoint
CREATE INDEX `reports_user_issue_idx` ON `reports` (`user_id`,`issue_no`);--> statement-breakpoint
CREATE INDEX `reports_schedule_idx` ON `reports` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`);--> statement-breakpoint
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_schedule_idx` ON `subscriptions` (`schedule_id`);