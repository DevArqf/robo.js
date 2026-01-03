import Link from "next/link"
import { ExternalLink, Package, PuzzleIcon } from "lucide-react"
import { officialPlugins, communityPlugins, communityPluginsSearchUrl } from "@/data/plugins"
import { ExaCard, ExaCardContent, ExaCardDescription, ExaCardHeader, ExaCardTitle } from "@/components/ui/exa-card"
import { ExaButton } from "@/components/ui/exa-button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function PluginsPage() {
  return (
    <main className="container mx-auto px-4 py-12 md:py-16">
      <div className="flex flex-col items-center text-center mb-12">
        <Badge variant="outline" className="mb-4 gap-1.5">
          <PuzzleIcon className="h-3 w-3" />
          Plugin Directory
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl mb-4">
          Extend Your Robo
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Powerful plugins to supercharge your Robo.js projects. Install with a single command.
        </p>
      </div>

      {/* Official Plugins */}
      <section className="mb-16">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-2xl font-semibold">Official Plugins</h2>
          <Badge variant="secondary">Maintained by Robo.js</Badge>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {officialPlugins.map((plugin) => (
            <Link
              key={plugin.package}
              href={plugin.npmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <ExaCard
                className={cn(
                  "h-full min-h-[180px]",
                  "transition-all duration-300 ease-out",
                )}
                growScale={1.02}
                slope={16}
                innerBorderWidth={2}
              >
                <div className="flex flex-col h-full p-6">
                  <ExaCardHeader className="p-0 mb-2">
                    <div className="flex items-start justify-between">
                      <ExaCardTitle
                        className={cn(
                          "text-lg font-semibold",
                          "transition-colors duration-300",
                          "group-hover:text-primary",
                        )}
                      >
                        {plugin.name}
                      </ExaCardTitle>
                      <ExternalLink
                        className={cn(
                          "h-4 w-4 text-muted-foreground",
                          "opacity-0 transition-all duration-300",
                          "group-hover:opacity-100 group-hover:text-primary",
                        )}
                      />
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">
                      {plugin.package}
                    </code>
                  </ExaCardHeader>
                  <ExaCardContent className="p-0 mt-auto">
                    <ExaCardDescription className="line-clamp-3">
                      {plugin.description}
                    </ExaCardDescription>
                  </ExaCardContent>
                </div>
              </ExaCard>
            </Link>
          ))}
        </div>
      </section>

      {/* Community Plugins */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-2xl font-semibold">Community Plugins</h2>
          <Badge variant="outline">Open Source</Badge>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {communityPlugins.map((plugin) => (
            <Link
              key={plugin.package}
              href={plugin.npmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <ExaCard
                className={cn(
                  "h-full min-h-[180px]",
                  "transition-all duration-300 ease-out",
                )}
                growScale={1.02}
                slope={16}
                innerBorderWidth={2}
              >
                <div className="flex flex-col h-full p-6">
                  <ExaCardHeader className="p-0 mb-2">
                    <div className="flex items-start justify-between">
                      <ExaCardTitle
                        className={cn(
                          "text-lg font-semibold",
                          "transition-colors duration-300",
                          "group-hover:text-primary",
                        )}
                      >
                        {plugin.name}
                      </ExaCardTitle>
                      <ExternalLink
                        className={cn(
                          "h-4 w-4 text-muted-foreground",
                          "opacity-0 transition-all duration-300",
                          "group-hover:opacity-100 group-hover:text-primary",
                        )}
                      />
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">
                      {plugin.package}
                    </code>
                  </ExaCardHeader>
                  <ExaCardContent className="p-0 mt-auto">
                    <ExaCardDescription className="line-clamp-3">
                      {plugin.description}
                    </ExaCardDescription>
                  </ExaCardContent>
                </div>
              </ExaCard>
            </Link>
          ))}
        </div>
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Discover more community-built plugins on NPM.
          </p>
          <ExaButton href={communityPluginsSearchUrl}>
            Browse More on NPM
          </ExaButton>
        </div>
      </section>

      {/* Create Your Own */}
      <section className="mt-16 text-center">
        <h2 className="text-2xl font-semibold mb-4">Create Your Own Plugin</h2>
        <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
          Build and share your own plugins with the Robo.js community.
          Our plugin system makes it easy to extend functionality.
        </p>
        <ExaButton href="/docs/framework/plugins/create">
          Learn How
        </ExaButton>
      </section>
    </main>
  )
}
