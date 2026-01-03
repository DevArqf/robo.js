"use client"

import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// Types
export type LanguageType = "typescript" | "javascript"
export type ProjectType = "bot" | "web" | "activity" | "plugin"

// Filter options configuration
const typeOptions = [
  {
    value: "bot" as const,
    label: "Bot",
    color: {
      bg: "bg-indigo-500/20",
      text: "text-indigo-400",
      border: "border-indigo-500/20",
      hover: "hover:bg-indigo-500/30",
      ring: "ring-indigo-400/30",
    },
  },
  {
    value: "web" as const,
    label: "Web",
    color: {
      bg: "bg-cyan-500/20",
      text: "text-cyan-400",
      border: "border-cyan-500/20",
      hover: "hover:bg-cyan-500/30",
      ring: "ring-cyan-400/30",
    },
  },
  {
    value: "activity" as const,
    label: "Activity",
    color: {
      bg: "bg-pink-500/20",
      text: "text-pink-400",
      border: "border-pink-500/20",
      hover: "hover:bg-pink-500/30",
      ring: "ring-pink-400/30",
    },
  },
  {
    value: "plugin" as const,
    label: "Plugin",
    color: {
      bg: "bg-green-500/20",
      text: "text-green-400",
      border: "border-green-500/20",
      hover: "hover:bg-green-500/30",
      ring: "ring-green-400/30",
    },
  },
] as const

const languageOptions = [
  {
    value: "typescript" as const,
    label: "TypeScript",
    color: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      border: "border-blue-500/20",
      hover: "hover:bg-blue-500/30",
      ring: "ring-blue-400/30",
    },
  },
  {
    value: "javascript" as const,
    label: "JavaScript",
    color: {
      bg: "bg-amber-500/20",
      text: "text-amber-400",
      border: "border-amber-500/20",
      hover: "hover:bg-amber-500/30",
      ring: "ring-amber-400/30",
    },
  },
] as const

const getActiveStyles = (
  option: (typeof typeOptions)[number] | (typeof languageOptions)[number],
  isActive: boolean,
) => {
  const { color } = option
  return isActive
    ? `${color.bg} ${color.text} ${color.border} ring-1 ring-offset-1 ring-offset-[#1a1a1a] ${color.ring}`
    : "bg-[#2a2a2a]/30 text-gray-400 hover:bg-[#2a2a2a]/50 hover:text-gray-300"
}

// SearchFilters Component with its own query state
export function SearchFilters({ className }: { className?: string }) {
  const types = ["bot", "web", "activity", "plugin"] as const
  const [selectedType, setSelectedType] = useQueryState(
    "type",
    parseAsArrayOf(parseAsStringLiteral(types)).withOptions({
      shallow: false,
      history: "replace"
    }),
  )

  const languages = ["typescript", "javascript"] as const
  const [selectedLanguages, setSelectedLanguages] = useQueryState(
    "lang",
    parseAsArrayOf(parseAsStringLiteral(languages)).withOptions({
      shallow: false,
      history: "replace"
    }),
  )

  const toggleOption = <T extends string>(current: T[] | null, value: T, setter: (newValue: T[] | null) => void) => {
    const updated = current?.includes(value) ? current.filter((item) => item !== value) : [...(current || []), value]
    setter(updated.length > 0 ? updated : null)
  }

  return (
    <div className={cn("flex", className)}>
      {typeOptions.map((type) => (
        <Badge
          key={type.value}
          onClick={() => toggleOption(selectedType, type.value, setSelectedType)}
          className={cn("select-none", getActiveStyles(type, Boolean(selectedType?.includes(type.value))))}
        >
          {type.label}
        </Badge>
      ))}

      {languageOptions.map((language) => (
        <Badge
          key={language.value}
          onClick={() => toggleOption(selectedLanguages, language.value, setSelectedLanguages)}
          className={cn("select-none", getActiveStyles(language, Boolean(selectedLanguages?.includes(language.value))))}
        >
          {language.label}
        </Badge>
      ))}
    </div>
  )
}
