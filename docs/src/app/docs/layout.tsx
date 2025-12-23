import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs"
import type { ReactNode } from "react"
import { baseOptions } from "@/app/layout.config"
import { source } from "@/lib/source"

const config = {
  ...baseOptions,
  tree: source.pageTree,
} satisfies DocsLayoutProps

export default function Layout({ children }: { children: ReactNode }) {
  return <DocsLayout {...config}>{children}</DocsLayout>
}
