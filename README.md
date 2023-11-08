# Cloudflare Email Kit

Easily handle incoming and outgoing emails on Cloudflare Workers.

## Features

- Middleware system for processing emails
- Router for advanced email routing
- Save emails to R2 Object Storage and D1 Database
- Integration with Cloudflare Queues to shift email processing workloads
- Utilities for sending emails

## Example

> Simplified Support Ticket System

```ts
import {
    CATCH_ALL,
    EmailKit,
    EmailRouter,
    EnhancedMessage,
    REJECT_ALL,
    SizeGuard,
    createMimeMessage,
    mailchannels,
    respond,
} from "cloudflare-email";
import { Backup } from "cloudflare-email-backup";

export interface Env {
    R2: R2Bucket;
    D1: D1Database;
}

export default {
    async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
        const router = new EmailRouter()
            .match(/^hi@csie\.cool$/, hello)
            .match(/^support@csie\.cool$/, ticket_create(env.D1))
            .match(
                /@support\.csie\.cool$/,
                new EmailRouter()
                    .match(/^ticket-.+@/, ticket_followup(env.D1))
                    .match(CATCH_ALL, fallback_handler),
            )
            // simply reject all other emails
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

async function hello(message: EnhancedMessage): Promise<void> {
    const msg = respond(message);
    msg.addMessage({
        contentType: "text/plain",
        data: `Hello, ${message.from}!`,
    });

    await message.reply(msg);
}

function ticket_create(database: D1Database): (message: EnhancedMessage) => Promise<void> {
    return async (message) => {
        // generate Ticket ID and store it in the database
        const ticket_id = await generate_ticket(database, message);

        const msg = createMimeMessage();
        msg.setSender(`ticket-${ticket_id}@support.csie.cool`);
        msg.setRecipient(message.from);
        msg.setSubject(`Re: ${message.headers.get("Subject")}`);
        msg.addMessage({
            contentType: "text/plain",
            data: `Hello, ${message.from}. We have received your request. Your ticket ID is ${ticket_id}.`,
        });

        await mailchannels(msg);
    };
}

function ticket_followup(database: D1Database): (message: EnhancedMessage) => Promise<void> {
    return async (message) => {
        const ticket_id = message.to.split("@")[0].split("-")[1];

        // get ticket from database
        const ticket = await retrieve_ticket(database, ticket_id);
        if (!ticket) {
            const msg = respond(message);
            msg.addMessage({
                contentType: "text/plain",
                data: `Sorry, we cannot find ticket #${ticket_id}.`,
            });

            await message.reply(msg);
            return;
        }

        // ... handle ticket followup
    };
}

async function fallback_handler(message: EnhancedMessage): Promise<void> {
    const msg = respond(message);
    msg.addMessage({
        contentType: "text/plain",
        data: "You can create a ticket by sending an email to support@csie.cool",
    });

    await message.reply(msg);
}
```

> Initialize D1
>
> ```sql
> CREATE TABLE `emails` (
>     `id` TEXT PRIMARY KEY NOT NULL,
>     `from` TEXT NOT NULL,
>     `to` TEXT NOT NULL,
>     `key` TEXT
> );
> ```
