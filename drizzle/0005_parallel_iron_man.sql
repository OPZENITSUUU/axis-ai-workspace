CREATE TABLE `background_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationId` int NOT NULL,
	`prompt` text NOT NULL,
	`attachmentIds` text NOT NULL,
	`provider` varchar(32) NOT NULL,
	`model` varchar(128),
	`background_task_status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`userMessageId` int,
	`assistantMessageId` int,
	`attemptCount` int NOT NULL DEFAULT 0,
	`claimedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `background_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`notification_provider` enum('web_push','expo_push') NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expoPushToken` text,
	`webPushEndpoint` text,
	`webPushP256dh` varchar(255),
	`webPushAuth` varchar(255),
	`enabled` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_devices_provider_token_hash_uq` UNIQUE(`notification_provider`,`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`backgroundTaskId` int NOT NULL,
	`deviceId` int NOT NULL,
	`notification_event_type` enum('task_complete','task_error') NOT NULL,
	`notification_delivery_status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`receiptId` varchar(255),
	`failureCode` varchar(128),
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `backgroundTaskNotifications` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `backgroundTaskErrors` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `background_tasks_user_status_created_idx` ON `background_tasks` (`userId`,`background_task_status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `background_tasks_status_claimed_idx` ON `background_tasks` (`background_task_status`,`claimedAt`);--> statement-breakpoint
CREATE INDEX `background_tasks_user_conversation_idx` ON `background_tasks` (`userId`,`conversationId`);--> statement-breakpoint
CREATE INDEX `notification_devices_user_provider_enabled_idx` ON `notification_devices` (`userId`,`notification_provider`,`enabled`);--> statement-breakpoint
CREATE INDEX `notification_events_task_device_idx` ON `notification_events` (`backgroundTaskId`,`deviceId`);--> statement-breakpoint
CREATE INDEX `notification_events_user_status_idx` ON `notification_events` (`userId`,`notification_delivery_status`);