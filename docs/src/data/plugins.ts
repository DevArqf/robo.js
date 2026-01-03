export interface Plugin {
  name: string
  package: string
  description: string
  docsUrl?: string
  npmUrl: string
  category: "official" | "community"
  icon?: string
}

export const officialPlugins: Plugin[] = [
  {
    name: "AI",
    package: "@robojs/ai",
    description: "Transform your Robo into a personalized AI chatbot with voice support and Discord command execution.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/ai",
    category: "official",
  },
  {
    name: "Analytics",
    package: "@robojs/analytics",
    description: "Track user interactions and server activity with Google Analytics, Plausible, and custom providers.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/analytics",
    category: "official",
  },
  {
    name: "Auth",
    package: "@robojs/auth",
    description: "Auth.js powered sign-in, sessions, and verification flows for Robo.js.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/auth",
    category: "official",
  },
  {
    name: "Better Stack",
    package: "@robojs/better-stack",
    description: "Visualize uptime and search logs in an appealing and searchable format.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/better-stack",
    category: "official",
  },
  {
    name: "Cron",
    package: "@robojs/cron",
    description: "Easily schedule and manage recurring tasks with cron expressions.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/cron",
    category: "official",
  },
  {
    name: "Dev",
    package: "@robojs/dev",
    description: "Utilities to test Robo APIs, monitor resources, and replicate specific behaviors.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/dev",
    category: "official",
  },
  {
    name: "Giveaways",
    package: "@robojs/giveaways",
    description: "One-click Discord giveaways with automatic winner selection and persistent storage.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/giveaways",
    category: "official",
  },
  {
    name: "i18n",
    package: "@robojs/i18n",
    description: "Safely translate your Robo and Discord slash commands with locale management.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/i18n",
    category: "official",
  },
  {
    name: "Maintenance",
    package: "@robojs/maintenance",
    description: "Add a maintenance mode to your Robo with easy toggles and notifications.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/maintenance",
    category: "official",
  },
  {
    name: "Moderation",
    package: "@robojs/moderation",
    description: "Equip your bot with essential tools to manage and maintain your server.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/moderation",
    category: "official",
  },
  {
    name: "Patch",
    package: "@robojs/patch",
    description: "A collection of patches optimized for Robo.js Discord Activities.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/patch",
    category: "official",
  },
  {
    name: "Roadmap",
    package: "@robojs/roadmap",
    description: "Sync project roadmaps from Jira to organized Discord forum channels.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/roadmap",
    category: "official",
  },
  {
    name: "Server",
    package: "@robojs/server",
    description: "Create and manage web pages, APIs, and more with file-based routing.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/server",
    category: "official",
  },
  {
    name: "Sync",
    package: "@robojs/sync",
    description: "Real-time state sync for multiplayer games and apps via useSyncState.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/sync",
    category: "official",
  },
  {
    name: "tRPC",
    package: "@robojs/trpc",
    description: "Fully managed tRPC optimized for Robo.js with type-safe API layer.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/trpc",
    category: "official",
  },
  {
    name: "XP",
    package: "@robojs/xp",
    description: "MEE6-parity XP and leveling system with role rewards and multipliers.",
    docsUrl: "/docs/plugins",
    npmUrl: "https://www.npmjs.com/package/@robojs/xp",
    category: "official",
  },
]

export const communityPlugins: Plugin[] = [
  {
    name: "API Sync",
    package: "api-sync-robojs",
    description: "Real-time state sync across clients and server the simplest way possible.",
    npmUrl: "https://www.npmjs.com/package/api-sync-robojs",
    category: "community",
  },
  {
    name: "Community Challenges",
    package: "community-challenges",
    description: "Submit your challenge ideas to the community challenges directly from your bot.",
    npmUrl: "https://www.npmjs.com/package/community-challenges",
    category: "community",
  },
  {
    name: "Discord User Profile",
    package: "discord-user-profile",
    description: "Create your own user profile on a Discord server and share it. Allow anyone to do the same.",
    npmUrl: "https://www.npmjs.com/package/discord-user-profile",
    category: "community",
  },
  {
    name: "Emoji Reaction",
    package: "emoji-reaction-plugin",
    description: "Make your conversations fun and interactive with various emoji based reactions.",
    npmUrl: "https://www.npmjs.com/package/emoji-reaction-plugin",
    category: "community",
  },
  {
    name: "Robo Store",
    package: "robo-store",
    description: "A minimal eCommerce solution right into your Discord server and online presence.",
    npmUrl: "https://www.npmjs.com/package/robo-store",
    category: "community",
  },
]

export const communityPluginsSearchUrl = "https://www.npmjs.com/search?q=robo.js%20plugin"
