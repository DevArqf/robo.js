"use client"

import { cva } from "class-variance-authority"
import { InfoIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

export function Info({ children }: { children: ReactNode }): ReactNode {
  return (
    <Popover>
      <PopoverTrigger>
        <InfoIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="prose max-h-[400px] min-w-[220px] max-w-[400px] overflow-auto text-sm prose-no-margin">
        {children}
      </PopoverContent>
    </Popover>
  )
}

interface ReturnTypeProps {
  /**
   * Return type information
   */
  type: {
    /**
     * The type string (e.g. "string")
     */
    type: string
    /**
     * Optional fallback value (e.g. "null")
     */
    fallback?: string
    /**
     * Optional description of the return type
     */
    description?: ReactNode
  }
}

const field = cva("inline-flex flex-row items-center gap-1")
const code = cva("rounded-md bg-fd-secondary p-1 text-fd-secondary-foreground", {
  variants: {
    color: {
      primary: "bg-fd-primary/10 text-fd-primary",
    },
  },
})

export function ReturnType({ type }: ReturnTypeProps) {
  const displayType = type.fallback ? `${type.type} | ${type.fallback}` : type.type

  return (
    <div className="prose my-6 overflow-auto prose-no-margin">
      <table className="whitespace-nowrap text-sm text-fd-muted-foreground border rounded-md w-full">
        <tbody>
          <tr>
            <td className="w-[100px] font-medium px-4 py-3 border-r">Returns</td>
            <td className="px-4 py-3">
              <div className={field()}>
                <code className={cn(code({ color: "primary" }))}>{displayType}</code>
                {type.description && <Info>{type.description}</Info>}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
