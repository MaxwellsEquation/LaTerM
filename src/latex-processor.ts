import type { Terminal } from "@xterm/xterm"
import { LatexHashMap, type LatexEntry } from "./latex-hashmap"
import katex from "katex"

export interface LatexProcessorConfig {
	enabled?: boolean
	debugLogging?: boolean
	macros?: Record<string, string>
	onLog?: (message: string) => void
}

/**
 * LatexProcessor - Intercepts terminal.write() to detect and replace LaTeX with hash placeholders
 * Works in conjunction with LatexHashMap to store expressions for later rendering
 */
export class LatexProcessor {
	private terminal: Terminal
	private latexMap: LatexHashMap
	private buffer: string = ''  // For incomplete LaTeX at chunk boundaries
	private originalWrite: (data: string | Uint8Array, callback?: () => void) => void
	private enabled: boolean = true
	private debugLogging: boolean
	private processCount: number = 0
	private inAlternateScreen: boolean = false
	private macros: Record<string, string>
	private onLog?: (message: string) => void

	constructor(terminal: Terminal, config?: LatexProcessorConfig) {
		this.terminal = terminal
		this.latexMap = new LatexHashMap()
		this.debugLogging = config?.debugLogging ?? false
		this.enabled = config?.enabled ?? true
		this.onLog = config?.onLog

		// Default macros including @nl for row separators
		this.macros = {
			'@nl': '\\\\',  // PTY-safe alternative to \\
			...config?.macros
		}

		// Store original write function
		this.originalWrite = terminal.write.bind(terminal)

		// Hook terminal.write
		this.hookTerminalWrite()

		if (this.debugLogging) {
			this.log(`[LaTeX Processor] Started with config:`, config)
		}
	}

	/**
	 * Render LaTeX and measure its width in terminal cells
	 */
	private renderAndMeasure(latex: string, isDisplay: boolean = false): {
		html: string,
		width: number,
		pixelWidth: number,
		height: number,
		pixelHeight: number,
		error?: string
	} {
		try {
			// Render with KaTeX
			const html = katex.renderToString(latex, {
				throwOnError: false,
				displayMode: isDisplay,
				output: 'html',
				trust: false,
				strict: false
			})

			// Get terminal font size for accurate measurement
			const renderer = (this.terminal as any)._core?._renderService
			const fontSize = renderer?.dimensions?.actualCellHeight * 0.7 || 14

			// Create temporary element to measure
			const measurer = document.createElement('div')
			measurer.style.cssText = `
				position: absolute;
				visibility: hidden;
				height: auto;
				width: auto;
				white-space: nowrap;
				font-family: monospace;
				font-size: ${fontSize}px;
				line-height: 1;
				padding: 0;
				display: inline-block;
			`
			measurer.innerHTML = html
			document.body.appendChild(measurer)

			// Measure dimensions and calculate terminal cells needed
			const pixelWidth = measurer.offsetWidth
			const pixelHeight = measurer.offsetHeight

			// Get cell dimensions
			const cellDims = this.getCellDimensions()
			const cellWidth = cellDims.width
			const cellHeight = cellDims.height

			if (this.debugLogging) {
				console.log(`[LaTerM] Measurement: pixelWidth=${pixelWidth}, cellWidth=${cellWidth}`)
			}

			// Calculate cells needed
			const widthCells = Math.round(pixelWidth / cellWidth)
			const finalWidth = Math.max(widthCells, 4)

			const heightCells = Math.round(pixelHeight / cellHeight)
			const finalHeight = Math.max(heightCells, 1)

			// Clean up
			document.body.removeChild(measurer)

			return { html, width: finalWidth, pixelWidth, height: finalHeight, pixelHeight }
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error'
			console.error(`[LaTerM] KaTeX render error for "${latex}":`, error)
			return {
				html: `<span style="color: red; font-family: monospace;">[LaTeX Error]</span>`,
				width: 12,
				pixelWidth: 120,
				height: 1,
				pixelHeight: 16,
				error: errorMsg
			}
		}
	}

