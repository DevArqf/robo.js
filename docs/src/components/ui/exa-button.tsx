"use client"

import React from "react"
import Link from "next/link"
import { ExaShape } from "./exa-shape"
import { ExaGrow } from "./exa-grow"

interface ExaButtonProps {
  autoWidth?: boolean
  borderColor?: string
  children?: React.ReactNode
  defaultHeight?: number
  defaultWidth?: number
  disabled?: boolean
  href: string
  style?: React.CSSProperties
}

export function ExaButton(props: ExaButtonProps) {
  const {
    autoWidth,
    borderColor = "var(--exa-gold-border)",
    children,
    defaultHeight,
    defaultWidth,
    disabled,
    href,
    style,
  } = props

  return (
    <ExaGrow scale={1.03} style={{ transformOrigin: "center" }}>
      <Link
        href={href}
        style={{ position: "relative", textDecoration: "none", display: "inline-flex", ...style }}
        className="exa-button-link"
      >
        <ExaShape
          accentLineWidth={0}
          autoWidth={autoWidth}
          defaultHeight={defaultHeight}
          defaultWidth={defaultWidth}
          highlight={false}
          innerBorderWidth={2}
          innerColor="var(--exa-gold-fill)"
          outerColor={borderColor}
          slope={12}
        >
          <div className="exa-button-container">
            <p className="exa-button-text">{children}</p>
          </div>
        </ExaShape>
      </Link>
    </ExaGrow>
  )
}
