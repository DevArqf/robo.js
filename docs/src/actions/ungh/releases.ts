"use server"

import { fetchUnghData } from "./fetch"
import { UnghLatestReleaseResponseSchema, type UnghRelease, UnghReleasesResponseSchema } from "./schemas"

/**
 * Fetches all releases for a specific GitHub repository using the UNGH API.
 *
 * @param owner - The owner of the repository.
 * @param repo - The name of the repository.
 * @returns An array of releases, or null if an error occurs.
 */
export async function getRepoReleases(owner: string, repo: string): Promise<UnghRelease[] | null> {
  const repoFullName = `${owner}/${repo}`
  const endpoint = `/repos/${repoFullName}/releases`
  const result = await fetchUnghData(endpoint, UnghReleasesResponseSchema)

  return result ? result.releases : null
}

/**
 * Fetches the latest release for a specific GitHub repository using the UNGH API.
 *
 * @param owner - The owner of the repository.
 * @param repo - The name of the repository.
 * @returns The latest release object, or null if not found or an error occurs.
 */
export async function getLatestRepoRelease(owner: string, repo: string): Promise<UnghRelease | null> {
  const repoFullName = `${owner}/${repo}`
  const endpoint = `/repos/${repoFullName}/releases/latest`

  const result = await fetchUnghData(endpoint, UnghLatestReleaseResponseSchema)

  if (!result) {
    // If result is null, it could be a 404 (no releases) or another error logged by the helper.
    console.warn(`Could not fetch latest release for ${repoFullName} (may not exist).`)
    return null
  }

  return result.release
}
