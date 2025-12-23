import { Github } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import logo from "@/../public/logo.png"
import { getLatestRepoRelease, getRepoStars } from "@/actions/ungh"
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern"
import { Badge } from "@/components/ui/badge"

export default async function HomePage() {
  const latestVersion = (await getLatestRepoRelease("wave-play", "robo.js"))?.tag.split("@")[1] || "404"
  const repoStars = (await getRepoStars("wave-play", "robo.js")) || "xx"

  return (
    <main className="flex flex-1 flex-col justify-center">
      <AnimatedGridPattern width={50} height={50} className="text-primary" />
      <section className="flex flex-col items-center text-center gap-8">
        <div className="relative pointer-events-none select-none">
          <div className="absolute inset-0 blur-2xl opacity-50 bg-primary dark:opacity-10 rounded-full transform scale-200"></div>
          <div className="overflow-y-hidden">
            <Image
              src={logo}
              alt="Robo.js Sage Avatar (logo)"
              className="z-10 size-52 animate-out slide-out-to-top-18 translate-y-18 repeat-infinite direction-alternate duration-7000 ease-in delay-500"
              priority
            />
            <Badge className="relative w-full rounded-bl-4xl rounded-br-4xl tracking-tight z-20 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2"></span> Latest version: v{latestVersion}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-foreground">Robo.js</h1>
          <p className="text-xl text-muted-foreground text-pretty">
            Unlock bot brilliance!
            <br /> Build powerful Discord bots with a modern framework.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/docs"
            className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-6 text-sm font-medium text-white shadow transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:bg-emerald-700 dark:hover:bg-emerald-600 dark:focus:ring-emerald-500"
          >
            Get Started
          </Link>
          <Link
            target="_blank"
            href="https://github.com/wave-play/robo.js"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus:ring-zinc-500"
          >
            <Github className="mr-2 h-4 w-4" />
            <span>Star on GitHub</span>
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {repoStars}
            </span>
          </Link>
        </div>
      </section>
    </main>
  )
}
