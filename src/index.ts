/**
 * xterm-latex - LaTeX rendering addon for xterm.js terminals
 *
 * @packageDocumentation
 */

// Main addon export
export { LatexAddon } from './addon'
export type { LatexAddonConfig } from './addon'

// Individual components for advanced usage
export { LatexProcessor } from './latex-processor'
export type { LatexProcessorConfig } from './latex-processor'

export { OverlayManager } from './overlay-manager'

export { LatexHashMap } from './latex-hashmap'
export type { LatexEntry } from './latex-hashmap'

// Version
export const VERSION = '0.1.0'

/**
 * Quick start example:
 * ```typescript
 * import { Terminal } from '@xterm/xterm'
 * import { LatexAddon } from 'xterm-latex'
 *
 * const terminal = new Terminal()
 * const latexAddon = new LatexAddon({
 *   debugLogging: false,
 *   macros: {
 *     '@nl': '\\\\',  // Use @nl for row separators in matrices
 *     '@inf': '\\infty',
 *     '@del': '\\nabla'
 *   }
 * })
 *
 * terminal.loadAddon(latexAddon)
 * terminal.open(document.getElementById('terminal'))
 *
 * // Now you can use LaTeX!
 * terminal.write('Inline math: $E = mc^2$\n')
 * terminal.write('Display math: $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$\n')
 * terminal.write('Matrix: $$\\begin{bmatrix} 1 & 2 @nl 3 & 4 \\end{bmatrix}$$\n')
 * ```
 */