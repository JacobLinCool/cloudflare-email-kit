import { ForwardableEmailMessage, ReadableStream } from "@cloudflare/workers-types";
import { MIMEMessage } from "mimetext";
import { Context, Middleware } from "./types";
// @ts-expect-error cloudflare types
import { EmailMessage } from "cloudflare:email";

export class EmailKitCore {
	protected middlewares: Middleware[] = [];

	use(middleware: Middleware): this {
		this.middlewares.push(middleware);
		return this;
	}

	async handle(ctx: Context) {
		const execute = async (index: number) => {
			if (index < this.middlewares.length) {
				let used = false;
				const middleware = this.middlewares[index];
				await middleware.handle(ctx, () => {
					if (used) {
						throw new Error(
							`next() called multiple times in middleware ${middleware.name}`,
						);
					}
					used = true;
					return execute(index + 1);
				});
			}
		};

		await execute(0);
	}
}

export class EmailKit extends EmailKitCore {
	async process(message: ForwardableEmailMessage) {
		let _raw: Promise<Uint8Array> | undefined;

		const ctx: Context = {
			message: {
				raw: () => {
					if (!_raw) {
						_raw = stream2buffer(message.raw, message.rawSize);
					}
					return _raw;
				},
				size: message.rawSize,
				headers: message.headers,
				from: message.from,
				to: message.to,
				reject: message.setReject.bind(message),
				forward: message.forward.bind(message),
				reply: (mime: MIMEMessage) => {
					// @ts-expect-error reply not yet typed
					return message.reply(new EmailMessage(message.to, message.from, mime.asRaw()));
				},
			},
		};

		return this.handle(ctx);
	}
}

async function stream2buffer(stream: ReadableStream, size: number): Promise<Uint8Array> {
	const result = new Uint8Array(size);
	const reader = stream.getReader();

	let bytes_read = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		result.set(value, bytes_read);
		bytes_read += value.length;
	}

	return result;
}
