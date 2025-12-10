/**
 * @robojs/mock - Discord Gateway mock server for automated testing
 *
 * @example
 * ```typescript
 * import { sessionManager, Session, SessionManager } from '@robojs/mock'
 *
 * // Create a session for testing
 * const session = await sessionManager.create({ name: 'my-test' })
 * console.log(`Use token: ${session.token}`)
 *
 * // Check session state
 * const state = session.state
 *
 * // Clean up
 * await sessionManager.delete(session.id)
 * ```
 */

// Core exports
export { Session, SessionManager, InMemoryStorage, MockServerState, ActionRecorder, RecordingPlayer } from './session/index.js'
export type { StateOptions } from './session/index.js'
export { sessionManager } from './core/manager.js'
export { mockLogger } from './core/logger.js'
export { GatewayServer, getGatewayServer, closeGatewayServer } from './core/gateway.js'
export { StageServer, getStageServer, closeStageServer } from './core/stage.js'
export { StageBridge, getStageBridge, resetStageBridge } from './core/stage-bridge.js'

// Discord Gateway exports
export {
	GatewayOpcodes,
	GatewayCloseCodes,
	DEFAULT_HEARTBEAT_INTERVAL,
	GATEWAY_VERSION
} from './discord/opcodes.js'
export {
	buildHelloPayload,
	buildHeartbeatAckPayload,
	isValidIdentifyPayload,
	buildInteractionCreatePayload,
	buildButtonInteractionPayload,
	buildSelectMenuInteractionPayload,
	buildModalSubmitInteractionPayload,
	buildAutocompleteInteractionPayload,
	buildContextMenuInteractionPayload,
	// Thread payload builders (Phase 4D)
	mockThreadToAPIChannel,
	buildThreadCreatePayload,
	buildThreadUpdatePayload,
	buildThreadDeletePayload,
	buildThreadListSyncPayload,
	buildThreadMemberUpdatePayload,
	buildThreadMembersUpdatePayload,
	// Forum payload builders (Phase 4H)
	mockForumChannelToAPIChannel,
	mockForumThreadToAPIChannel,
	mockForumTagToAPIForumTag,
	// Webhook payload builders (Phase 4J)
	mockWebhookToAPIWebhook,
	buildWebhooksUpdatePayload,
	// Role & Member payload builders (Phase 4L)
	mockRoleToAPIRole,
	mockGuildMemberToAPIMember,
	mockOverwriteToAPIOverwrite,
	buildGuildRoleCreatePayload,
	buildGuildRoleUpdatePayload,
	buildGuildRoleDeletePayload,
	buildGuildMemberAddPayload,
	buildGuildMemberUpdatePayload,
	buildGuildMemberRemovePayload
} from './discord/payloads.js'
export type {
	GatewayPayload,
	HelloPayloadData,
	IdentifyPayloadData,
	InteractionCreatePayloadOptions,
	ButtonInteractionPayloadOptions,
	SelectMenuInteractionPayloadOptions,
	ModalSubmitInteractionPayloadOptions,
	AutocompleteInteractionPayloadOptions,
	ContextMenuInteractionPayloadOptions,
	// Thread payload types (Phase 4D)
	ThreadCreatePayloadOptions,
	ThreadUpdatePayloadOptions,
	ThreadDeletePayloadOptions,
	ThreadListSyncPayloadOptions,
	ThreadMemberUpdatePayloadOptions,
	ThreadMembersUpdatePayloadOptions,
	// Webhook payload types (Phase 4J)
	WebhooksUpdatePayloadOptions,
	// Role & Member payload types (Phase 4L)
	GuildRoleCreatePayloadOptions,
	GuildRoleUpdatePayloadOptions,
	GuildRoleDeletePayloadOptions,
	GuildMemberAddPayloadOptions,
	GuildMemberUpdatePayloadOptions,
	GuildMemberRemovePayloadOptions
} from './discord/payloads.js'

// Utility exports
export {
	generateSnowflake,
	snowflakeToTimestamp,
	timestampToSnowflake,
	generateSessionId,
	generateInteractionToken,
	generateGatewaySessionId,
	createMockToken,
	parseMockToken,
	TOKEN_PREFIX
} from './utils/index.js'

// State helpers
export {
	createSessionState,
	createDefaultGuildWithChannel,
	createMockUser,
	createMockGuild,
	createMockChannel,
	createMockMessage,
	serializeSessionState,
	serializeMockGuild,
	serializeMockChannel,
	serializeMockUser,
	serializeMockMessage,
	serializeMockInteraction,
	// Thread helpers (Phase 4D)
	createMockThread,
	serializeMockThread,
	// Forum helpers (Phase 4H)
	createMockForumChannel,
	// Webhook helpers (Phase 4J)
	serializeMockWebhook,
	// Role & Member helpers (Phase 4L)
	createMockRole,
	createMockGuildMember,
	serializeMockRole,
	serializeMockGuildMember
} from './session/state.js'

// Auth exports
export { createAuthMiddleware, NoOpAuthProvider, ApiKeyAuthProvider } from './auth/index.js'

