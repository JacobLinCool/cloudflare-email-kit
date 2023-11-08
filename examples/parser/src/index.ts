import type { ForwardableEmailMessage, R2Bucket } from "@cloudflare/workers-types";
import { EmailKit, SizeGuard, respond } from "cloudflare-email";
import { ParsedContext, Parser } from "cloudflare-email-parser";

export interface Env {
	R2: R2Bucket;
}

export default {
	async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
		const kit = new EmailKit()
			.use(new SizeGuard(10 * 1024 * 1024))
			.use(new Parser())
			.use({
				name: "save-attechments",
				async handle(ctx: ParsedContext) {
					for (const attachment of ctx.parsed.attachments) {
						const { filename, content, mimeType } = attachment;
						const key = `attachments/${ctx.parsed.messageId}/${filename}`;
						console.log(`Saving attachment ${filename} to ${key} ...`);
						await env.R2.put(key, content, {
							customMetadata: { mime: mimeType },
						});
						console.log(`Saved attachment ${filename} to ${key}.`);
					}

					const res = respond(ctx.message);
					res.addMessage({
						contentType: "text/plain",
						data: `${ctx.parsed.attachments.length} attachments saved.`,
					});
					await ctx.message.reply(res);
				},
			});

		await kit.process(message);
	},
};
