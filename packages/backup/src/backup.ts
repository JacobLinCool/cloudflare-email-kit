import type { Context, Middleware } from "cloudflare-email-kit";
import debug from "debug";
import type { BackupConfig } from "./types";

const log = debug("email-backup");

export class Backup implements Middleware {
	constructor(protected config: BackupConfig) {}

	get name(): string {
		return "Backup";
	}

	async handle(ctx: Context, next: () => Promise<void>): Promise<void> {
		await this.save(
			ctx.message.headers.get("Message-ID"),
			ctx.message.from,
			ctx.message.to,
			await ctx.message.raw(),
		);

		if (!this.config.disable_reply_backup) {
			const reply = ctx.message.reply;
			ctx.message.reply = async (mime) => {
				const id = mime.getHeader("Message-ID");
				await this.save(
					typeof id === "string" ? id : null,
					ctx.message.to,
					ctx.message.from,
					mime.asRaw(),
				);
				return reply(mime);
			};
		}

		await next();
	}

	async save(
		message_id: string | null | undefined,
		from: string,
		to: string,
		body: Uint8Array | string,
	) {
		const [user, domain] = from.split("@");
		const id = message_id || `noid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const key = `${this.config.prefix}/${domain}/${user}/${id}.eml`;

		const metadata = {
			from,
			to,
		};

		log(`Backing up to ${key} with metadata ${JSON.stringify(metadata)}`);

		await this.config.bucket.put(key, body, {
			customMetadata: metadata,
		});

		log(`Backed up to ${key}`);

		if (this.config.database) {
			const table = this.config.table ?? "emails";
			const db = this.config.database;
			await db
				.prepare("INSERT INTO `" + table.replace(/`/g, "") + "` VALUES (?, ?, ?, ?)")
				.bind(id, metadata.from, metadata.to, key)
				.run();
		}
	}
}