// Storage exports (Phase 4E)
export {
	MemoryAttachmentStorage,
	createStorage,
	type AttachmentStorage,
	type StorageConfig,
	type StorageStats
} from './storage/attachment-storage.js'

// Type exports
export type {
	Session as ISession,
	SessionState,
	ConnectionState,
	CreateSessionOptions,
	SessionConfig,
	SessionManagerOptions,
	SessionStorage,
	MockGuild,
	MockGuildConfig,
	MockChannel,
	MockChannelConfig,
	SeedMessageConfig,
	MockUser,
	MockUserConfig,
	MockMessage,
	MockMessageConfig,
	MockInteraction,
	MockInteractionOption,
	DispatchSlashCommandOptions,
	DispatchButtonClickOptions,
	DispatchSelectMenuOptions,
	DispatchModalSubmitOptions,
	DispatchAutocompleteOptions,
	DispatchContextMenuOptions,
	AuthProvider,
	AuthResult,
	ActionType,
	RecordedAction,
	RecordActionOptions,
	SerializedSessionState,
	SerializedMockGuild,
	SerializedMockChannel,
	SerializedMockUser,
	SerializedMockMessage,
	SerializedMockInteraction,
	// Session Recording types (Phase 4A)
	SessionRecording,
	RecordingMetadata,
	// Replay types (Phase 4B)
	ValidationMode,
	ReplayOptions,
	ReplayState,
	ReplayResult,
	ValidationResult,
	ValidationMismatch,
	// Thread types (Phase 4D)
	MockThread,
	MockThreadConfig,
	MockThreadMetadata,
	MockThreadMember,
	DispatchThreadCreateOptions,
	SerializedMockThread,
	// Attachment types (Phase 4E)
	MockAttachment,
	StoredAttachment,
	AttachmentPayload,
	// Forum types (Phase 4H)
	MockForumChannel,
	MockForumChannelConfig,
	MockForumTag,
	MockForumThread,
	MockForumPostConfig,
	MockDefaultReaction,
	SerializedMockForumChannel,
	SerializedMockForumTag,
	SerializedMockForumThread,
	// Webhook types (Phase 4J)
	MockWebhook,
	MockWebhookConfig,
	SerializedMockWebhook,
	// Role & Member types (Phase 4L)
	MockRole,
	MockRoleConfig,
	MockRoleTags,
	MockGuildMember,
	MockGuildMemberConfig,
	MockChannelOverwrite,
	SerializedMockRole,
	SerializedMockGuildMember,
	DispatchRoleCreateOptions,
	DispatchRoleUpdateOptions,
	DispatchRoleDeleteOptions,
	DispatchGuildMemberAddOptions,
	DispatchGuildMemberUpdateOptions,
	DispatchGuildMemberRemoveOptions
} from './types/index.js'

// Attachment constants (Phase 4E)
export { AttachmentFlags, AttachmentLimits } from './types/index.js'

// Forum constants (Phase 4H)
export { ForumSortOrderType, ForumLayoutType } from './types/index.js'

// Webhook constants (Phase 4J)
export { WebhookType, WebhookLimits } from './types/index.js'

// Role & Permission constants (Phase 4L)
export { RoleLimits, OverwriteType } from './types/index.js'

// Permission utilities (Phase 4L)
export {
	computePermissions,
	computeBasePermissions,
	hasPermission,
	hasAnyPermission,
	hasAllPermissions,
	getPermissionNames,
	parsePermissions,
	permissionAllowed,
	permissionDenied,
	DiscordErrorCodes,
	PermissionFlagsBits,
	// Permission enforcement (Phase 4L)
	checkEndpointPermission,
	createPermissionErrorResponse,
	// Role hierarchy helpers (Phase 4L-Extended)
	isServerOwner,
	getHighestRolePosition,
	canActOnMember,
	canManageRole,
	// Enforcement middleware (Phase 4L-Extended)
	checkEndpointPermissionWithEnforcement
} from './core/permissions.js'
export type {
	PermissionCheckResult,
	PermissionContext,
	// Enforcement types (Phase 4L-Extended)
	PermissionEnforcementLevel,
	EnforcementOptions,
	EnforcementContext
} from './core/permissions.js'

// Permission enforcement helper (Phase 4L-Extended)
export { enforcePermissions, getEnforcementLevel } from './utils/permission-check.js'
export type { EnforcePermissionsOptions } from './utils/permission-check.js'

// Stage WebSocket types (Phase 5A)
export type {
	StageEventType,
	StageCommandType,
	StageEvent,
	StageCommand,
	StageConnectionState,
	StateSyncPayload,
	StageGuild,
	StageChannel,
	StageUser,
	StageMember,
	StageMessage,
	StageMessageSource,
	StageMessageCreateData,
	StageInteractionResponseData,
	StageBotReadyData,
	StageBotDisconnectedData,
	StageBotErrorData,
	StageCommandResponseData,
	StageRESTCallData,
	StageSendMessageData,
	StageInvokeCommandData,
	StageClickButtonData,
	StageSelectOptionData,
	StageSubmitModalData,
	StageAddReactionData,
	StageStartTypingData,
	StageSubscribeChannelData,
	StageSetPlaybackData,
	BufferedStageEvent,
	StageServerConfig
} from './types/stage.js'
