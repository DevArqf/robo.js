import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs"
import { baseOptions } from "@/app/layout.config"
import { source } from "@/lib/source"

const config = {
  ...baseOptions,
  tree: source.pageTree,
} satisfies DocsLayoutProps

export default function Layout({ children }: { children: React.ReactNode }): React.ReactNode {
  return <DocsLayout {...config}>{children}</DocsLayout>
}
