import { HomeLayout, type HomeLayoutProps } from "fumadocs-ui/layouts/home"
import { baseOptions } from "@/app/layout.config"

const config = {
  ...baseOptions,
} satisfies HomeLayoutProps

export default function Layout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <HomeLayout {...config} className="[&>header]:lg:rounded-md [&>header]:**:lg:rounded-md">
      {children}
    </HomeLayout>
  )
}
