import type { D1Database } from "@cloudflare/workers-types";
import { Thread } from "./thread";

export class ThreadManager {
	constructor(protected db: D1Database) {}

	/**
	 * Creates a new thread.
	 *
	 * @param subject - Subject of the thread.
	 * @param thid - Optional thread ID. If not provided, a random ID will be generated.
	 * @returns A promise that resolves to the newly created Thread object.
	 */
	async create(subject: string, thid?: string): Promise<Thread> {
		thid = thid || Math.random().toString(36).slice(2);

		const t = new Date().toISOString();
		await this.db
			.prepare(
				"INSERT INTO threads (id, subject, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
			)
			.bind(thid, subject, "active", t, t)
			.run();

		return new Thread(thid, this.db);
	}

	/**
	 * Retrieves a Thread object based on the provided thread ID.
	 * @param thid The ID of the thread to retrieve.
	 * @returns The Thread object.
	 */
	get(thid: string): Thread {
		return new Thread(thid, this.db);
	}
}
