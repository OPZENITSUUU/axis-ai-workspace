ALTER TABLE `conversations` ADD `provider` varchar(32) DEFAULT 'omniroute' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `model` varchar(128);