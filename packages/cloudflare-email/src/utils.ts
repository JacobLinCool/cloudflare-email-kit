import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
// @ts-expect-error cloudflare types
import { EmailMessage } from "cloudflare:email";
import type { MIMEMessage } from "mimetext";
import { createMimeMessage } from "mimetext";
import { ReplyMessage } from "./types";

/**
 * Creates a reply message based on the given {@link ForwardableEmailMessage}.
 * @param message - The message to reply to.
 * @returns The created reply message.
 */
export function respond(message: ForwardableEmailMessage): ReplyMessage {
	const msg = createMimeMessage();

	msg.setHeader("In-Reply-To", message.headers.get("Message-ID"));
	msg.setSender(message.to);
	msg.setRecipient(message.from);

	const subject = message.headers.get("Subject");
	if (subject) {
		msg.setSubject(
			subject.substring(0, 3).toLowerCase() === "re:" ? subject : `Re: ${subject}`,
		);
	}

	const build = () => new EmailMessage(message.to, message.from, msg.asRaw());
	return Object.assign(msg, { build });
}

/**
 * Converts an ArrayBuffer to a base64 string.
 * @param buffer - The ArrayBuffer to be converted.
 * @returns The base64 string representation of the ArrayBuffer.
 */
export function ab2b64(buffer: ArrayBuffer) {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * Sends an email message using the MailChannels API.
 * @param message The {@link MIMEMessage} to send.
 * @throws An error if there are no recipients or sender found, or if the API request fails.
 */
export async function mailchannels(message: MIMEMessage): Promise<void> {
	let recipients = message.getRecipients();
	if (!recipients) {
		throw new Error("No recipients found.");
	}
	if (!Array.isArray(recipients)) {
		recipients = [recipients];
	}

	const sender = message.getSender();
	if (!sender) {
		throw new Error("No sender found.");
	}

	const personalizations = recipients
		.map((box) => {
			// Skip MailChannels' own addresses
			if (box.addr.includes("@mailchannels.net")) {
				return null;
			}

			if (box.type === "To") {
				return { to: [{ email: box.addr, name: box.name }] };
			} else if (box.type === "Cc") {
				return { cc: [{ email: box.addr, name: box.name }] };
			} else if (box.type === "Bcc") {
				return { bcc: [{ email: box.addr, name: box.name }] };
			}

			return null;
		})
		.filter((it) => it !== null);
	if (personalizations.length === 0) {
		throw new Error("No recipients found.");
	}

	const content: { type: string; value: string }[] = [];

	const text = message.getMessageByType("text/plain");
	if (text) {
		content.push({ type: "text/plain", value: text.data });
	}

	const html = message.getMessageByType("text/html");
	if (html) {
		content.push({ type: "text/html", value: html.data });
	}

	for (const attachment of message.getAttachments()) {
		const type = attachment.getHeader("Content-Type");
		if (typeof type !== "string") {
			continue;
		}

		content.push({ type, value: attachment.data });
	}

	const reserved = [
		"received",
		"dkim-signature",
		"content-type",
		"content-transfer-encoding",
		"to",
		"from",
		"subject",
		"reply-to",
		"cc",
		"bcc",
	];
	const headers = message.headers.fields.reduce(
		(acc, field) => {
			if (typeof field.name === "string" && typeof field.value === "string") {
				if (reserved.includes(field.name.toLowerCase())) {
					return acc;
				}

				acc[field.name] = field.value;
			}
			return acc;
		},
		{} as Record<string, string>,
	);

	const payload = {
		personalizations,
		from: {
			email: sender.addr,
			name: sender.name,
		},
		headers,
		subject: message.getSubject() || "",
		content,
	};
	console.log(JSON.stringify(payload, null, 2));

	const req = new Request("https://api.mailchannels.net/tx/v1/send", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const res = await fetch(req);
	if (!res.ok) {
		throw new Error(`Failed to send email: ${res.status} ${await res.text()}`);
	}
}
