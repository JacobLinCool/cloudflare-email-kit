import type { D1Database, ForwardableEmailMessage } from "@cloudflare/workers-types";
import {
	EmailKit,
	EmailRouter,
	Middleware,
	REJECT_ALL,
	SizeGuard,
	createMimeMessage,
	mailbox,
	mailchannels,
	respond,
} from "cloudflare-email";
import { ParsedContext, Parser } from "cloudflare-email-parser";
import { ThreadManager } from "cloudflare-email-thread";

export interface Env {
	D1: D1Database;
}

export default {
	async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
		const tm = new ThreadManager(env.D1);

		const router = new EmailRouter<ParsedContext>()
			.match(
				(m) => m.isAuto(),
				(m) => {}, // do nothing, auto-sent emails are ignored
			)
			.match(
				/@test\.csie\.cool$/,
				new EmailRouter<ParsedContext>()
					.match(/^chat@/, new ThreadCreator(tm))
					.match(/^thread\+[^@]+@/, new ThreadHandler(tm))
					.match(...REJECT_ALL("Your email is rejected! :P")),
			)
			.match(...REJECT_ALL("Your email is rejected! :P"));

		const kit = new EmailKit()
			.use(new SizeGuard(10 * 1024 * 1024))
			.use(new Parser())
			.use(router);

		await kit.process(message);
	},
};

class ThreadCreator implements Middleware<ParsedContext> {
	name = "ThreadCreator";

	constructor(private tm: ThreadManager) {}

	async handle(ctx: ParsedContext, next: () => Promise<void>): Promise<void> {
		const thread = await this.tm.create(ctx.parsed.subject || "Untitled");
		await Promise.all([
			thread.push(ctx.parsed.messageId),
			thread.join(ctx.parsed.from.address, ctx.parsed.from.name),
		]);

		const msg = respond(ctx.message);
		msg.addMessage({
			contentType: "text/plain",
			data: `Thread created. Others can join the thread by sending email to thread+${thread.id}@test.csie.cool!`,
		});
		msg.setHeader("Reply-To", mailbox(`thread+${thread.id}@test.csie.cool`));
		await mailchannels(msg);

		await next();
	}
}

class ThreadHandler implements Middleware<ParsedContext> {
	name = "ThreadHandler";

	constructor(private tm: ThreadManager) {}

	async handle(ctx: ParsedContext, next: () => Promise<void>): Promise<void> {
		const thid = ctx.message.to.match(/^thread\+([^@]+)@/)?.[1];
		if (!thid) {
			return;
		}

		let new_participant = true;

		const thread = this.tm.get(thid);
		await Promise.all([
			thread.push(ctx.parsed.messageId),
			thread.join(ctx.parsed.from.address, ctx.parsed.from.name).catch(() => {
				new_participant = false;
			}), // ignore already joined error
		]);

		const subject = thread.subject();
		const participants = await thread.participants();
		const recipients = participants.filter((p) => p.email !== ctx.parsed.from.address);
		const msg = createMimeMessage();
		msg.setSender("chat@test.csie.cool");
		recipients.forEach((p) => msg.setRecipient({ addr: p.email, name: p.name }));
		msg.setSubject(await subject);
		msg.addMessage({
			contentType: "text/plain",
			data: `${ctx.parsed.from.name} <${ctx.parsed.from.address}> said:\n\n${ctx.parsed.text}`,
		});
		msg.setHeader("Reply-To", mailbox(`thread+${thread.id}@test.csie.cool`));
		await mailchannels(msg);

		if (new_participant) {
			const msg = respond(ctx.message);
			msg.addMessage({
				contentType: "text/plain",
				data: `Joined thread ${await subject}.`,
			});
			msg.setHeader("Reply-To", mailbox(`thread+${thread.id}@test.csie.cool`));
			await mailchannels(msg);
		}

		await next();
	}
}
