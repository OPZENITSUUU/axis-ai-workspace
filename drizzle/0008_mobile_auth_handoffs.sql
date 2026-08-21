CREATE TABLE `mobile_auth_handoffs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `handoffHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `mobile_auth_handoffs_id` PRIMARY KEY(`id`),
  CONSTRAINT `mobile_auth_handoffs_handoffHash_unique` UNIQUE(`handoffHash`)
);
--> statement-breakpoint
CREATE INDEX `mobile_auth_handoffs_expiry_idx` ON `mobile_auth_handoffs` (`expiresAt`);
