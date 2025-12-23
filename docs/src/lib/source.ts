import { loader } from "fumadocs-core/source"
import { createMDXSource } from "fumadocs-mdx"
import { createElement } from "react"
import { directory, docs } from "@/.source"
import * as icons from "@/components/ui/icons"

// `loader()` also assign a URL to your pages
// See https://fumadocs.vercel.app/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon) {
      return
    }

    if (icon in icons) return createElement(icons[icon as keyof typeof icons])
  },
})

export const directorySource = loader({
  baseUrl: "/directory",
  source: createMDXSource(directory),
})
