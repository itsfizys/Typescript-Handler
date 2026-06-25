# Typescript-Handler

A production-ready Discord.js bot handler written in **TypeScript** — rewritten from [bre4d777/handler](https://github.com/bre4d777/handler) (JavaScript) by **itsfizys**.

**Support Server:** [discord.gg/aerox](https://discord.gg/aerox)

---

## Features

- **Prefix & Slash Commands** — unified `CommandContext` abstracts both so command logic is written once
- **Abstract Command Class** — TypeScript enforces `execute()` implementation at compile time; forgetting it is a build error, not a runtime crash
- **Auto Command Loader** — recursively scans `src/commands/` and registers everything, no manual imports
- **Slash Command Registration** — owner-only `.slash` command pushes all slash-enabled commands to Discord globally
- **Redis + Memory Cache** — pluggable cache layer; uses Redis when available, falls back to in-process memory automatically
- **PostgreSQL via Drizzle ORM** — type-safe queries, schema migrations with `drizzle-kit`
- **Blacklist System** — per-user and per-guild blacklisting backed by the database
- **Per-guild Prefixes** — each server can configure its own command prefix
- **Channel Ignore** — disable commands in specific channels without removing permissions
- **Cooldown System** — per-user per-guild cooldowns stored in cache; deduped cooldown notifications
- **Button Cooldowns** — atomic `SETNX` prevents race conditions on interactive buttons
- **Permission Validation** — user perms, bot perms, voice channel perms, owner-only, maintenance mode — all checked before execution
- **DM Fallback** — if the bot can't send in a channel, errors are DM'd to the user instead of silently dropped
- **Graceful Shutdown** — `SIGINT`/`SIGTERM` flush cache and close DB connections before exit

---

## Project Structure

```
src/
├── bot.ts                          # Entry point
├── config/
│   ├── config.ts                   # Merges common + env-specific config
│   ├── config.dev.ts               # Dev environment values
│   ├── config.prod.ts              # Prod environment values
│   └── emoji.ts                    # All emojis in one place
├── commands/
│   ├── dev/
│   │   ├── blacklist.ts            # Manage user/guild blacklist
│   │   └── slash.ts               # Register slash commands globally
│   └── meta/
│       ├── config/
│       │   ├── ignore.ts           # Toggle command channels
│       │   ├── prefix.ts           # Set guild prefix
│       │   └── setprofile.ts       # Custom profile settings
│       └── general/
│           ├── help.ts             # Help command
│           ├── invite.ts           # Bot invite link
│           ├── ping.ts             # Latency info
│           └── support.ts          # Support server link
├── database/
│   ├── drizzle.ts                  # Drizzle client setup
│   ├── manager.ts                  # DB manager (guilds + blacklist)
│   ├── schema/                     # Table definitions
│   ├── repositories/               # Raw DB queries
│   └── services/                   # Business logic on top of repos
├── events/
│   └── discord/
│       ├── clientReady.ts          # Bot ready event
│       └── guild/
│           ├── Prefixcmd.ts        # Prefix command handler
│           └── slashcmd.ts         # Slash command handler
├── structures/
│   ├── classes/
│   │   ├── cache.ts                # Redis/memory cache manager
│   │   ├── client.ts               # Extended Discord.js Client
│   │   ├── command.ts              # Abstract base Command class
│   │   ├── context.ts              # Unified CommandContext (prefix + slash)
│   │   └── rei.ts                  # In-process LRU store (memory cache backend)
│   └── handlers/
│       ├── commandHandler.ts       # Loads commands, manages cooldowns
│       ├── eventLoader.ts          # Loads and registers events
│       └── event-handlers/
│           └── discord.ts          # Discord event dispatcher
├── types/
│   └── index.ts                    # Shared TypeScript interfaces
└── utils/
    ├── common.ts                   # sleep, display width helpers
    ├── disableComponents.ts        # Disables buttons/components on a message
    ├── index.ts                    # Re-exports all utils
    ├── logger.ts                   # Coloured console logger
    └── permissionHandler.ts        # Permission checks + command validation
```

---

## Setup

### Requirements

- Node.js 20+
- PostgreSQL database
- Redis (optional — falls back to memory)

### Environment Variables

Create a `.env` file or set these in your environment:

```env
TOKEN=your_discord_bot_token
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
REDIS_URL=rediss://...          # optional
NODE_ENV=development            # or production
```

### Install & Run

```bash
npm install          # install dependencies

npm run push         # push DB schema (first time only)

npm run dev          # start with auto-reload (development)
npm run start        # start without watch (production)
```

---

## Adding a Command

Create a file anywhere inside `src/commands/` — the loader picks it up automatically.

```ts
import { Command } from '#command';

class MyCommand extends Command {
    constructor() {
        super({
            name: 'mycommand',
            description: 'Does something',
            aliases: ['mc'],
            cooldown: 5,
            enabledSlash: true,
            slashData: {
                name: 'mycommand',
                description: 'Does something',
            },
        });
    }

    async execute({ ctx }) {
        await ctx.reply('Hello!');
    }
}

export default new MyCommand();
```

`ctx` is a `CommandContext` — it works for both prefix and slash commands transparently.

### Subcommands

Use an array for `name` to create subcommand groups:

```ts
name: ['config', 'prefix'],      // → .config prefix  /  /config prefix
name: ['config', 'set', 'role'], // → .config set role / /config set role
```

---

## Registering Slash Commands

Run the `.slash` command in Discord (owner only). It will:

1. Scan all loaded commands for `enabledSlash: true`
2. Validate command names
3. Clear existing global slash commands
4. Push the new set globally

> Global slash commands take up to **1 hour** to propagate to all servers.

---

## Command Options

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string \| string[]` | required | Command name or subcommand path |
| `description` | `string` | `'No description provided'` | Short description |
| `aliases` | `string[]` | `[]` | Alternative names (prefix only) |
| `usage` | `string` | command name | Usage hint shown in help |
| `examples` | `string[]` | `[]` | Example invocations |
| `category` | `string` | `'Miscellaneous'` | Auto-set from folder name |
| `cooldown` | `number` | `3` | Cooldown in seconds |
| `ownerOnly` | `boolean` | `false` | Restrict to owner IDs |
| `enabledSlash` | `boolean` | `false` | Register as slash command |
| `slashData` | `SlashCommandData \| null` | `null` | Slash command metadata |
| `permissions` | `PermissionResolvable[]` | `[]` | Required bot permissions |
| `userPermissions` | `PermissionResolvable[]` | `[]` | Required user permissions |
| `maintenance` | `boolean` | `false` | Disable for non-owners |
| `shouldNotDefer` | `boolean` | `false` | Skip auto-defer on slash |
| `voiceRequired` | `boolean` | `false` | Require user in voice |
| `sameVoiceChannel` | `boolean` | `false` | Require same voice channel |

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with `--watch` (auto-reload on file change) |
| `npm run start` | Start without watch |
| `npm run push` | Push schema changes to DB |
| `npm run generate` | Generate a new migration file |
| `npm run studio` | Open Drizzle Studio (DB GUI) |
| `npm run format` | Format all `.ts` files with Prettier |
| `npm run typecheck` | Run TypeScript type check without emitting |

---

## Credits

- Original JS handler: [bre4d777/handler](https://github.com/bre4d777/handler)
- TypeScript rewrite: **itsfizys**
