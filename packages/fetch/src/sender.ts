import type { Fetcher, Headers } from "@cloudflare/workers-types";
import type { EnhancedMessage } from "cloudflare-email-kit";

export class Sender {
	constructor(
		protected fetcher: Fetcher,
		protected domain = "https://sub.processor.email",
	) {
		if (!this.fetcher) {
			throw new Error("Fetcher is required.");
		}
	}

	async send(message: EnhancedMessage) {
		// @ts-expect-error
		const mixed = new Headers(message.headers);
		mixed.set("X-Envelope-From", message.from);
		mixed.set("X-Envelope-To", message.to);
		mixed.set("X-Message-Size", String(message.size));

		const res = await this.fetcher.fetch(new URL("/send", this.domain), {
			method: "POST",
			headers: mixed,
			body: await message.raw(),
		});

		if (!res.ok) {
			throw new Error(`Failed to send email: ${res.status} ${res.statusText}`);
		}
	}
}

export const send = async (fetcher: Fetcher, message: EnhancedMessage) => {
	const sender = new Sender(fetcher);
	return sender.send(message);
};
