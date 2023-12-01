import type { Fetcher } from "@cloudflare/workers-types";
import type { Context, Middleware } from "cloudflare-email-kit";
import { send } from "./sender";

export class AutoSelect implements Middleware {
	name = "AutoSelect";

	protected config = new Map<RegExp, Fetcher>();

	constructor(protected env: Record<string, unknown>) {
		if (!this.env.AUTOSELECT_CONFIG) {
			throw new Error("env AUTOSELECT_CONFIG is required.");
		}

		const config = JSON.parse(this.env.AUTOSELECT_CONFIG as string);

		for (const [pattern, key] of Object.entries(config)) {
			if (typeof key !== "string") {
				throw new Error(`Invalid bindding key for pattern ${pattern}.`);
			}
			if (!env[key]) {
				throw new Error(`No binding found for key ${key}.`);
			}

			this.config.set(new RegExp(pattern), env[key] as Fetcher);
		}
	}

	async handle(ctx: Context, next: () => Promise<void>): Promise<void> {
		const { message } = ctx;

		for (const [pattern, fetcher] of this.config) {
			if (pattern.test(message.to)) {
				await send(fetcher, message);
				return;
			}
		}

		await next();
	}
}
