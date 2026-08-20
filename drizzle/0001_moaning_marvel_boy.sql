CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationId` int NOT NULL,
	`messageId` int,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(127) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`sizeBytes` int NOT NULL,
	`extractedText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New conversation',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`message_role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`message_status` enum('complete','streaming','error') NOT NULL DEFAULT 'complete',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `attachments_user_conversation_idx` ON `attachments` (`userId`,`conversationId`);--> statement-breakpoint
CREATE INDEX `attachments_message_idx` ON `attachments` (`messageId`);--> statement-breakpoint
CREATE INDEX `conversations_user_last_message_idx` ON `conversations` (`userId`,`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `messages_user_conversation_idx` ON `messages` (`userId`,`conversationId`);