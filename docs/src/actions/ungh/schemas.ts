import { z } from "zod"

export const UnghStarsResponseSchema = z.object({
  totalStars: z.number(),
  stars: z.record(z.string(), z.number()),
})

export const UnghReleaseSchema = z.object({
  id: z.number(),
  tag: z.string(),
  author: z.string(),
  name: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime(),
  markdown: z.string(),
  html: z.string(),
})

export const UnghReleasesResponseSchema = z.object({
  releases: z.array(UnghReleaseSchema),
})

export const UnghLatestReleaseResponseSchema = z.object({
  release: UnghReleaseSchema,
})

export type UnghRelease = z.infer<typeof UnghReleaseSchema>
