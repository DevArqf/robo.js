import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  type SearchParams,
} from "nuqs/server"
import { DirectoryCard } from "@/components/directory-card"
import { SearchBar } from "@/components/search-bar"
import { SearchFilters } from "@/components/search-filters"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { directorySource } from "@/lib/source"

const types = ["bot", "web", "activity", "plugin"] as const
const languages = ["typescript", "javascript"] as const

const searchCache = createSearchParamsCache({
  q: parseAsString,
  type: parseAsArrayOf(parseAsStringLiteral(types)),
  lang: parseAsArrayOf(parseAsStringLiteral(languages)),
})

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q: searchQuery, type: selectedTypes, lang: selectedLanguages } = await searchCache.parse(searchParams)

  const items = directorySource.getPages()
  if (!items) notFound()

  const filteredItems = items.filter((item) => {
    if (searchQuery) {
      const searchTerms = searchQuery.toLowerCase().trim().split(" ").filter(Boolean)

      const itemText = [item.data.title, item.data.description, item.data.author]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const allTermsMatch = searchTerms.every((term) => itemText.includes(term))
      if (!allTermsMatch) return false
    }

    if (selectedTypes && selectedTypes.length > 0) {
      if (!selectedTypes.includes(item.data.type)) return false
    }

    if (selectedLanguages && selectedLanguages.length > 0) {
      const hasSelectedLanguage = item.data.language.some((lang) => selectedLanguages.includes(lang))
      if (!hasSelectedLanguage) return false
    }

    return true
  })

  return (
    <main className="container mx-auto px-4 py-16">
      <section className="flex flex-col gap-6 py-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-primary md:text-5xl">Directory</h1>
          <p className="text-xl text-foreground/80 max-w-2xl">
            Browse through the directory of all the bots, web apps, activities, and plugins available on the platform.
          </p>
        </div>
        
        <div className="flex items-center gap-4 mt-2">
          <Button variant="link" asChild>
            <Link href="https://github.com/Wave-Play/robo.js" target="_blank">
              <span>Submit your own</span>
              <ArrowRight size={16} />
            </Link>
          </Button>
          <span className="text-muted-foreground">Share your creation with the community</span>
        </div>
      </section>

        <Separator className="mt-16" />
        <SearchFilters className="justify-self-center mb-4" />
        <SearchBar className="w-[300px] justify-self-center mb-8" />

      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No items found matching your search :((</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <Link key={item.url} href={item.url}>
              <DirectoryCard
                title={item.data.title!}
                author={item.data.author!}
                language={item.data.language}
                type={item.data.type}
                description={item.data.description!}
                image={item.data.image}
                stars={item.data.stars}
              />
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
