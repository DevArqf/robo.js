"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useMemo } from "react"
import { ExternalLink, LayoutTemplate, Search, X } from "lucide-react"
import { templates, typeLabels, typeColors, type Template } from "@/data/templates"
import { ExaCard, ExaCardContent, ExaCardDescription, ExaCardHeader, ExaCardTitle } from "@/components/ui/exa-card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FilterType = "all" | "activity" | "bot" | "web" | "plugin"
type FilterLanguage = "all" | "TypeScript" | "JavaScript"

export default function TemplatesPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<FilterType>("all")
  const [languageFilter, setLanguageFilter] = useState<FilterLanguage>("all")

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesTitle = template.title.toLowerCase().includes(searchLower)
        const matchesDescription = template.description.toLowerCase().includes(searchLower)
        const matchesAuthor = template.author.toLowerCase().includes(searchLower)
        const matchesTags = template.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        if (!matchesTitle && !matchesDescription && !matchesAuthor && !matchesTags) {
          return false
        }
      }

      // Type filter
      if (typeFilter !== "all" && template.type !== typeFilter) {
        return false
      }

      // Language filter
      if (languageFilter !== "all" && template.language !== languageFilter) {
        return false
      }

      return true
    })
  }, [search, typeFilter, languageFilter])

  const typeFilters: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "activity", label: "Discord Activities" },
    { value: "bot", label: "Discord Bots" },
    { value: "web", label: "Web Apps" },
    { value: "plugin", label: "Plugins" },
  ]

  const languageFilters: { value: FilterLanguage; label: string }[] = [
    { value: "all", label: "All Languages" },
    { value: "TypeScript", label: "TypeScript" },
    { value: "JavaScript", label: "JavaScript" },
  ]

  const clearFilters = () => {
    setSearch("")
    setTypeFilter("all")
    setLanguageFilter("all")
  }

  const hasActiveFilters = search || typeFilter !== "all" || languageFilter !== "all"

  return (
    <main className="container mx-auto px-4 py-12 md:py-16">
      <div className="flex flex-col items-center text-center mb-12">
        <Badge variant="outline" className="mb-4 gap-1.5">
          <LayoutTemplate className="h-3 w-3" />
          Template Gallery
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl mb-4">
          Start Building Fast
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Ready-to-use templates for Discord Activities, Bots, Web Apps, and Plugins.
          Clone and customize to get started in minutes.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-4">
        {/* Search */}
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Type Filters */}
        <div className="flex flex-wrap justify-center gap-2">
          {typeFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                typeFilter === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Language Filters */}
        <div className="flex flex-wrap justify-center gap-2">
          {languageFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setLanguageFilter(filter.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                languageFilter === filter.value
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="text-center">
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground">
          Showing {filteredTemplates.length} of {templates.length} templates
        </p>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.href} template={template} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-4">No templates found</p>
          <button
            onClick={clearFilters}
            className="text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Create Your Own */}
      <section className="mt-16 text-center">
        <h2 className="text-2xl font-semibold mb-4">Create Your Own Template</h2>
        <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
          Have a project setup you want to share? Turn it into a template
          that others can use to get started quickly.
        </p>
        <Link
          href="/docs/framework/templates"
          className={cn(
            "inline-flex items-center gap-2 px-6 py-3 rounded-lg",
            "bg-primary text-primary-foreground font-medium",
            "hover:bg-primary/90 transition-colors"
          )}
        >
          Learn How
        </Link>
      </section>
    </main>
  )
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <Link href={template.href} className="group block">
      <ExaCard
        className={cn(
          "h-full min-h-[220px]",
          "transition-all duration-300 ease-out"
        )}
        growScale={1.02}
        slope={16}
        innerBorderWidth={2}
      >
        <div className="flex flex-col h-full">
          {/* Image */}
          {template.image && (
            <div className="relative h-32 overflow-hidden">
              <Image
                src={template.image}
                alt={template.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            </div>
          )}

          <div className={cn("flex flex-col flex-1 p-6", template.image && "pt-4")}>
            <ExaCardHeader className="p-0 mb-2">
              <div className="flex items-start justify-between gap-2">
                <ExaCardTitle
                  className={cn(
                    "text-lg font-semibold",
                    "transition-colors duration-300",
                    "group-hover:text-primary"
                  )}
                >
                  {template.title}
                </ExaCardTitle>
                <ExternalLink
                  className={cn(
                    "h-4 w-4 text-muted-foreground flex-shrink-0",
                    "opacity-0 transition-all duration-300",
                    "group-hover:opacity-100 group-hover:text-primary"
                  )}
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={cn("text-xs", typeColors[template.type])}
                >
                  {typeLabels[template.type]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {template.language}
                </span>
              </div>
            </ExaCardHeader>

            <ExaCardContent className="p-0 mt-auto">
              <ExaCardDescription className="line-clamp-2 mb-2">
                {template.description}
              </ExaCardDescription>
              <p className="text-xs text-muted-foreground">
                by {template.author}
              </p>
            </ExaCardContent>
          </div>
        </div>
      </ExaCard>
    </Link>
  )
}
