CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`description` text,
	`isPinned` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theme_preference` enum('light','dark','system') NOT NULL DEFAULT 'light',
	`font_size_preference` enum('compact','comfortable','large') NOT NULL DEFAULT 'comfortable',
	`accent_preference` enum('lime','sky','violet') NOT NULL DEFAULT 'lime',
	`preferredModel` varchar(128),
	`memoryEnabled` boolean NOT NULL DEFAULT true,
	`privacy_mode` enum('strict','standard') NOT NULL DEFAULT 'strict',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `conversations` ADD `projectId` int;--> statement-breakpoint
CREATE INDEX `projects_user_pinned_updated_idx` ON `projects` (`userId`,`isPinned`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `user_settings_user_idx` ON `user_settings` (`userId`);--> statement-breakpoint
CREATE INDEX `conversations_user_project_idx` ON `conversations` (`userId`,`projectId`);