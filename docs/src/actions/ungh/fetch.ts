import { z } from "zod"

export async function fetchUnghData<T>(endpoint: string, schema: z.ZodSchema<T>) {
  const url = `https://ungh.cc${endpoint}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`Failed to fetch data from ${url}: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    const parsedData = schema.safeParse(data)

    if (!parsedData.success) {
      console.error(`Failed to parse response from ${url}:`, parsedData.error)
      return null
    }

    return parsedData.data
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error)
    return null
  }
}
