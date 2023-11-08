import type { Context, Middleware } from "cloudflare-email-kit";
import debug from "debug";
import PostalMime from "postal-mime";
import type { ParsedContext } from "./types";

const log = debug("email-parser");

export class Parser implements Middleware<Context, ParsedContext> {
	get name(): string {
		return "Parser";
	}

	public async handle(ctx: Context, next: (c: ParsedContext) => Promise<void>): Promise<void> {
		log("Parsing email message ...");
		const parser = new PostalMime();
		const parsed = await parser.parse(await ctx.message.raw());
		log("Parsed email message.");

		await next(Object.assign(ctx, { parsed }));
	}
}
