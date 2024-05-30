import type { EnhancedMessage } from "cloudflare-email-kit";
import debug from "debug";
import { createMimeMessage, Mailbox, MIMEMessage } from "mimetext/browser";

const log = debug("cloudflare-email:utils");

/**
 * Creates a reply message based on the given message.
 * @param message - The message to reply to.
 * @returns The created reply message.
 */
export function respond(message: EnhancedMessage): MIMEMessage {
	const msg = createMimeMessage();

	msg.setHeader("In-Reply-To", message.headers.get("Message-ID") ?? "");
	msg.setSender(message.to);
	msg.setRecipient(message.from);

	const subject = message.headers.get("Subject");
	if (subject) {
		msg.setSubject(
			subject.substring(0, 3).toLowerCase() === "re:" ? subject : `Re: ${subject}`,
		);
	}

	return msg;
}

/**
 * Creates a mailbox with the specified address.
 * (tracking: https://github.com/muratgozel/MIMEText/issues/45)
 * @param address - The email address of the mailbox.
 * @returns The mailbox.
 */
export function mailbox(address: string): Mailbox {
	return createMimeMessage().setSender(address);
}

/**
 * Converts an ArrayBuffer to a string.
 * @param buffer - The ArrayBuffer to convert.
 * @returns The converted string.
 */
export function ab2str(buffer: ArrayBuffer) {
	log("Converting ArrayBuffer to string", buffer.byteLength);
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return binary;
}

/**
 * Converts an ArrayBuffer to a base64 string.
 * @param buffer - The ArrayBuffer to be converted.
 * @returns The base64 string representation of the ArrayBuffer.
 */
export function ab2b64(buffer: ArrayBuffer) {
	log("Converting ArrayBuffer to base64", buffer.byteLength);
	return btoa(ab2str(buffer));
}

export function ab27bit(buffer: ArrayBuffer) {
	log("Converting ArrayBuffer to 7bit", buffer.byteLength);

	const bytes = new Uint8Array(buffer);
	let bit_idx = 0;

	// Calculate the new length: every char can only contain 7 bytes of data
	const output_length = Math.ceil((bytes.length * 8) / 7);
	let result = "";

	for (let output_idx = 0; output_idx < output_length; output_idx++) {
		// Read 7 bytes from the input
		let byte_idx = Math.floor(bit_idx / 8);
		let bit_offset = bit_idx % 8;
		bit_idx += 7;

		// 0: >> 1
		// 1: --
		// 2: << 1
		// 3: << 2
		// 4: << 3
		// 5: << 4
		// 6: << 5
		// 7: << 6
		let data = bit_offset === 0 ? bytes[byte_idx] >> 1 : bytes[byte_idx] << (bit_offset - 1);
		if (bit_offset > 1) {
			data |= bytes[byte_idx + 1] >> (9 - bit_offset);
		}

		result += String.fromCharCode(data & 0x7f);
	}

	return result;
}
