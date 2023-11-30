# Cloudflare Email Mailchannels

Send emails via Mailchannels on Cloudflare Workers.

### Pre-requisites

To use Mailchannels with Cloudflare Workers, you will need to:

1. Setup [SPF records](https://support.mailchannels.com/hc/en-us/articles/200262610-Set-up-SPF-Records) for your domain

```ts
example.com TXT "v=spf1 include:_spf.mx.cloudflare.net include:email.cloudflare.net include:relay.mailchannels.net ~all"
```

2. Setup [Domain Lockdown<sup>TM</sup>](https://support.mailchannels.com/hc/en-us/articles/16918954360845)

```ts
_mailchannels.example.com TXT "v=mc1 cfid=your.workers.dev"
```

3. Now you can send emails via Mailchannels on Cloudflare Workers! 🎉
