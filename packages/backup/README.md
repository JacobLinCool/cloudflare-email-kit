# Cloudflare Email Backup

Backup incoming and outgoing emails with Cloudflare R2 and D1.

> R2 is required, D1 is optional.

## Initialize D1

```sql
CREATE TABLE `emails` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `from` TEXT NOT NULL,
    `to` TEXT NOT NULL,
    `key` TEXT
);
```

## Usage

Store all incoming emails (and replies) to R2 (`backup/<domain>/<username>/<message-id>.eml`, e.g. `backup/example.com/john.doe/123456789.eml`) and D1.

```ts
import { EmailKit, EmailRouter, REJECT_ALL } from "cloudflare-email";
import { Backup } from "cloudflare-email-backup";

interface Env {
    R2: R2Bucket;
    D1: D1Database;
}

export default {
    async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
        const router = new EmailRouter()
            .match(/@some\.domain$/, some_handler)
            .match(...REJECT_ALL("Your email is rejected! :P"));

        const kit = new EmailKit()
            .use(new Backup({ bucket: env.R2, prefix: "backup", database: env.D1 }))
            .use(router);

        await kit.process(message);
    },
};
```
