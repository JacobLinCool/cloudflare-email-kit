import type { EnhancedMessage } from "cloudflare-email-kit";
import type { EmailHandler, EmailMatcher } from "./types";

export const CATCH_ALL = () => true;

export function REJECT_ALL(
	reason = "Sorry, we don't accept emails to this address.",
): [EmailMatcher, EmailHandler] {
	return [CATCH_ALL, (message: EnhancedMessage) => message.reject?.(reason)];
}
