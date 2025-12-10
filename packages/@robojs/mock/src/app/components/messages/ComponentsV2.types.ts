import type { ButtonComponentData } from './Button'

/**
 * Discord Components V2 Type Definitions
 * https://discord.com/developers/docs/interactions/message-components
 */

// V2 Component Type Constants
export const ComponentTypeV2 = {
	// V1 Components (existing)
	ActionRow: 1,
	Button: 2,
	StringSelect: 3,
	TextInput: 4,
	UserSelect: 5,
	RoleSelect: 6,
	MentionableSelect: 7,
	ChannelSelect: 8,
	// V2 Display Components (new)
	Section: 9,
	TextDisplay: 10,
	Thumbnail: 11,
	MediaGallery: 12,
	File: 13,
	Separator: 14,
	ContentInventoryEntry: 16,
	Container: 17
} as const

// Message flag for Components V2
export const MESSAGE_FLAG_IS_COMPONENTS_V2 = 1 << 15 // 32768

/**
 * Unfurled media item - used by Thumbnail, MediaGallery, and File
 */
export interface UnfurledMediaItem {
	url: string // attachment:// or https:// URL
}

/**
 * TextDisplay - Standalone markdown text block
 */
export interface TextDisplayComponent {
	type: typeof ComponentTypeV2.TextDisplay
	id?: number
	content: string // Markdown text (max ~4000 chars total across all TextDisplay)
}

/**
 * Thumbnail - Image accessory for Section
 */
export interface ThumbnailComponent {
	type: typeof ComponentTypeV2.Thumbnail
	id?: number
	media: UnfurledMediaItem
	description?: string // Alt text (max 1024 chars)
	spoiler?: boolean
}

/**
 * Section - Text with optional accessory (thumbnail or button)
 */
export interface SectionComponent {
	type: typeof ComponentTypeV2.Section
	id?: number
	components: TextDisplayComponent[] // 1-3 TextDisplay components
	accessory?: ThumbnailComponent | ButtonComponentData
}

/**
 * MediaGallery item - Single image in gallery
 */
export interface MediaGalleryItem {
	media: UnfurledMediaItem
	description?: string // Max 1024 chars
	spoiler?: boolean
}

/**
 * MediaGallery - Grid of 1-10 images
 */
export interface MediaGalleryComponent {
	type: typeof ComponentTypeV2.MediaGallery
	id?: number
	items: MediaGalleryItem[] // 1-10 items
}

/**
 * File - Display uploaded file
 */
export interface FileComponentData {
	type: typeof ComponentTypeV2.File
	id?: number
	file: UnfurledMediaItem
	spoiler?: boolean
}

/**
 * Separator - Horizontal divider
 */
export interface SeparatorComponent {
	type: typeof ComponentTypeV2.Separator
	id?: number
	divider?: boolean // Show visible line (default: true)
	spacing?: 'small' | 'large'
}

/**
 * ActionRow component reference (for Container children)
 * Defined here to avoid circular imports with ComponentRow.tsx
 */
export interface ActionRowComponentRef {
	type: typeof ComponentTypeV2.ActionRow
	components: unknown[]
}

/**
 * Components that can be nested inside a Container
 * Per Discord spec: ActionRow, TextDisplay, Section, MediaGallery, File, Separator
 * Note: Container cannot be nested inside Container
 */
export type ContainerChildComponent =
	| ActionRowComponentRef
	| TextDisplayComponent
	| SectionComponent
	| MediaGalleryComponent
	| FileComponentData
	| SeparatorComponent

/**
 * Container - Styled wrapper with accent color
 */
export interface ContainerComponent {
	type: typeof ComponentTypeV2.Container
	id?: number
	accent_color?: number // RGB color (0-16777215) for left border
	spoiler?: boolean
	components: ContainerChildComponent[]
}

/**
 * Union of all V2 component types that can appear at top level
 */
export type V2TopLevelComponent =
	| TextDisplayComponent
	| SectionComponent
	| MediaGalleryComponent
	| FileComponentData
	| SeparatorComponent
	| ContainerComponent

/**
 * Union of all V2 component types (including nested)
 */
export type V2Component =
	| TextDisplayComponent
	| SectionComponent
	| ThumbnailComponent
	| MediaGalleryComponent
	| FileComponentData
	| SeparatorComponent
	| ContainerComponent

/**
 * Type guard for V2 components
 */
export function isV2Component(component: unknown): component is V2Component {
	if (typeof component !== 'object' || component === null) return false
	const type = (component as { type?: number }).type
	return (
		type === ComponentTypeV2.Section ||
		type === ComponentTypeV2.TextDisplay ||
		type === ComponentTypeV2.Thumbnail ||
		type === ComponentTypeV2.MediaGallery ||
		type === ComponentTypeV2.File ||
		type === ComponentTypeV2.Separator ||
		type === ComponentTypeV2.Container
	)
}

/**
 * Check if a message uses Components V2 format
 */
export function isComponentsV2Message(flags?: number): boolean {
	return flags !== undefined && (flags & MESSAGE_FLAG_IS_COMPONENTS_V2) !== 0
}
