# Cloudflare Email Router

Support advanced routing on Cloudflare Workers.

## Usage

The router serves as a middleware for the `EmailKit`.

### Matcher

The matchers are executed in order, and the first matched handler will be executed.

The matchers can be a string (to test with `message.to`), a regex (to test with `message.to`), or a function (to test with the whole `message`).

The async matcher is also supported to provide more flexibility (e.g. to query the database).

### Handler

The handler can be a function or another middleware, including another router.

```ts
import { CATCH_ALL, EmailKit, EmailRouter, REJECT_ALL, SizeGuard, respond } from "cloudflare-email";
import { Backup } from "cloudflare-email-backup";

export interface Env {
    R2: R2Bucket;
    D1: D1Database;
}

export default {
    async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
        const router = new EmailRouter()
            .match(/^admin@test\.csie\.cool$/, async (message) => {
                const msg = respond(message);
                msg.addMessage({ contentType: "text/plain", data: "Hello, I'm the admin!" });
                await message.reply(msg);
            })
            .match(
                /@test\.csie\.cool$/,
                new EmailRouter()
                    .match(
                        (m) => m.from.length % 2 === 0,
                        async (message) => {
                            const msg = respond(message);
                            msg.addMessage({
                                contentType: "text/plain",
                                data: `Hello, ${message.from}! Why are you sending email to ${message.to}?`,
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
