import debug from "debug";
import type { MIMEMessage } from "mimetext";

let _dryrun = false;

export function set_default_dryrun(dryrun: boolean) {
	_dryrun = dryrun;
}

/**
 * Sends an email message using the MailChannels API.
 * @param message The {@link MIMEMessage} to send.
 * @param dry Whether to dry-run the request. Defaults to false.
 * @throws An error if there are no recipients or sender found, or if the API request fails.
 */
export async function mailchannels(message: MIMEMessage, dry = _dryrun): Promise<void> {
	const log = debug("mailchannels");
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
				log(`Skipping MailChannels address "${box.addr}" to prevent feedback loop.`);
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
		log("Found plain text message");
		content.push({ type: "text/plain", value: text.data });
	}

	const html = message.getMessageByType("text/html");
	if (html) {
		log("Found HTML message");
		content.push({ type: "text/html", value: html.data });
	}

	for (const attachment of message.getAttachments()) {
		const type = attachment.getHeader("Content-Type");
		if (typeof type !== "string") {
			continue;
		}
		log(`Found attachment with type "${type}"`, attachment.data.length);

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

	const from = {
		email: sender.addr,
		name: sender.name,
	};

	const reply_to_raw = message.headers.get("Reply-To");
	const reply_to = reply_to_raw
		? typeof reply_to_raw === "string"
			? {
					email: reply_to_raw,
			  }
			: {
					name: reply_to_raw.name,
					email: reply_to_raw.addr,
			  }
		: undefined;

	const payload = {
		personalizations,
		from,
		headers,
		subject: message.getSubject() || "",
		content,
		reply_to,
	};
	log(personalizations, from, headers);

	const req = new Request(
		"https://api.mailchannels.net/tx/v1/send" + (dry ? "?dry-run=true" : ""),
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(payload),
		},
	);

	const res = await fetch(req);
	if (!res.ok) {
		throw new Error(`Failed to send email: ${res.status} ${await res.text()}`);
	}

	log("Email sent successfully.");
	log(await res.text());
}
