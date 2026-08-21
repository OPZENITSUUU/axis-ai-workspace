ALTER TABLE `messages` ADD `generationDurationMs` int;--> statement-breakpoint
ALTER TABLE `messages` ADD `generatedWordCount` int;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `memoryInstructions` text;