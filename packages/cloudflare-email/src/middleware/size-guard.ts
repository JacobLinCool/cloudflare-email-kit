import type { Context, Middleware } from "cloudflare-email-kit";

export class SizeGuard implements Middleware {
	name = "Size Guard";

	constructor(protected max_size: number) {}

	async handle(ctx: Context, next: () => Promise<void>): Promise<void> {
		if (ctx.message.size > this.max_size) {
			ctx.message.reject(`Message size too large: ${ctx.message.size} > ${this.max_size}`);
		} else {
			await next();
		}
	}
}
