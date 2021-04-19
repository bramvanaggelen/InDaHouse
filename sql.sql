START TRANSACTION;
CREATE DATABASE IF NOT EXISTS in_da_house;
USE in_da_house;

DROP TABLE IF EXISTS `servers`;
CREATE TABLE `servers` (
    `id` int(255) UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255),
    `discord_id` VARCHAR(255),
    PRIMARY KEY  (`id`)
);

DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
    `id` int(255) UNSIGNED NOT NULL AUTO_INCREMENT,
    `server_id` int(255) UNSIGNED,
    `max-players` int(5) UNSIGNED default('10'),
    `players` TEXT,
    `captains` TEXT default('2'),
    `current_picker_id` varchar(255)
    `name` VARCHAR(255),
    `description` TEXT,
    `message_id` VARCHAR(255),
    `time` DATETIME,
    `updated_at` DATETIME,
    PRIMARY KEY  (`id`),
    CONSTRAINT `event_server` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE CASCADE,
);

COMMIT;