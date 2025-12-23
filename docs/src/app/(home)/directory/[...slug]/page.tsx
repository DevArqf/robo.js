import { InlineTOC } from "fumadocs-ui/components/inline-toc"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { directorySource } from "@/lib/source"
import { getMDXComponents } from "@/mdx-components"

type PropsWithParams<T = Partial<Record<string, never>>> = { params: Promise<{ slug: string[] }> } & T

export default async function Page({ params }: PropsWithParams) {
  const page = directorySource.getPage((await params).slug)
  if (!page) notFound()

  const Mdx = page.data.body

  return (
    <>
      <div className="container rounded-xl border py-12 md:px-8">
        <h1 className="mb-2 text-3xl font-bold">{page.data.title}</h1>
        <p className="mb-4 text-fd-muted-foreground">{page.data.description}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary">{page.data.itemType}</Badge>
          <Badge variant={page.data.sourceType === "official" ? "default" : "outline"}>{page.data.sourceType}</Badge>
        </div>
        <Link href="/directory">Back to Directory</Link>
      </div>
      <article className="container flex flex-col px-4 py-8">
        <div className="prose min-w-0 dark:prose-invert">
          <InlineTOC items={page.data.toc} />
          <Mdx components={getMDXComponents()} />
        </div>
        <div className="mt-8 flex flex-col gap-4 text-sm">
          <div>
            <p className="mb-1 text-fd-muted-foreground">Author</p>
            <p className="font-medium">{page.data.author}</p>
          </div>
          {page.data.date && (
            <div>
              <p className="mb-1 text-sm text-fd-muted-foreground">Published At</p>
              <p className="font-medium">{new Date(page.data.date).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </article>
    </>
  )
}

export function generateStaticParams() {
  return directorySource.getPages().map((page) => ({
    slug: page.slugs,
  }))
}

export async function generateMetadata({ params }: PropsWithParams) {
  const page = directorySource.getPage((await params).slug)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
  }
}
