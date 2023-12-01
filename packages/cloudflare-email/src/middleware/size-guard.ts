import type { Context, Middleware } from "cloudflare-email-kit";

/**
 * Middleware that guards against messages exceeding a maximum size.
 * If the message exceeds the maximum size, it will be rejected.
 */
export class SizeGuard implements Middleware {
	name = "Size Guard";

	/**
	 * @param max_size The maximum size of a message in bytes.
	 */
	constructor(protected max_size: number) {}

	async handle(ctx: Context, next: () => Promise<void>): Promise<void> {
		if (ctx.message.size > this.max_size) {
			ctx.message.reject?.(`Message size too large: ${ctx.message.size} > ${this.max_size}`);
		} else {
			await next();
		}
	}
}
