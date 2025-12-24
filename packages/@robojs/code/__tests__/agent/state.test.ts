/**
 * Unit tests for agent state management
 */

import {
	AgentStateAnnotation,
	createInitialState,
	isComplete,
	isWaitingForUser,
	type AgentState
} from '../../src/agent/state.js'

describe('AgentStateAnnotation', () => {
	describe('State type', () => {
		it('should define the correct state type', () => {
			// Verify the state type has expected properties
			type State = typeof AgentStateAnnotation.State

			// This is a compile-time check - if these don't exist, TypeScript will error
			const _typeCheck: State = {
				mode: 'execute',
				phase: 'init',
				instruction: '',
				plan: [],
				currentStep: 0,
				acceptance: null,
				acceptanceStatus: null,
				pendingQuestion: null,
				lastAnswer: null,
				projectProfile: null,
				projectIndex: null,
				projectOverview: null,
				pendingChanges: [],
				pendingDiffs: [],
				lastVerification: null,
				appliedChanges: [],
				appliedDiffs: [],
				summary: null,
				awaitingApproval: false,
				approved: null,
				aborted: false,
				abortReason: null,
				completionSummary: null,
				iterations: 0,
				budgetExceeded: false,
				messages: []
			}

			expect(_typeCheck).toBeDefined()
		})
	})
})

describe('createInitialState', () => {
	it('should create state with instruction', () => {
		const state = createInitialState({ instruction: 'Add a hello command' })

		expect(state.instruction).toBe('Add a hello command')
		expect(state.mode).toBe('execute')
		expect(state.phase).toBe('started')
	})

	it('should use provided mode', () => {
		const state = createInitialState({
			instruction: 'Explain the code',
			mode: 'explain'
		})

		expect(state.instruction).toBe('Explain the code')
		expect(state.mode).toBe('explain')
	})

	it('should use plan mode when specified', () => {
		const state = createInitialState({
			instruction: 'Add authentication',
			mode: 'plan'
		})

		expect(state.mode).toBe('plan')
	})
})

describe('isComplete', () => {
	it('should return true when aborted', () => {
		const state = {
			aborted: true,
			completionSummary: null,
			budgetExceeded: false
		} as AgentState

		expect(isComplete(state)).toBe(true)
	})

	it('should return true when has completion summary', () => {
		const state = {
			aborted: false,
			completionSummary: 'Task completed successfully',
			budgetExceeded: false
		} as AgentState

		expect(isComplete(state)).toBe(true)
	})

	it('should return true when budget exceeded', () => {
		const state = {
			aborted: false,
			completionSummary: null,
			budgetExceeded: true
		} as AgentState

		expect(isComplete(state)).toBe(true)
	})

	it('should return false when running normally', () => {
		const state = {
			aborted: false,
			completionSummary: null,
			budgetExceeded: false
		} as AgentState

		expect(isComplete(state)).toBe(false)
	})
})

describe('isWaitingForUser', () => {
	it('should return true when awaiting approval', () => {
		const state = {
			awaitingApproval: true,
			pendingQuestion: null
		} as AgentState

		expect(isWaitingForUser(state)).toBe(true)
	})

	it('should return true when pending question', () => {
		const state = {
			awaitingApproval: false,
			pendingQuestion: {
				text: 'Which database?',
				askedAt: new Date().toISOString()
			}
		} as AgentState

		expect(isWaitingForUser(state)).toBe(true)
	})

	it('should return false when not waiting', () => {
		const state = {
			awaitingApproval: false,
			pendingQuestion: null
		} as AgentState

		expect(isWaitingForUser(state)).toBe(false)
	})
})
