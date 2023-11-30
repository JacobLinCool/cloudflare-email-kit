import { ForwardableEmailMessage, ReadableStream } from "@cloudflare/workers-types";
import { MIMEMessage } from "mimetext";
import { Context, Middleware, MiddlewareOrHandle, MiddlewareOutput } from "./types";

export class EmailKitCore<Last extends Context> implements Middleware<Last> {
	name = "EmailKit";

	protected middlewares: Middleware[] = [];

	use<M extends Middleware<Context, any>>(
		middleware: M extends Middleware<infer In> ? (Last extends In ? M : never) : never,
	): EmailKitCore<Last & MiddlewareOutput<M>>;
	use<F extends Middleware<Context, any>["handle"]>(
		middleware: F extends Middleware<infer In>["handle"]
			? Last extends In
				? F
				: never
			: never,
	): EmailKitCore<Last & MiddlewareOutput<F>>;
	use<M extends MiddlewareOrHandle<Context, any>>(
		middleware: M extends MiddlewareOrHandle<infer In> ? (Last extends In ? M : never) : never,
	): EmailKitCore<Last & MiddlewareOutput<M>> {
		if (typeof middleware === "function") {
			this.middlewares.push({
				name: middleware.name,
				handle: middleware,
			});
		} else {
			this.middlewares.push(middleware);
		}
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

export class EmailKit<Last extends Context> extends EmailKitCore<Last> {
	use<M extends Middleware<Context, any>>(
		middleware: M extends Middleware<infer In> ? (Last extends In ? M : never) : never,
	): EmailKit<Last & MiddlewareOutput<M>>;
	use<F extends Middleware<Context, any>["handle"]>(
		middleware: F extends Middleware<infer In>["handle"]
			? Last extends In
				? F
				: never
			: never,
	): EmailKit<Last & MiddlewareOutput<F>>;
	use<M extends Middleware<Context, any>>(
		middleware: M extends Middleware<infer In> ? (Last extends In ? M : never) : never,
	): EmailKit<Last & MiddlewareOutput<M>> {
		super.use(middleware);
		return this;
	}

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
				reply: async (mime: MIMEMessage) => {
					// @ts-expect-error cloudflare types
					const { EmailMessage } = await import("cloudflare:email");
					const msg = new EmailMessage(message.to, message.from, mime.asRaw());
					// @ts-expect-error reply not yet typed
					return message.reply(msg);
				},
				isAuto() {
					const auto = message.headers.get("Auto-Submitted") || "";
					return ["auto-generated", "auto-replied", "auto-notified"].includes(auto);
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
