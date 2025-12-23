"use client"

import { Activity, Bot, Code2, Globe, PuzzleIcon, Star } from "lucide-react"
import Image from "next/image"
import { DirectoryItem } from "source.config"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  title: DirectoryItem["title"]
  author: DirectoryItem["author"]
  language: DirectoryItem["language"]
  type: DirectoryItem["type"]
  description: DirectoryItem["description"]
  image: DirectoryItem["image"]
  stars?: DirectoryItem["stars"]
}

export function DirectoryCard({ title, author, language, type, description, image, stars }: Props) {
  const typeBadgeColors = {
    bot: "from-indigo-500/20 to-indigo-500/10 text-indigo-400 border-indigo-500/20",
    web: "from-cyan-500/20 to-cyan-500/10 text-cyan-400 border-cyan-500/20",
    activity: "from-pink-500/20 to-pink-500/10 text-pink-400 border-pink-500/20",
    plugin: "from-green-500/20 to-green-500/10 text-green-400 border-green-500/20",
  } as const

  const languageBadgeColors = {
    typescript: "from-blue-500/20 to-blue-500/10 text-blue-400 border-blue-500/20",
    javascript: "from-amber-500/20 to-amber-500/10 text-amber-400 border-amber-500/20",
  } as const

  const imageMap = {
    plugin: "/plugin.png",
    bot: "/bot.png",
    web: "/web.png",
    activity: "/activity.png",
  } satisfies Record<Props["type"], string>

  return (
    <Card
      className={cn(
        "py-0 h-[350px] gap-0",
        "bg-transparent",
        "group relative overflow-hidden",
        "transition-all duration-300 ease-out",
        "hover:border-primary/30 hover:shadow-[0_0_20px] hover:shadow-[#4ade80]/10 hover:-translate-y-1",
        "before:absolute before:inset-0 before:rounded-lg before:opacity-0",
        "before:transition-opacity before:duration-300",
        "before:bg-[radial-gradient(800px_circle_at_var(--x)_var(--y),rgba(74,222,128,0.06),transparent_40%)]",
        "hover:before:opacity-100",
      )}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        e.currentTarget.style.setProperty("--x", `${x}%`)
        e.currentTarget.style.setProperty("--y", `${y}%`)
      }}
    >
      <Image
        src={imageMap[type]}
        alt={title}
        fill
        className={cn(
          "inset-0 -z-10 object-cover",
          "transition-all duration-500 ease-out",
          "blur-[0px]",
          "group-hover:scale-110 group-hover:blur-none",
        )}
      />

      <CardHeader className="grow bg-gradient-to-t from-card/50 via-card/5 to-card/1">
        <div className="absolute top-0 left-0 z-20 flex">
          {language.map((lang, i) => (
            <Badge
              key={lang}
              variant="outline"
              className={cn(
                "bg-gradient-to-r backdrop-blur-md group-hover:backdrop-blur-3xl",
                "transition-all duration-300",
                "opacity-90 group-hover:translate-y-0 group-hover:opacity-100",
                "rounded-t-none border-t-0",
                // First badge has rounded bottom right
                i === 0 && "border-r-0",
                // Last badge has rounded bottom right
                i === language.length - 1 && "rounded-br-xl border-l-0",
                languageBadgeColors[lang],
              )}
            >
              <Code2 className={cn("h-3 w-3", "group-hover:animate-pulse")} />
              {lang === "typescript" && "TS"}
              {lang === "javascript" && "JS"}
            </Badge>
          ))}
        </div>
        <Badge
          variant="outline"
          className={cn(
            "absolute top-0 right-0",
            "capitalize border-t-0",
            "bg-gradient-to-r backdrop-blur-md group-hover:backdrop-blur-3xl",
            "transition-all duration-300",
            "opacity-90 group-hover:opacity-100",
            "rounded-t-none rounded-bl-xl",
            typeBadgeColors[type],
          )}
        >
          {type === "bot" && <Bot className="h-3 w-3 group-hover:animate-pulse" />}
          {type === "web" && <Globe className="h-3 w-3 group-hover:animate-pulse" />}
          {type === "activity" && <Activity className="h-3 w-3 group-hover:animate-pulse" />}
          {type === "plugin" && <PuzzleIcon className="h-3 w-3 group-hover:animate-pulse" />}
          {type}
        </Badge>
      </CardHeader>
      <CardContent className="bg-gradient-to-t from-card/90 via-card/90 to-card/50 pb-6 pt-10">
        <CardTitle className={cn("text-lg", "transition-colors duration-300", "group-hover:text-primary")}>
          {title}
        </CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardContent>
      <CardFooter className="justify-between pb-6 border-t bg-gradient-to-t from-card to-card/90">
        <div
          className={cn(
            "relative",
            "before:content-['by'] before:absolute before:text-xs before:text-muted-foreground/50 before:-top-2 before:left-px",
            "after:absolute after:h-[1px] after:w-full after:bg-gradient-to-r after:from-[#4ade80]/30 after:to-transparent after:opacity-0 after:transition-opacity after:duration-500",
            "group-hover:after:opacity-100",
          )}
        >
          <p
            className={cn(
              "text-sm text-muted-foreground font-medium pl-4",
              "transition-colors duration-300",
              "group-hover:text-primary",
            )}
          >
            {author}
          </p>
        </div>

        {Boolean(stars) && (
          <div
            className={cn(
              "flex items-center gap-1",
              "text-sm text-muted-foreground",
              "transition-colors duration-300",
              "group-hover:text-primary",
            )}
          >
            <Star className="h-3.5 w-3.5 fill-current/90" />
            {stars}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
