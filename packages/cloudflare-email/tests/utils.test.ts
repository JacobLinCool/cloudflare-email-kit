import { describe, expect, it } from "vitest";
import { ab27bit, ab2str } from "../src/utils";

describe("ab27bit", () => {
	it("should convert an ArrayBuffer to 7bit", () => {
		// 01000001 00100001 00010001 00001001
		// -> [0100000][1 001000][01 00010][001 0000][1001 000]
		const input = new Uint8Array([0b01000001, 0b00100001, 0b00010001, 0b00001001]);
		const output = ab27bit(input.buffer);
		expect(output).toBe("\x20\x48\x22\x10\x48");
	});
});

describe("ab2str", () => {
	it("should convert an ArrayBuffer to a string", () => {
		const input = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0xff]);
		const output = ab2str(input.buffer);
		expect(output).toBe("Hello\x00\xFF");
	});
});
