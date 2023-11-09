import type { Context } from "cloudflare-email-kit";
import type { Email as ParsedEmail } from "postal-mime";

export interface ParsedContext extends Context {
	parsed: ParsedEmail;
}
