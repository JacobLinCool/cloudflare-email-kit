import { describe, expect, it } from "vitest";
import { EmailKit } from "../src/kit";
import type { Context, Middleware } from "../src/types";

class M1 implements Middleware<Context, Context & { some: string }> {
	name = "m1";
	async handle(
		ctx: Context,
		next: (c: Context & { some: string }) => Promise<void>,
	): Promise<void> {
		await next(Object.assign(ctx, { some: "some" }));
	}
}

class M2 implements Middleware<Context & { some: string }> {
	name = "m2";
	async handle(ctx: Context & { some: string }, next: () => Promise<void>): Promise<void> {
		await next();
	}
}

describe("EmailKit", () => {
	it("should work", () => {
		// new EmailKit().use(new M2()).use(new M1()); // should fail
		const kit = new EmailKit().use(new M1()).use(new M2());

		expect(kit).toBeInstanceOf(EmailKit);
	});
});
