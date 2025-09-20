<div align="center">
  <img src="logo.svg" alt="LaTerM" width="300" />

  Display beautiful mathematical equations directly in your terminal!
</div>

## Features

- **Zero-config** - Just load the addon and LaTeX works
- **Agent compatible** - Made for use with CLI AI tools
- **Inline & Display Math** - Support for both `$...$` and `$$...$$`
- **Smart Detection** - Distinguishes between LaTeX and shell variables
- **Theme Aware** - Automatically matches terminal colors

## Installation

```bash
npm install xterm-latex
```

## Quick Start

```javascript
import { Terminal } from '@xterm/xterm'
import { LatexAddon } from 'xterm-latex'

const terminal = new Terminal()
const latexAddon = new LatexAddon()

terminal.loadAddon(latexAddon)
terminal.open(document.getElementById('terminal'))

terminal.write('The equation $E = mc^2$ is not the whole story\n')
```

## Examples

### Inline Math
```javascript
terminal.write('Inline equation: $\\sqrt{x^2 + y^2}$\n')
terminal.write('Greek letters: $\\alpha, \\beta, \\gamma$\n')
```

### Display Math
```javascript
terminal.write('$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$\n')
```

### Matrices (using @nl macro)
```javascript
// Use @nl instead of \\ for row separators (PTY-safe)
terminal.write('$$\\begin{bmatrix} 1 & 2 @nl 3 & 4 \\end{bmatrix}$$\n')
```

### Custom Macros
```javascript
const latexAddon = new LatexAddon({
  macros: {
    '@nl': '\\\\',      // Row separator (necessary)
  }
})

terminal.write('Gradient: $@del f = (@del_x f, @del_y f)$\n')
```

## Configuration

```javascript
const latexAddon = new LatexAddon({
  // Enable debug logging
  debugLogging: false,

  // Custom macros for easier input
  macros: {
    '@nl': '\\\\',
    // Add your own macros here
  },

  // Maximum cached equations (default: 5000)
  cacheSize: 5000,

  // Minimum placeholder width in characters (default: 4)
  minPlaceholderWidth: 4,

  // Custom logging function
  onLog: (message) => console.log(message)
})
```

## Advanced Usage

### Manual Components

For more control, you can use the components individually:

```javascript
import { LatexProcessor, OverlayManager } from 'xterm-latex'

const processor = new LatexProcessor(terminal, config)
const overlayManager = new OverlayManager(terminal, processor.getLatexMap())
```

### Enable/Disable at Runtime

```javascript
// Disable LaTeX rendering
latexAddon.setEnabled(false)

// Re-enable it
latexAddon.setEnabled(true)
```

### Update Configuration

```javascript
latexAddon.updateConfig({
  debugLogging: true,
  macros: {
    '@sum': '\\sum'
  }
})
```

## How It Works

'terminal.write()' is hooked (notably NOT all pty data, just what is forwarded to render) and inline math is filtered out.


## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Credits

Built on top of:
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [KaTeX](https://katex.org/) - Fast math rendering