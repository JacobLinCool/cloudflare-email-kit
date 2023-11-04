import type { EmailMessage } from "@cloudflare/workers-types";
import type { MIMEMessage } from "mimetext";

export interface ReplyMessage extends MIMEMessage {
	build(): EmailMessage;
}
