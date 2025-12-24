import "./global.css"
import { RootProvider } from "fumadocs-ui/provider/next"
import { Geist } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"

const geist = Geist({
  subsets: ["latin"],
})

export default function Layout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en" className={geist.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </RootProvider>
      </body>
    </html>
  )
}
