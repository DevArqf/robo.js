"use client"

import React, { CSSProperties, useState, useRef, useEffect } from "react"

interface ExaGrowProps {
  children: React.ReactNode
  className?: string
  scale?: number
  style?: React.CSSProperties
}

export function ExaGrow(props: ExaGrowProps) {
  const { children, className, scale = 1.1, style } = props
  const [isHovered, setIsHovered] = useState(false)
  const divRef = useRef<HTMLDivElement>(null)

  const combinedStyle: CSSProperties = {
    display: "flex",
    transition: "transform 0.3s",
    transform: isHovered ? `scale(${scale})` : "scale(1)",
    transformOrigin: "center",
    ...style,
  }

  useEffect(() => {
    const node = divRef.current
    if (node) {
      const handleMouseEnter = () => setIsHovered(true)
      const handleMouseLeave = () => setIsHovered(false)
      const handleTouchStart = () => setIsHovered(true)
      const handleTouchEnd = () => setIsHovered(false)
      const handleTouchCancel = () => setIsHovered(false)
      const handleTouchMove = () => setIsHovered(false)

      node.addEventListener("mouseenter", handleMouseEnter)
      node.addEventListener("mouseleave", handleMouseLeave)
      node.addEventListener("touchstart", handleTouchStart)
      node.addEventListener("touchend", handleTouchEnd)
      node.addEventListener("touchcancel", handleTouchCancel)
      node.addEventListener("touchmove", handleTouchMove)

      return () => {
        node.removeEventListener("mouseenter", handleMouseEnter)
        node.removeEventListener("mouseleave", handleMouseLeave)
        node.removeEventListener("touchstart", handleTouchStart)
        node.removeEventListener("touchend", handleTouchEnd)
        node.removeEventListener("touchcancel", handleTouchCancel)
        node.removeEventListener("touchmove", handleTouchMove)
      }
    }
  }, [])

  return (
    <div ref={divRef} className={className} style={combinedStyle}>
      {children}
    </div>
  )
}
