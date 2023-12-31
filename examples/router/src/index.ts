import type {
	D1Database,
	ExecutionContext,
	ForwardableEmailMessage,
	R2Bucket,
} from "@cloudflare/workers-types";
import { CATCH_ALL, EmailKit, EmailRouter, REJECT_ALL, SizeGuard, respond } from "cloudflare-email";
import { Backup } from "cloudflare-email-backup";

export interface Env {
	R2: R2Bucket;
	D1: D1Database;
	NOTIFICATION_EMAIL: string;
}

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const router = new EmailRouter()
			// handle auto-sent emails
			.match(
				(m) => m.isAuto(),
				(m) => m.forward(env.NOTIFICATION_EMAIL),
			)
			// use a sub-router to handle subdomain emails
			.match(
				/@test\.csie\.cool$/,
				new EmailRouter()
					.match(/^admin@/, async (message) => {
						const msg = respond(message);
						msg.addMessage({
							contentType: "text/plain",
							data: "Hello, I'm the admin!",
						});
						await message.reply(msg);
					})
					.match(
						// function matchers are also supported, even async ones which query databases
						(m) => m.from.length % 2 === 0,
						async (message) => {
							const msg = respond(message);
							msg.addMessage({
								contentType: "text/plain",
								data: `The length of your email address is even!`,
							});
							await message.reply(msg);
						},
					)
					.match(CATCH_ALL, async (message) => {
						const msg = respond(message);
						msg.addMessage({
							contentType: "text/plain",
							data: "The length of your email address is odd!",
						});
						await message.reply(msg);
					}),
			)
			.match(...REJECT_ALL("Your email is rejected! :P"));

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
};
