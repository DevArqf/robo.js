/**
 * Game configuration constants
 */
export const GAME_CONFIG = {
	// Movement
	WALK_FORCE: 0.0015,
	RUN_FORCE: 0.003,
	MAX_WALK_VELOCITY: 3,
	MAX_RUN_VELOCITY: 6,
	HORIZONTAL_DAMPING: 0.85,

	// Idle timeout (ms)
	IDLE_TIMEOUT: 2000,

	// Physics
	GRAVITY: { x: 0, y: 1 },

	// Scene
	BACKGROUND_COLOR: 0x1a1a2e,

	// Assets
	ASSETS: {
		CLOUDS: {
			BACKGROUND: '/clouds/background.png',
			MOON: '/clouds/moon.png',
			LAYER_3: '/clouds/3.png',
			LAYER_4: '/clouds/4.png'
		}
	}
} as const
