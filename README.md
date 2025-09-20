# xterm-latex (LaTerM)

LaTeX rendering addon for xterm.js terminals. Display beautiful mathematical equations directly in your terminal!

## Features

- 🚀 **Zero-config** - Just load the addon and LaTeX works
- 📐 **Inline & Display Math** - Support for both `$...$` and `$$...$$`
- 🎯 **Smart Detection** - Distinguishes between LaTeX and shell variables
- 🔧 **PTY-Safe Macros** - Use `@nl` instead of `\\` for matrices
- 🎨 **Theme Aware** - Automatically matches terminal colors
- ⚡ **High Performance** - Efficient caching and lazy rendering
- 📦 **Tiny Size** - Minimal overhead with only essential dependencies

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

// That's it! LaTeX now works
terminal.write('The equation $E = mc^2$ is famous.\n')
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
    '@nl': '\\\\',      // Row separator (default)
    '@inf': '\\infty',  // Infinity symbol
    '@del': '\\nabla',  // Gradient operator
    '@int': '\\int',    // Integral (no backslash needed)
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

1. **Text Processing**: Intercepts `terminal.write()` calls to find LaTeX patterns
2. **Placeholder Insertion**: Replaces LaTeX with compact placeholders (4 chars)
3. **Overlay Rendering**: Creates DOM overlays with KaTeX-rendered equations
4. **Position Tracking**: Updates overlay positions on scroll/resize

## Why @nl Macro?

Terminal input often struggles with backslashes:
- `\\` becomes `\` (shell escaping)
- Different shells handle this differently
- AI assistants have trouble outputting the right number of backslashes

The `@nl` macro solves this by providing a PTY-safe alternative that always works.

## Browser Compatibility

Works in any modern browser that supports:
- ES2020
- DOM manipulation
- CSS positioning

## Performance

- Equations are cached after first render
- Overlays update only for visible content
- Scroll updates are debounced
- Resize triggers smart re-layout

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Credits

Built on top of:
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [KaTeX](https://katex.org/) - Fast math rendering