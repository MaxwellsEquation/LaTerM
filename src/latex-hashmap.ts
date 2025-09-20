/**
 * LatexHashMap - Manages hash generation and LaTeX expression storage
 * Uses self-identifying placeholders with «evm[hash]» format
 */

export interface LatexEntry {
	latex: string           // Original LaTeX expression
	displayWidth: number    // Calculated width in terminal cells
	displayHeight: number   // Calculated height in terminal lines (usually 1)
	pixelWidth: number      // Exact pixel width at measurement time
	originalCellWidth: number  // Cell width when measured (for zoom calculations)
	originalCellHeight: number // Cell height when measured (for zoom calculations)
	isDisplayEquation?: boolean // True for $$...$$ expressions that should be centered
	renderedHTML?: string   // Cached KaTeX/MathJax rendered HTML
	renderError?: string    // Error if rendering failed
}

export class LatexHashMap {
	private map: Map<string, LatexEntry> = new Map()
	// Most terminals have scrollback of 1000-10000 lines
	// With average ~5 LaTeX expressions per screen, 5000 should cover even heavy usage
	private maxSize: number = 5000
	
	/**
	 * Generate a unique 3-character base62 hash for a LaTeX expression
	 * Format: [0-9A-Za-z]{3}
	 */
	generateHash(latex: string): string {
		const base62chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
		
		// Deterministic hash - same LaTeX always gets same hash
		let hash = 0
		for (let i = 0; i < latex.length; i++) {
			const char = latex.charCodeAt(i)
			hash = ((hash << 5) - hash) + char
			hash = hash & hash // Convert to 32-bit integer
		}
		
		// Convert to base62
		let result = ''
		let num = Math.abs(hash)
		for (let i = 0; i < 3; i++) {
			result = base62chars[num % 62] + result
			num = Math.floor(num / 62)
		}
		
		// Basic collision prevention - if hash exists and has different LaTeX, increment
		let finalHash = result
		let attempts = 0
		while (attempts < 100 && this.has(finalHash) && this.get(finalHash)?.latex !== latex) {
			num = (Math.abs(hash) + attempts + 1) % (62 * 62 * 62)
			finalHash = ''
			for (let i = 0; i < 3; i++) {
				finalHash = base62chars[num % 62] + finalHash
				num = Math.floor(num / 62)
			}
			attempts++
		}
		
		return finalHash
	}
	
	/**
	 * Format a placeholder with U+E000 and 3-char base62 hash
	 * Example: \uE000Abc    (with spaces to fill width)
	 */
	formatPlaceholder(hash: string, width: number): string {
		const marker = `\uE000${hash}`  // U+E000 + 3 base62 chars = 4 chars total
		// Minimum width is the marker itself (4 chars)
		const actualWidth = Math.max(width, marker.length)
		// Use non-breaking spaces (U+00A0) - won't be stripped by terminal and have actual width
		const padding = '\u00A0'.repeat(actualWidth - marker.length)
		const result = marker + padding
		
		// Debug logging
		console.log(`[LaTerM DEBUG] formatPlaceholder: hash=${hash}, width=${width}, actualWidth=${actualWidth}, padding=${padding.length} non-breaking spaces`)
		
		return result
	}
	
	/**
	 * Extract hash from a placeholder marker
	 * Returns null if not a valid marker
	 */
	extractHash(text: string, position: number): string | null {
		// Look for \uE000[hash] pattern at position
		const markerRegex = /\uE000([0-9A-Za-z]{3})/
		const substring = text.substring(position, position + 4) // \uE000ABC
		const match = substring.match(markerRegex)
		return match?.[1] ?? null
	}
	
	/**
	 * Store a LaTeX expression with its hash
	 * Automatically evicts oldest entry if at max size
	 */
	set(hash: string, entry: LatexEntry): void {
		// If at max size, delete oldest (first) entry
		if (this.map.size >= this.maxSize) {
			const firstKey = this.map.keys().next().value
			if (firstKey) this.map.delete(firstKey)
		}
		this.map.set(hash, entry)
	}
	
	/**
	 * Get a LaTeX expression by its hash
	 */
	get(hash: string): LatexEntry | undefined {
		return this.map.get(hash)
	}
	
	/**
	 * Check if a hash exists
	 */
	has(hash: string): boolean {
		return this.map.has(hash)
	}
	
	/**
	 * Delete an entry by hash
	 */
	delete(hash: string): boolean {
		return this.map.delete(hash)
	}
	
	/**
	 * Get the size of the map
	 */
	get size(): number {
		return this.map.size
	}
	
	/**
	 * Find all hash markers in a line of text
	 * Returns array of {hash, column, width}
	 */
	findHashMarkers(text: string): Array<{hash: string, column: number, width: number}> {
		const markers: Array<{hash: string, column: number, width: number}> = []
		const regex = /\uE000([0-9A-Za-z]{3})(\s*)/g
		let match
		
		while ((match = regex.exec(text)) !== null) {
			const hash = match[1]
			const totalWidth = match[0].length // Include marker and spaces
			
			if (hash && this.has(hash)) {
				markers.push({
					hash: hash,
					column: match.index,
					width: totalWidth
				})
			}
		}
		
		return markers
	}
	
	
	
	/**
	 * Debug: Get statistics about the map
	 */
	getStats(): {
		totalEntries: number
		maxSize: number
		percentFull: number
	} {
		return {
			totalEntries: this.map.size,
			maxSize: this.maxSize,
			percentFull: Math.round((this.map.size / this.maxSize) * 100)
		}
	}
	
	/**
	 * Clear all entries
	 */
	clear(): void {
		this.map.clear()
	}
}