	/**
	 * Hook into terminal.write to process LaTeX
	 */
	private hookTerminalWrite(): void {
		this.terminal.write = (data: string | Uint8Array, callback?: () => void) => {
			if (!this.enabled || this.inAlternateScreen || typeof data !== 'string') {
				return this.originalWrite(data, callback)
			}

			// Detect alternate screen commands
			if (data.includes('\x1b[?1049h')) {
				this.inAlternateScreen = true
				this.log('[LaTeX Processor] Entering alternate screen')
				return this.originalWrite(data, callback)
			} else if (data.includes('\x1b[?1049l')) {
				this.inAlternateScreen = false
				this.log('[LaTeX Processor] Exiting alternate screen')
				return this.originalWrite(data, callback)
			}

			// Process LaTeX in the data
			const processed = this.processLatex(data)

			// Log if different from original
			if (processed !== data && this.debugLogging) {
				this.processCount++
				this.log(`[Process #${this.processCount}] LaTeX replacement occurred`)
			}

			return this.originalWrite(processed, callback)
		}
	}

	/**
	 * Apply macro replacements
	 */
	private applyMacros(latex: string): string {
		let result = latex
		for (const [macro, replacement] of Object.entries(this.macros)) {
			result = result.replace(new RegExp(macro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement)
		}
		return result
	}

	/**
	 * Process LaTeX expressions in text
	 */
	private processLatex(text: string): string {
		// Combine with any buffered incomplete LaTeX
		const combined = this.buffer + text
		this.buffer = ''

		let result = combined
		let replacementCount = 0

		// Process display LaTeX first: $$...$$
		result = result.replace(/\$\$([^$]+?)\$\$/g, (_, latex) => {
			// Apply macros (including @nl → \\)
			latex = this.applyMacros(latex)
			// Remove newlines that are likely from terminal wrapping
			latex = latex.replace(/\n\s*/g, ' ')
			replacementCount++

			// Generate hash
			const hash = this.latexMap.generateHash(latex)

			// Render and measure
			const { html, width, pixelWidth, height, pixelHeight, error } = this.renderAndMeasure(latex, true)

			// Get current cell dimensions
			const cellDims = this.getCellDimensions()

			// Store in hashmap - mark as display equation
			const entry: LatexEntry = {
				latex: latex,
				displayWidth: width,
				displayHeight: height,
				pixelWidth: pixelWidth,
				originalCellWidth: cellDims.width,
				originalCellHeight: cellDims.height,
				isDisplayEquation: true,
				...(error ? { renderError: error } : { renderedHTML: html })
			}
			this.latexMap.set(hash, entry)

			// Create placeholder
			const placeholder = this.latexMap.formatPlaceholder(hash, width)

			// Add vertical padding for display equations
			const verticalPadding = Math.max(1, Math.ceil(height / 2))
			const topPadding = '\n'.repeat(verticalPadding)
			const bottomPadding = '\n'.repeat(verticalPadding)

			return `${topPadding}${placeholder}${bottomPadding}`
		})

		// Then process inline LaTeX: $...$
		result = result.replace(/\$([^$]+?)\$/g, (match, latex) => {
			try {
				// Apply macros
				let cleanLatex = this.applyMacros(latex)
				// Remove newlines
				cleanLatex = cleanLatex.replace(/\n\s*/g, '').trim()

				// Check if expression meets criteria
				const isSmall = cleanLatex.length < 7
				const isMathExpression = cleanLatex.length < 150 && (/[+=><^\\]/.test(cleanLatex))

				if (!isSmall && !isMathExpression) {
					// Not a valid LaTeX candidate
					return match
				}

				// Try to render to validate
				const testRender = this.renderAndMeasure(cleanLatex, false)
				if (testRender.error) {
					// Rendering failed, treat as false positive
					return match
				}

				replacementCount++

				// Generate hash
				const hash = this.latexMap.generateHash(cleanLatex)

				// Get cell dimensions
				const cellDims = this.getCellDimensions()

				// Store in hashmap
				const entry: LatexEntry = {
					latex: cleanLatex,
					displayWidth: testRender.width,
					displayHeight: testRender.height || 1,
					pixelWidth: testRender.pixelWidth,
					originalCellWidth: cellDims.width,
					originalCellHeight: cellDims.height,
					renderedHTML: testRender.html
				}
				this.latexMap.set(hash, entry)

				// Create placeholder with adjusted width
				const contentCells = Math.floor(testRender.pixelWidth / cellDims.width)
				const adjustedCells = Math.max(contentCells - 2, 4)
				const placeholder = this.latexMap.formatPlaceholder(hash, adjustedCells)

				return placeholder
			} catch (error) {
				console.error(`[LaTerM] Exception in LaTeX processing:`, error)
				return match
			}
		})

		// Check for incomplete LaTeX at the end (buffering logic)
		const lastSingle = result.lastIndexOf('$')
		const lastDouble = result.lastIndexOf('$$')
		const lastNewline = result.lastIndexOf('\n')
		const lastDollar = Math.max(lastSingle, lastDouble)

		if (lastDollar > lastNewline && lastDollar !== -1) {
			const isDoubleDollar = lastDouble === lastDollar
			const dollarOffset = isDoubleDollar ? 2 : 1
			const afterDollar = result.substring(lastDollar + dollarOffset)

			// LaTeX patterns that suggest buffering
			const latexPatterns = [
				'\\frac', '\\sqrt', '\\sum', '\\int', '\\nabla', '\\partial',
				'\\alpha', '\\beta', '\\gamma', '\\theta', '\\phi', '\\psi',
				'\\begin', '\\end', '\\left', '\\right',
				'^{', '_{', '\\cdot', '\\times', '\\div', '\\mathbf', '\\text'
			]

			const potentialBuffer = result.substring(lastDollar)
			const looksLikeLatex = latexPatterns.some(p => afterDollar.includes(p))
			const isShellPrompt = !isDoubleDollar && (afterDollar.match(/^\s/) || afterDollar === '')
			const maxBufferSize = isDoubleDollar ? 100 : 50
			const shouldBuffer = isDoubleDollar || looksLikeLatex

			if (!afterDollar.includes(isDoubleDollar ? '$$' : '$') &&
			    !afterDollar.includes('\n') &&
			    shouldBuffer &&
			    !isShellPrompt &&
			    potentialBuffer.length < maxBufferSize) {
				this.buffer = potentialBuffer
				result = result.substring(0, lastDollar)
			}
		}

		// Clear buffer if it's been too long
		if (this.buffer.length > 100) {
			result = this.buffer + result
			this.buffer = ''
		}

		return result
	}

	/**
	 * Get terminal cell dimensions using public API
	 */
	private getCellDimensions(): { width: number, height: number } {
		const termElement = this.terminal.element
		if (!termElement) {
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
	 * Log a message if logging is enabled
	 */
	private log(...args: any[]): void {
		if (this.debugLogging) {
			if (this.onLog) {
				this.onLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
			} else {
				console.log('[LaTerM]', ...args)
			}
		}
	}

	/**
	 * Get the LaTeX hashmap for external access (e.g., overlay renderer)
	 */
	public getLatexMap(): LatexHashMap {
		return this.latexMap
	}

	/**
	 * Enable or disable the processor
	 */
	public setEnabled(enabled: boolean): void {
		this.enabled = enabled
		this.log(`[LaTeX Processor] ${enabled ? "Enabled" : "Disabled"}`)
	}

	/**
	 * Clean up resources
	 */
	public dispose(): void {
		// Restore original write function
		if (this.originalWrite) {
			this.terminal.write = this.originalWrite
		}

		// Clear the hashmap
		this.latexMap.clear()

		this.log('[LaTeX Processor] Disposed')
	}
}