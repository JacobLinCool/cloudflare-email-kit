# Cloudflare Email Thread

A thread manager for Cloudflare Email Kit.

## Pre-requisites

1. Setup D1 database

```sql
CREATE TABLE `threads` (
  `id` TEXT PRIMARY KEY,
  `subject` TEXT NOT NULL,
  `status` TEXT,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);
CREATE TABLE `thread_messages` (
  `message_id` TEXT PRIMARY KEY,
  `thread_id` TEXT NOT NULL,
  `received_at` TEXT NOT NULL
);
CREATE TABLE `thread_participants` (
  `thread_id` TEXT NOT NULL,
  `email` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `role` TEXT,
  `joined_at` TEXT NOT NULL,
  PRIMARY KEY (`thread_id`, `email`)
);
```
