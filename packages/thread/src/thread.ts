import type { D1Database } from "@cloudflare/workers-types";

export type ThreadStatus = "active" | "archived" | (string & {});

export interface ThreadMessage {
	id: string;
	thread_id: string;
	received_at: string;
}

export interface ThreadParticipant {
	email: string;
	name: string;
	role: string;
	joined_at: string;
}

export class Thread {
	constructor(
		public id: string,
		protected db: D1Database,
	) {}

	/**
	 * Pushes a message to the thread.
	 *
	 * @param message_id - The ID of the message to be pushed.
	 * @returns A promise that resolves when the message is successfully pushed.
	 */
	async push(message_id: string) {
		const t = new Date().toISOString();
		await Promise.all([
			this.db
				.prepare(
					"INSERT INTO thread_messages (message_id, thread_id, received_at) VALUES (?, ?, ?)",
				)
				.bind(message_id, this.id, t)
				.run(),
			this.db
				.prepare("UPDATE threads SET updated_at = ? WHERE id = ?")
				.bind(t, this.id)
				.run(),
		]);
	}

	/**
	 * Retrieves a list of thread messages for the current thread.
	 * @returns A promise that resolves to an array of ThreadMessage objects.
	 */
	async list(): Promise<ThreadMessage[]> {
		const { results } = await this.db
			.prepare(
				"SELECT message_id as id, thread_id, received_at FROM thread_messages WHERE thread_id = ?",
			)
			.bind(this.id)
			.all();

		return results as unknown as ThreadMessage[];
	}

	async subject(): Promise<string> {
		const record = await this.db
			.prepare("SELECT subject FROM threads WHERE id = ?")
			.bind(this.id)
			.first();
		if (!record) {
			throw new Error(`Thread ${this.id} not found`);
		}

		return record.subject as string;
	}

	/**
	 * Retrieves or updates the status of the thread.
	 *
	 * @param s Optional. The new status to update the thread with.
	 * @returns A promise that resolves to the current status of the thread.
	 * @throws Error if the thread is not found.
	 */
	async status(): Promise<ThreadStatus>;
	async status(s: ThreadStatus): Promise<ThreadStatus>;
	async status(s?: ThreadStatus): Promise<ThreadStatus> {
		if (s) {
			await this.db
				.prepare("UPDATE threads SET status = ? WHERE id = ?")
				.bind(s, this.id)
				.run();
		}

		const record = await this.db
			.prepare("SELECT status FROM threads WHERE id = ?")
			.bind(this.id)
			.first();
		if (!record) {
			throw new Error(`Thread ${this.id} not found`);
		}

		return record.status as ThreadStatus;
	}

	/**
	 * Adds a participant to the thread.
	 *
	 * @param address - The email address of the participant.
	 * @param name - The name of the participant.
	 * @param role - The role of the participant (optional).
	 * @returns A promise that resolves when the participant is successfully added.
	 */
	async join(address: string, name: string, role?: string) {
		const t = new Date().toISOString();
		await Promise.all([
			this.db
				.prepare(
					"INSERT INTO thread_participants (thread_id, email, name, role, joined_at) VALUES (?, ?, ?, ?, ?)",
				)
				.bind(this.id, address, name, role ?? null, t)
				.run(),
			this.db
				.prepare("UPDATE threads SET updated_at = ? WHERE id = ?")
				.bind(t, this.id)
				.run(),
		]);
	}

	/**
	 * Removes the specified email from the participants of the thread.
	 * @param email - The email to be removed from the thread participants.
	 * @returns A Promise that resolves when the email is successfully removed from the thread.
	 */
	async leave(email: string) {
		const t = new Date().toISOString();
		await Promise.all([
			this.db
				.prepare("DELETE FROM thread_participants WHERE thread_id = ? AND email = ?")
				.bind(this.id, email)
				.run(),
			this.db
				.prepare("UPDATE threads SET updated_at = ? WHERE id = ?")
				.bind(t, this.id)
				.run(),
		]);
	}

	/**
	 * Retrieves the participants of the thread.
	 * @returns A promise that resolves to an array of thread participants.
	 */
	async participants(): Promise<ThreadParticipant[]> {
		const { results } = await this.db
			.prepare(
				"SELECT email, name, role, joined_at FROM thread_participants WHERE thread_id = ?",
			)
			.bind(this.id)
			.all();

		return results as unknown as ThreadParticipant[];
	}
}
