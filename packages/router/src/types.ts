import type { EnhancedMessage, Middleware } from "cloudflare-email-kit";

export interface EmailRouterConfig {
	name: string;
}

export type EmailMatcher =
	| RegExp
	| string
	| ((message: EnhancedMessage) => Promise<boolean> | boolean);

export type EmailHandler = (message: EnhancedMessage) => Promise<void> | void;

export interface EmailRouteMatcher {
	name: string;
	match: (message: EnhancedMessage) => Promise<boolean> | boolean;
}

export type EmailRouteRule = EmailRouteMatcher & Middleware;

export interface EmailRouteHandleResult {
	matched: EmailRouteRule | null;
}
