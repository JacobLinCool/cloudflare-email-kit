import type { EmailMessage, Headers } from "@cloudflare/workers-types";
import { MIMEMessage } from "mimetext";

export interface EnhancedMessage extends EmailMessage {
	/**
	 * The email message content.
	 */
	readonly raw: () => Promise<Uint8Array>;

	/**
	 * Size of the email message content.
	 */
	readonly size: number;

	/**
	 * The email message headers.
	 */
	readonly headers: Headers;

	/**
	 * Reject this email message by returning a permanent SMTP error back to the connecting client including the given reason.
	 * @param reason The reject reason.
	 */
	reject?(reason: string): void;

	/**
	 * Forward this email message to a verified destination address of the account.
	 * @param to Verified destination address.
	 * @param headers A [Headers object](https://developer.mozilla.org/en-US/docs/Web/API/Headers).
	 * @returns A promise that resolves when the email message is forwarded.
	 */
	forward(to: string, headers?: Headers): Promise<void>;

	/**
	 * Reply to this email message.
	 */
	reply(message: MIMEMessage): Promise<void>;

	/**
	 * Whether this email message is sent automatically. (Check the `Auto-Submitted` header)
	 * @returns `true` if the email message is sent automatically, `false` otherwise.
	 *
	 * @see https://tools.ietf.org/html/rfc3834
	 */
	isAuto(): boolean;
}

export interface Context {
	message: EnhancedMessage;
}

export interface Middleware<In extends Context = Context, Out extends Context = In> {
	name: string;
	handle(
		ctx: In,
		next: In extends Out ? () => Promise<void> : (ctx: Out) => Promise<void>,
	): Promise<void> | void;
}

export type MiddlewareOrHandle<In extends Context = Context, Out extends Context = In> =
	| Middleware<In, Out>
	| Middleware<In, Out>["handle"];

export type MiddlewareOutput<M extends Middleware | Middleware["handle"]> = M extends Middleware<
	Context,
	infer Out
>
	? Out
	: M extends Middleware<Context, infer Out>["handle"]
	? Out
	: never;
