import type { RoboRequest } from '@robojs/server'
import { listRecordings } from '../../../session/recording-storage.js'
import { readRegistry } from '../../../session/registry.js'
import { validateMethod } from '../utils.js'

/**
 * GET /api/control/tests/recordings - List all saved recordings
 *
 * Response:
 * {
 *   recordings: Array<{
 *     sessionId: string,
 *     testFile?: string,
 *     status?: 'passed' | 'failed',
 *     metadata: RecordingMetadata
 *   }>
 * }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['GET'])

	const recordings = listRecordings()
	const registry = readRegistry()

	// Enrich recordings with test file info from registry
	const enrichedRecordings = recordings.map((recording) => {
		const testFile = registry?.testFiles.find((f) => f.sessionId === recording.sessionId)

		return {
			sessionId: recording.sessionId,
			testFile: testFile?.path,
			status: testFile?.status,
			metadata: recording.metadata
		}
	})

	return {
		recordings: enrichedRecordings
	}
}
