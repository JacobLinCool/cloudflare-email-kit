import type {
	D1Database,
	ForwardableEmailMessage,
	MessageBatch,
	Queue,
	R2Bucket,
} from "@cloudflare/workers-types";
import { EmailKit, EmailRouter, SizeGuard, respond } from "cloudflare-email";
import { Backup } from "cloudflare-email-backup";
import { EmailQueue, EmailQueueMessage } from "cloudflare-email-queue";

export interface Env {
	R2: R2Bucket;
	D1: D1Database;
	FIRST: Queue<EmailQueueMessage>;
	SECOND: Queue<EmailQueueMessage>;
}

export default {
	// receive email, perform size check, and enqueue it to the coresponding queue
	async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
		const router = new EmailRouter()
			.match(/@first\.csie\.cool$/, new EmailQueue(env.FIRST))
			.match(/@second\.csie\.cool$/, new EmailQueue(env.SECOND));

		const kit = new EmailKit()
			.use(new SizeGuard(10 * 1024 * 1024))
			.use(
				new Backup({
					bucket: env.R2,
					prefix: "backup",
					database: env.D1,
					table: "emails",
				}),
			)
			.use(router);

		await kit.process(message);
	},
	// checkout the queued messages and process them
	async queue(batch: MessageBatch<EmailQueueMessage>, env: Env) {
		const backup = new Backup({
			bucket: env.R2,
			prefix: "backup",
			database: env.D1,
			table: "emails",
		});

		// retrieve and re-construct the message
		const retrieve = async (m: EmailQueueMessage) => {
			const raw = await backup.retrieve(m.message_id, m.from, m.to);
			if (!raw) {
				throw new Error("Cannot retrieve message.");
			}
			return EmailQueue.retrieve(m, raw);
		};

		if (batch.queue === "kit-example-first-email-queue") {
			for (const m of batch.messages) {
				const message = await retrieve(m.body);

				await new EmailKit()
					.use(async (ctx) => {
						const reply = respond(ctx.message);
						reply.addMessage({
							contentType: "text/plain",
							data: "Greeting from first domain.",
						});
						await ctx.message.reply(reply);
					})
					.handle({ message });

				m.ack();
			}
		} else if (batch.queue === "kit-example-second-email-queue") {
			for (const m of batch.messages) {
				const message = await retrieve(m.body);

				await new EmailKit()
					.use(async (ctx) => {
						const reply = respond(ctx.message);
						reply.addMessage({
							contentType: "text/plain",
							data: "Greeting from second domain.",
						});

						await ctx.message.reply(reply);
					})
					.handle({ message });

				m.ack();
			}
		}
	},
};
