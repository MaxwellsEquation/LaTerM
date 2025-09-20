import type { Terminal, ITerminalAddon } from "@xterm/xterm"
import { LatexProcessor, type LatexProcessorConfig } from "./latex-processor"
import { OverlayManager } from "./overlay-manager"

export interface LatexAddonConfig extends LatexProcessorConfig {
	/**
	 * Enable or disable the addon
	 * @default true
	 */
	enabled?: boolean

	/**
	 * Enable debug logging to console
	 * @default false
	 */
	debugLogging?: boolean

	/**
	 * Custom macros for text replacement before LaTeX processing
	 * @default { '@nl': '\\\\' }
	 * @example { '@nl': '\\\\', '@inf': '\\infty', '@del': '\\nabla' }
	 */
	macros?: Record<string, string>

	/**
	 * Maximum number of LaTeX expressions to cache
	 * @default 5000
	 */
	cacheSize?: number

	/**
	 * Minimum width in characters for placeholders
	 * @default 4
	 */
	minPlaceholderWidth?: number

	/**
	 * Custom logging function
	 */
	onLog?: (message: string) => void
}

/**
 * LaTeX rendering addon for xterm.js
 *
 * @example
 * ```typescript
 * import { Terminal } from '@xterm/xterm'
 * import { LatexAddon } from 'xterm-latex'
 *
 * const terminal = new Terminal()
 * const latexAddon = new LatexAddon()
 * terminal.loadAddon(latexAddon)
 *
 * // LaTeX is now automatically rendered!
 * terminal.write('The equation $E = mc^2$ is famous.')
 * ```
 */
export class LatexAddon implements ITerminalAddon {
	private terminal?: Terminal
	private processor?: LatexProcessor
	private overlayManager?: OverlayManager
	private config: LatexAddonConfig

	constructor(config?: LatexAddonConfig) {
		// Default configuration
		this.config = {
			enabled: true,
			debugLogging: false,
			macros: {
				'@nl': '\\\\',  // PTY-safe alternative for row separators
				...config?.macros
			},
			cacheSize: 5000,
			minPlaceholderWidth: 4,
			...config
		}
	}

	/**
	 * Called when the addon is activated
	 */
	activate(terminal: Terminal): void {
		this.terminal = terminal

		// Create the LaTeX processor (hooks terminal.write)
		this.processor = new LatexProcessor(terminal, this.config)

		// Create the overlay manager (renders overlays)
		this.overlayManager = new OverlayManager(
			terminal,
			this.processor.getLatexMap()
		)

		if (this.config.debugLogging) {
			console.log('[LaTerM] LaTeX addon activated', this.config)
		}
	}

	/**
	 * Called when the addon is disposed
	 */
	dispose(): void {
		if (this.config.debugLogging) {
			console.log('[LaTerM] LaTeX addon disposing')
		}

		// Clean up in reverse order
		this.overlayManager?.dispose()
		this.processor?.dispose()

		this.terminal = undefined
		this.processor = undefined
		this.overlayManager = undefined
	}

	/**
	 * Enable or disable the addon
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled
		this.processor?.setEnabled(enabled)
		this.overlayManager?.setEnabled(enabled)
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<LatexAddonConfig>): void {
		this.config = { ...this.config, ...config }

		// Recreate processor with new config if terminal is active
		if (this.terminal && this.processor) {
			this.processor.dispose()
			this.processor = new LatexProcessor(this.terminal, this.config)

			// Update overlay manager with new processor
			if (this.overlayManager) {
				this.overlayManager.dispose()
				this.overlayManager = new OverlayManager(
					this.terminal,
					this.processor.getLatexMap()
				)
			}
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): LatexAddonConfig {
		return { ...this.config }
	}
}