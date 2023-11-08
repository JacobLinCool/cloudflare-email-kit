import { Context } from "cloudflare-email-kit";
import { Email as ParsedEmail } from "postal-mime";

export interface ParsedContext extends Context {
	parsed: ParsedEmail;
}
