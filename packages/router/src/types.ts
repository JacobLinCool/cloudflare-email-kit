import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import type { Middleware } from "cloudflare-email-kit";

export interface EmailRouterConfig {
	name: string;
}

export type EmailMatcher =
	| RegExp
	| string
	| ((message: ForwardableEmailMessage) => Promise<boolean> | boolean);

export type EmailHandler = (message: ForwardableEmailMessage) => Promise<void> | void;

export interface EmailRouteMatcher {
	name: string;
	match: (message: ForwardableEmailMessage) => Promise<boolean> | boolean;
}

export type EmailRouteRule = EmailRouteMatcher & Middleware;

export interface EmailRouteHandleResult {
	matched: EmailRouteRule | null;
}
