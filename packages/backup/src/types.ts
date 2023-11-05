import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface BackupConfig {
	bucket: R2Bucket;
	/**
	 * The prefix to use for the R2 path, without trailing slash and leading slash.
	 * e.g. `backup` will make the path `backup/<domain>/<username>/<message-id>.eml`
	 */
	prefix: string;

	database?: D1Database;
	/**
	 * The name of the table to use for the database.
	 * Defaults to `emails`.
	 */
	table?: string;

	/**
	 * Not to automatically store a copy of the reply.
	 */
	disable_reply_backup?: boolean;
}
