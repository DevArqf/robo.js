"use client"

import { Search } from "lucide-react"
import { useQueryState } from "nuqs"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchBar({ className }: { className?: string }) {
  const [searchQuery, setSearchQuery] = useQueryState("q", {
    shallow: false,
    history: "replace"
  })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value || null)
  }

  return (
    <div className={cn("relative flex flex-col gap-3 bg-card", className)}>
      <Input
        type="search"
        placeholder="Search plugins and templates..."
        value={searchQuery || ""}
        onChange={handleSearchChange}
        className="peer ps-9"
      />
      <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
        <Search size={16} />
        <span className="sr-only">Search</span>
      </div>
    </div>
  )
}
