"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ExaShape } from "./exa-shape"
import { ExaGrow } from "./exa-grow"

interface ExaCardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode
  className?: string
  growScale?: number
  highlight?: boolean
  innerBorderWidth?: number
  slope?: number
}

export function ExaCard({
  children,
  className,
  growScale = 1.02,
  highlight = true,
  innerBorderWidth = 2,
  slope = 24,
  ...props
}: ExaCardProps) {
  return (
    <ExaGrow scale={growScale}>
      <div
        data-slot="exa-card"
        className={cn(
          "relative flex flex-col",
          "text-card-foreground",
          className
        )}
        {...props}
      >
        <ExaShape
          highlight={highlight}
          innerBorderWidth={innerBorderWidth}
          slope={slope}
        >
          <div className="flex flex-col h-full w-full">{children}</div>
        </ExaShape>
      </div>
    </ExaGrow>
  )
}

function ExaCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="exa-card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

function ExaCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="exa-card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function ExaCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="exa-card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function ExaCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="exa-card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function ExaCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="exa-card-footer"
      className={cn("flex items-center px-6", className)}
      {...props}
    />
  )
}

export {
  ExaCardHeader,
  ExaCardTitle,
  ExaCardDescription,
  ExaCardContent,
  ExaCardFooter,
}
