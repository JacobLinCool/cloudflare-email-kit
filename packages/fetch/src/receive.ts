import type { Request } from "@cloudflare/workers-types";
import type { EnhancedMessage } from "cloudflare-email-kit";
import { mailchannels } from "cloudflare-email-mailchannels";

export async function receive(req: Request) {
	const from = req.headers.get("X-Envelope-From") || "";
	const to = req.headers.get("X-Envelope-To") || "";
	const size = Number(req.headers.get("X-Message-Size")) || 0;

	let _raw: Promise<Uint8Array> | undefined;

	const message: EnhancedMessage = {
		from,
		to,
		size,
		headers: req.headers,
		raw: () => {
			if (!_raw) {
				_raw = req.arrayBuffer().then((buffer) => new Uint8Array(buffer));
			}
			return _raw;
		},
		async forward(to, headers) {
			throw new Error("Not Implemented Yet.");
		},
		async reply(mime) {
			await mailchannels(mime);
		},
		isAuto() {
			const auto = message.headers.get("Auto-Submitted") || "";
			return ["auto-generated", "auto-replied", "auto-notified"].includes(auto);
		},
	};

	return message;
}
