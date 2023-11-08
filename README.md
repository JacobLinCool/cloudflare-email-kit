# Cloudflare Email Kit

Easily handle incoming and outgoing emails on Cloudflare Workers.

## Features

- Middleware system for processing emails
- Router for advanced email routing
- Save emails to R2 Object Storage and D1 Database
- Integration with Cloudflare Queues to shift email processing workloads
- Utilities for sending emails

## Examples

### Router

See [examples/router](examples/router/).

```ts
import { CATCH_ALL, EmailKit, EmailRouter, REJECT_ALL, SizeGuard, respond } from "cloudflare-email";
import { Backup } from "cloudflare-email-backup";

export interface Env {
    R2: R2Bucket;
    D1: D1Database;
    NOTIFICATION_EMAIL: string;
}

export default {
    async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
        const router = new EmailRouter()
            // handle auto-sent emails
            .match(
                (m) => m.isAuto(),
                (m) => m.forward(env.NOTIFICATION_EMAIL),
            )
            // use a sub-router to handle subdomain emails
            .match(
                /@test\.csie\.cool$/,
                new EmailRouter()
                    .match(/^admin@/, async (message) => {
                        const msg = respond(message);
                        msg.addMessage({
                            contentType: "text/plain",
                            data: "Hello, I'm the admin!",
                        });
                        await message.reply(msg);
                    })
                    .match(
                        // function matchers are also supported, even async ones which query databases
                        (m) => m.from.length % 2 === 0,
                        async (message) => {
                            const msg = respond(message);
                            msg.addMessage({
                                contentType: "text/plain",
                                data: `The length of your email address is even!`,
                            });
                            await message.reply(msg);
                        },
                    )
                    .match(CATCH_ALL, async (message) => {
                        const msg = respond(message);
                        msg.addMessage({
                            contentType: "text/plain",
                            data: "The length of your email address is odd!",
                        });
                        await message.reply(msg);
                    }),
            )
            .match(...REJECT_ALL("Your email is rejected! :P"));

        const kit = new EmailKit()
            .use(new SizeGuard(10 * 1024 * 1024))
            .use(
                new Backup({
                    bucket: env.R2,
                    prefix: "backup",
                    database: env.D1,
                    table: "emails",
                }),
            )
            .use(router);

        await kit.process(message);
    },
};
```

### Parser

See [examples/parser](examples/parser/).

```ts
import { EmailKit, SizeGuard, respond } from "cloudflare-email";
import { ParsedContext, Parser } from "cloudflare-email-parser";

export interface Env {
    R2: R2Bucket;
}

export default {
    async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
        const kit = new EmailKit()
            .use(new SizeGuard(10 * 1024 * 1024))
            .use(new Parser())
            .use({
                name: "save-attechments",
                async handle(ctx: ParsedContext) {
                    for (const attachment of ctx.parsed.attachments) {
                        const { filename, content, mimeType } = attachment;
                        const key = `attachments/${ctx.parsed.messageId}/${filename}`;
                        console.log(`Saving attachment ${filename} to ${key} ...`);
                        await env.R2.put(key, content, {
                            customMetadata: { mime: mimeType },
                        });
                        console.log(`Saved attachment ${filename} to ${key}.`);
                    }

                    const res = respond(ctx.message);
                    res.addMessage({
                        contentType: "text/plain",
                        data: `${ctx.parsed.attachments.length} attachments saved.`,
                    });
                    await ctx.message.reply(res);
                },
            });

        await kit.process(message);
    },
};
```

### Cloudflare Queues

See [examples/cloudflare-queues](examples/cloudflare-queues/).

```ts
import { EmailKit, EmailRouter, SizeGuard, respond } from "cloudflare-email";
import { Backup } from "cloudflare-email-backup";
import { EmailQueue, EmailQueueMessage } from "cloudflare-email-queue";

export interface Env {
    R2: R2Bucket;
    D1: D1Database;
    FIRST: Queue<EmailQueueMessage>;
    SECOND: Queue<EmailQueueMessage>;
}

export default {
    // receive email, perform size check, and enqueue it to the coresponding queue
    async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
        const router = new EmailRouter()
            .match(/@first\.csie\.cool$/, new EmailQueue(env.FIRST))
            .match(/@second\.csie\.cool$/, new EmailQueue(env.SECOND));

        const kit = new EmailKit()
            .use(new SizeGuard(10 * 1024 * 1024))
            .use(
                new Backup({
                    bucket: env.R2,
                    prefix: "backup",
                    database: env.D1,
                    table: "emails",
                }),
            )
            .use(router);

        await kit.process(message);
    },
    // checkout the queued messages and process them
    async queue(batch: MessageBatch<EmailQueueMessage>, env: Env) {
        const backup = new Backup({
            bucket: env.R2,
            prefix: "backup",
            database: env.D1,
            table: "emails",
        });

        // retrieve and re-construct the message
        const retrieve = async (m: EmailQueueMessage) => {
            const raw = await backup.retrieve(m.message_id, m.from, m.to);
            if (!raw) {
                throw new Error("Cannot retrieve message.");
            }
            return EmailQueue.retrieve(m, raw);
        };

        if (batch.queue === "kit-example-first-email-queue") {
            for (const m of batch.messages) {
                const message = await retrieve(m.body);

                await new EmailKit()
                    .use({
                        name: "first domain",
                        async handle(ctx) {
                            const reply = respond(ctx.message);
                            reply.addMessage({
                                contentType: "text/plain",
                                data: "Greeting from first domain.",
                            });
                            await ctx.message.reply(reply);
                        },
                    })
                    .handle({ message });

                m.ack();
            }
        } else if (batch.queue === "kit-example-second-email-queue") {
            for (const m of batch.messages) {
                const message = await retrieve(m.body);

                await new EmailKit()
                    .use({
                        name: "second domain",
                        async handle(ctx) {
                            const reply = respond(ctx.message);
                            reply.addMessage({
                                contentType: "text/plain",
                                data: "Greeting from second domain.",
                            });

                            await ctx.message.reply(reply);
                        },
                    })
                    .handle({ message });

                m.ack();
            }
        }
    },
};
```
