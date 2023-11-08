import type { Queue } from "@cloudflare/workers-types";
import type { Context, EnhancedMessage, Middleware } from "cloudflare-email-kit";
import { mailchannels } from "cloudflare-email-mailchannels";
import type { EmailQueueMessage } from "./types";

export class EmailQueue implements Middleware {
	public name = "Email Queue";

	constructor(protected cfq: Queue<EmailQueueMessage>) {}

	public async handle(ctx: Context, next: () => Promise<void>): Promise<void> {
		const message = ctx.message;
		const headers = [...message.headers.entries()];

		const message_id = message.headers.get("Message-ID");
		if (!message_id) {
			throw new Error("No Message ID");
		}

		const payload: EmailQueueMessage = {
			message_id,
			from: message.from,
			to: message.to,
			size: message.size,
			headers,
		};

		await this.cfq.send(payload, { contentType: "json" });

		await next();
	}

	public static retrieve(
		queued: EmailQueueMessage,
		raw: () => Promise<ArrayBuffer>,
	): EnhancedMessage {
		const message: EnhancedMessage = {
			from: queued.from,
			to: queued.to,
			size: queued.size,
			headers: new Headers(queued.headers) as any,
			raw: () => raw().then((buffer) => new Uint8Array(buffer)),
			async forward(to, headers) {
				throw new Error("Not Implemented Yet.");
			},
			async reply(mime) {
				await mailchannels(mime);
			},
			isAuto() {
				const auto = message.headers.get("Auto-Submitted") || "";
				return ["auto-generated", "auto-replied", "auto-notified"].includes(auto);
			},
		};

		return message;
	}
}
