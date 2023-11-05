import type { Context, EnhancedMessage, Middleware } from "cloudflare-email-kit";
import type {
	EmailHandler,
	EmailMatcher,
	EmailRouteHandleResult,
	EmailRouteRule,
	EmailRouterConfig,
} from "./types";

let _router_counter = 0;

export class EmailRouter implements Middleware {
	protected rules: EmailRouteRule[] = [];

	constructor(protected config: EmailRouterConfig = { name: `router-${_router_counter++}` }) {}

	get name(): string {
		return this.config.name;
	}

	/**
	 * Matches the given email message against the defined rules and returns the first matching rule.
	 * @param message The email message to match against the rules.
	 * @returns The first matching rule or null if no rule matches the message.
	 */
	public async checkout(message: EnhancedMessage): Promise<EmailRouteRule | null> {
		for (const rule of this.rules) {
			const matched = await rule.match(message);
			if (matched) {
				return rule;
			}
		}
		return null;
	}

	/**
	 * Processes the email message and returns the result of the matching route handle.
	 * @param ctx - The email context object.
	 * @param next - The next middleware function.
	 * @returns An object containing the matched route handle or null if no match was found.
	 */
	public async process(
		ctx: Context,
		next?: () => Promise<void>,
	): Promise<EmailRouteHandleResult> {
		const matched = await this.checkout(ctx.message);
		if (matched) {
			await matched.handle(ctx, next || (() => Promise.resolve()));
			return { matched };
		}

		return { matched: null };
	}

	public async handle(ctx: Context, next?: () => Promise<void>): Promise<void> {
		await this.process(ctx, next);
	}

	/**
	 * Adds a new route rule to the router's list of rules.
	 * The first added rule will be checked first.
	 * @param matcher The matcher to use for this rule.
	 * @param handler The handler to use for this rule.
	 * @returns The router itself.
	 */
	public match(matcher: EmailMatcher, handler: EmailHandler | Middleware): this;
	public match(matcher: EmailMatcher, subrouter: EmailRouter): this;
	public match(
		matcher: EmailMatcher,
		handler_subrouter: EmailHandler | EmailRouter | Middleware,
	): this {
		let name = "";

		if (typeof matcher === "string") {
			name = matcher;
			matcher = (message: EnhancedMessage) => new RegExp(`^${matcher}$`).test(message.to);
		} else if (matcher instanceof RegExp) {
			const regex = matcher;
			name = regex.source;
			matcher = (message: EnhancedMessage) => regex.test(message.to);
		} else if (typeof matcher === "function") {
			name = matcher.name;
		}

		if (handler_subrouter instanceof EmailRouter) {
			const precondition = matcher;
			const subrouter = handler_subrouter;
			name = `${name} (${subrouter.config.name})`;
			matcher = async (message: EnhancedMessage) => {
				if (await precondition(message)) {
					return subrouter.checkout(message) !== null;
				}
				return false;
			};
		} else if (typeof handler_subrouter === "function") {
			const handler = handler_subrouter;
			const anonymous_middleware: Middleware = {
				name: handler_subrouter.name,
				async handle(ctx, next) {
					await handler(ctx.message);
					await next();
				},
			};
			handler_subrouter = anonymous_middleware;
		}

		this.rules.push({
			name,
			match: matcher,
			handle: handler_subrouter.handle.bind(handler_subrouter),
		});

		return this;
	}
}
