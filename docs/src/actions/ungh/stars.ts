"use server"

import { fetchUnghData } from "./fetch"
import { UnghStarsResponseSchema } from "./schemas"

/**
 * Fetches the star count for a specific GitHub repository using the UNGH API.
 *
 * @param owner - The owner of the repository.
 * @param repo - The name of the repository.
 * @returns The number of stars for the repository, or null if not found or an error occurs.
 */
export async function getRepoStars(owner: string, repo: string): Promise<number | null> {
  const repoFullName = `${owner}/${repo}`
  const endpoint = `/stars/${repoFullName}`
  const result = await fetchUnghData(endpoint, UnghStarsResponseSchema)

  if (!result) {
    return null
  }

  return result.stars?.[repoFullName] ?? null
}
