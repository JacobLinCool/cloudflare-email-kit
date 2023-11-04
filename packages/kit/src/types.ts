import type { ForwardableEmailMessage } from "@cloudflare/workers-types";

export interface Context {
	message: ForwardableEmailMessage;
}

export interface Middleware<C extends Context = Context> {
	name: string;
	handle(ctx: C, next: () => Promise<void>): Promise<void> | void;
}
