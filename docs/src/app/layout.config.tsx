import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared"
import Image from "next/image"
import FrameworkPreview from "@/../public/fp.png"
import logo from "@/../public/logo.png"
import { Blocks, BookText, Connect, Discord, DiscordLogo, PartyPopper } from "@/components/ui/icons"

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */

const navLinks = [
  {
    text: "Documentation",
    url: "/docs",
    type: "menu",
    items: [
      {
        text: "Framework",
        icon: <Blocks className="p-1" />,
        url: "/docs/framework",
        description:
          "Explore the core architecture of Robos, covering Bots, Activities, Websites, Plugins, and their interactions.",
        menu: {
          banner: (
            <div className="-mx-3 -mt-3">
              <Image
                src={FrameworkPreview}
                alt="FrameworkPreview"
                className="mask-b-from-80% brightness-125 aspect-video object-cover"
              />
            </div>
          ),
          className: "md:row-span-2",
        },
      },
      {
        text: "Bots",
        url: "/docs/bots",
        icon: <Discord className="p-1" />,
        description: "Build powerful and interactive Discord bots.",
      },
      {
        text: "Activities",
        url: "/docs/activities",
        icon: <PartyPopper className="p-1" />,
        description: "Develop custom, engaging and fun activities.",
      },
      {
        text: "Plugins",
        url: "/docs/plugins",
        icon: <Connect className="p-1" />,
        description: "Extend Robo's capabilities by creating custom plugins.",
      },
      {
        text: "Reference",
        url: "/docs/reference",
        icon: <BookText className="p-1" />,
        description: "Access detailed technical documentation.",
      },
    ],
  },
  {
    text: "Blog",
    url: "/blog",
    type: "main",
  },
  {
    text: "Directory",
    url: "/directory",
    type: "main",
  },
  {
    text: "Plugins",
    url: "/plugins",
    type: "main",
  },
  {
    text: "Templates",
    url: "/templates",
    type: "main",
  },
  {
    text: "Discord",
    url: "https://discord.gg/robojs",
    type: "icon",
    icon: <DiscordLogo className="mx-2" />,
    secondary: true,
  },
] satisfies LinkItemType[]

export const baseOptions = {
  nav: {
    title: (
      <>
        <span className="flex items-center gap-1">
          <Image src={logo} alt="Logo" className="size-6" />
          <span className="text-xl tracking-tighter">Robo.js</span>
        </span>
      </>
    ),
    transparentMode: "none",
  },
  githubUrl: "https://github.com/Wave-Play/robo.js",
  links: navLinks,
  themeSwitch: {
    mode: "light-dark-system",
  },
} satisfies BaseLayoutProps
