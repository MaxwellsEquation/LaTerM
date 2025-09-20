import type { Terminal } from "@xterm/xterm"
import { LatexHashMap, type LatexEntry } from "./latex-hashmap"
import katex from "katex"

/**
 * OverlayManager - Manages KaTeX rendered overlays positioned over terminal grid
 * Scans terminal buffer for placeholder patterns and creates/updates overlays
 */
export class OverlayManager {
	private terminal: Terminal
	private latexMap: LatexHashMap
	private overlayContainer: HTMLDivElement
	private overlays: Map<string, HTMLDivElement> = new Map()
	private enabled: boolean = true
	private scrollDebounceTimer: number | null = null
	private cachedColors: { background: string, foreground: string } | null = null

	constructor(terminal: Terminal, latexMap: LatexHashMap) {
		this.terminal = terminal
		this.latexMap = latexMap

		// Create overlay container
		this.overlayContainer = document.createElement('div')
		this.overlayContainer.className = 'latex-overlay-container'
		this.overlayContainer.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			z-index: 100;
			overflow: hidden;
		`

		// Add global styles to reduce KaTeX spacing
		const styleElement = document.createElement('style')
		styleElement.textContent = `
			.latex-overlay-container .katex {
				margin: 0 !important;
			}
			.latex-overlay-container .katex:not(.katex-display) {
				vertical-align: baseline !important;
			}
			.latex-overlay-container .katex-display {
				margin: 0 !important;
				padding: 0 !important;
			}
			.latex-overlay-container .katex:not(.katex-display) .base {
				vertical-align: baseline !important;
			}
			.latex-overlay-container .katex-html {
				padding: 0 !important;
			}
		`
		this.overlayContainer.appendChild(styleElement)

		// Attach directly to terminal element
		const terminalElement = terminal.element
		if (terminalElement) {
			terminalElement.style.position = 'relative'
			terminalElement.appendChild(this.overlayContainer)
		}

		// Hook terminal events
		this.hookTerminalEvents()
	}

	/**
	 * Hook into terminal events for updating overlays
	 */
	private hookTerminalEvents(): void {
		// Update on render (viewport changes)
		this.terminal.onRender(() => {
			if (this.enabled) {
				this.updateOverlays()
			}
		})

		// Update on scroll with debouncing
		this.terminal.onScroll(() => {
			if (!this.enabled) return

			// Clear existing timer
			if (this.scrollDebounceTimer !== null) {
				clearTimeout(this.scrollDebounceTimer)
			}

			// Debounce scroll updates
			this.scrollDebounceTimer = window.setTimeout(() => {
				this.updateOverlays()
				this.scrollDebounceTimer = null
			}, 50)
		})

		// Update on resize
		this.terminal.onResize(() => {
			if (this.enabled) {
				// Clear all overlays on resize as positions change
				this.clearAllOverlays()
				// Rebuild after a short delay
				setTimeout(() => this.updateOverlays(), 100)
			}
		})
	}

	/**
	 * Render LaTeX to HTML using KaTeX with caching
	 */
	private renderLatex(entry: LatexEntry): string {
		// Return cached render if available
		if (entry.renderedHTML) {
			return entry.renderedHTML
		}

		// Return error if previously failed
		if (entry.renderError) {
			return `<span style="color: red; font-family: monospace;">[LaTeX Error]</span>`
		}

		try {
			// Render with KaTeX
			const html = katex.renderToString(entry.latex, {
				throwOnError: false,
				displayMode: entry.isDisplayEquation === true,
				output: 'html',
				trust: false,
				strict: false
			})

			// Cache the result
			entry.renderedHTML = html
			return html
		} catch (error) {
			// Cache the error
			entry.renderError = error instanceof Error ? error.message : 'Unknown error'
			console.error(`[LaTerM] KaTeX render error for "${entry.latex}":`, error)
			return `<span style="color: red; font-family: monospace;">[LaTeX Error]</span>`
		}
	}

	/**
	 * Get terminal cell dimensions using public API
	 */
	private getCellDimensions(): { width: number, height: number } {
		const termElement = this.terminal.element
		if (!termElement) {
			console.warn('[LaTerM] Terminal element not available')
			return { width: 8, height: 16 } // Fallback values
		}

		const viewport = termElement.querySelector('.xterm-viewport') as HTMLElement
		const screen = termElement.querySelector('.xterm-screen') as HTMLElement
		const element = screen || viewport || termElement

		const width = element.clientWidth / this.terminal.cols
		const height = element.clientHeight / this.terminal.rows

		return { width, height }
	}

	/**
	 * Get the terminal's theme colors (cached)
	 */
	private getTerminalColors(): { background: string, foreground: string } {
		// Return cached colors if available
		if (this.cachedColors) {
			return this.cachedColors
		}

		// Access the terminal's theme through the xterm.js API
		const theme = this.terminal.options.theme

		// Determine colors based on theme
		if (theme && theme.background && theme.foreground) {
			this.cachedColors = {
				background: theme.background,
				foreground: theme.foreground
			}
		} else {
			// xterm.js defaults
			this.cachedColors = {
				background: '#000000',
				foreground: '#ffffff'
			}
		}

		return this.cachedColors
	}

	/**
	 * Clear cached colors (call if theme changes)
	 */
	public clearColorCache(): void {
		this.cachedColors = null
	}

	/**
	 * Create or update an overlay for a hash at a specific position
	 */
	private createOrUpdateOverlay(hash: string, row: number, col: number): void {
		const entry = this.latexMap.get(hash)
		if (!entry) {
			return
		}

		// Get terminal theme colors
		const colors = this.getTerminalColors()

		// Get or create overlay element
		let overlay = this.overlays.get(hash)
		if (!overlay) {
			overlay = document.createElement('div')
			overlay.className = 'latex-overlay'
			overlay.dataset['hash'] = hash

			// Check if this is a display equation
			const isDisplayEquation = entry.isDisplayEquation === true

			// Get terminal font size to match
			const cellDims = this.getCellDimensions()

			if (isDisplayEquation) {
				// CSS-centered display equation
				overlay.style.cssText = `
					position: absolute;
					pointer-events: none;
					background: ${colors.background};
					color: ${colors.foreground};
					font-size: ${cellDims.height * 0.7}px;
					line-height: normal;
					white-space: normal;
					padding: 0;
					margin: 0;
					box-sizing: border-box;
					text-align: center;
					width: 100%;
					left: 0 !important;
				`
			} else {
				// Regular inline equation positioning
				overlay.style.cssText = `
					position: absolute;
					pointer-events: none;
					background: ${colors.background};
					color: ${colors.foreground};
					font-size: ${cellDims.height * 0.7}px;
					line-height: 1;
					min-width: ${4 * cellDims.width}px;
					white-space: nowrap;
					padding: 0;
					margin: 0;
					box-sizing: border-box;
					display: inline-block;
				`
			}
			this.overlayContainer.appendChild(overlay)
			this.overlays.set(hash, overlay)
		}

		// Render LaTeX content (cached)
		overlay.innerHTML = this.renderLatex(entry)

		// Measure actual rendered content width
		overlay.style.width = 'auto'
		const actualContentWidth = overlay.offsetWidth

		// Calculate pixel position
		const cellDims = this.getCellDimensions()
		const x = col * cellDims.width
		const y = row * cellDims.height

		// Check if this is a display equation
		const isDisplayEquation = entry.isDisplayEquation === true

		// Calculate final width
		const minWidth = 4 * cellDims.width
		const finalWidth = Math.max(actualContentWidth, minWidth)

		// Update position and size
		if (isDisplayEquation) {
			// For centered display equations
			overlay.style.left = '0px'
			overlay.style.top = `${y}px`
			overlay.style.width = '100%'
			overlay.style.height = `${cellDims.height}px`
		} else {
			// Regular inline positioning
			overlay.style.left = `${x}px`
			overlay.style.top = `${y}px`

			// If LaTeX content is smaller than minimum width, center it
			if (finalWidth === minWidth) {
				overlay.style.width = `${minWidth}px`
				overlay.style.textAlign = 'center'
				overlay.style.display = 'flex'
				overlay.style.justifyContent = 'center'
				overlay.style.alignItems = 'center'
			} else {
				overlay.style.width = `${finalWidth}px`
				overlay.style.textAlign = 'left'
				overlay.style.display = 'inline-block'
				overlay.style.justifyContent = 'unset'
				overlay.style.alignItems = 'unset'
			}

			overlay.style.minWidth = `${minWidth}px`
			overlay.style.verticalAlign = 'middle'
		}

		// Common style updates
		overlay.style.fontSize = `${cellDims.height * 0.7}px`
		if (!isDisplayEquation) {
			overlay.style.lineHeight = `${cellDims.height}px`
		}

		// Update colors in case terminal theme changed
		const currentColors = this.getTerminalColors()
		overlay.style.background = currentColors.background
		overlay.style.color = currentColors.foreground

		// Set max width to prevent overflow (only for inline)
		if (!isDisplayEquation) {
			const maxWidth = (this.terminal.cols - col) * cellDims.width
			overlay.style.maxWidth = `${maxWidth}px`
		}

		// Mark as active (for cleanup)
		overlay.dataset['active'] = 'true'
	}

	/**
	 * Scan terminal buffer and update all overlays
	 */
	private updateOverlays(): void {
		if (!this.enabled) return

		// Mark all overlays as inactive
		this.overlays.forEach(overlay => {
			overlay.dataset['active'] = 'false'
		})

		// Get viewport bounds
		const buffer = this.terminal.buffer.active
		const viewportY = buffer.viewportY
		const rows = this.terminal.rows

		// Scan visible buffer for hash patterns
		for (let row = 0; row < rows; row++) {
			const line = buffer.getLine(viewportY + row)
			if (!line) continue

			const text = line.translateToString()

			// Find all \uE000XXX patterns in this line
			const hashRegex = /\uE000([0-9A-Za-z]{3})/g
			let match

			while ((match = hashRegex.exec(text)) !== null) {
				const hash = match[1]
				if (!hash) continue
				const col = match.index

				// Create or update overlay at this position
				this.createOrUpdateOverlay(hash, row, col)
			}
		}

		// Remove inactive overlays (no longer visible)
		this.overlays.forEach((overlay, hash) => {
			if (overlay.dataset['active'] === 'false') {
				overlay.remove()
				this.overlays.delete(hash)
			}
		})
	}

	/**
	 * Clear all overlays
	 */
	private clearAllOverlays(): void {
		this.overlays.forEach(overlay => overlay.remove())
		this.overlays.clear()
	}

	/**
	 * Enable or disable the overlay manager
	 */
	public setEnabled(enabled: boolean): void {
		this.enabled = enabled
		if (!enabled) {
			this.clearAllOverlays()
		} else {
			this.updateOverlays()
		}
	}

	/**
	 * Clean up resources
	 */
	public dispose(): void {
		// Clear debounce timer
		if (this.scrollDebounceTimer !== null) {
			clearTimeout(this.scrollDebounceTimer)
		}

		// Remove all overlays
		this.clearAllOverlays()

		// Remove container
		this.overlayContainer.remove()
	}
}