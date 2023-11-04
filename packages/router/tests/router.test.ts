import { describe, expect, it } from "vitest";
import { EmailRouter } from "../src/router";
import { CATCH_ALL } from "../src/utils";

describe("EmailRouter", () => {
	it("should work", async () => {
		let called = 0;
		const router = new EmailRouter()
			.match(/@csie\.cool$/, (m) => {
				expect(m.to).toBe("user@csie.cool");
				called++;
			})
			.match(
				/@ntnu\.csie\.cool$/,
				new EmailRouter()

					.match(/^admin@/, (m) => {
						expect(m.to).toBe("admin@ntnu.csie.cool");
						called++;
					})
					.match(/^test-\d+@/, (m) => {
						expect(m.to).toBe("test-123@ntnu.csie.cool");
						called++;
					})
					.match(CATCH_ALL, (m) => {
						expect(m.to).toBe("someone@ntnu.csie.cool");
						called++;
					}),
			)
			.match(CATCH_ALL, (m) => {
				expect(m.to).toBe("other@sub.csie.cool");
				called++;
			});

		const targets = [
			"user@csie.cool",
			"admin@ntnu.csie.cool",
			"test-123@ntnu.csie.cool",
			"someone@ntnu.csie.cool",
			"other@sub.csie.cool",
		];

		for (const target of targets) {
			await router.handle({
				message: {
					to: target,
					from: "test@example.com",
				} as any,
			});
		}

		expect(called).toBe(targets.length);
	});
});
