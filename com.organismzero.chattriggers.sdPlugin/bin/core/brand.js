// The Chat Triggers look: colours and the mark, shared by the key images, the static icons and the
// Marketplace artwork (scripts/render-images.js). Matches the Chat Triggers design system's tokens.

export const COLOURS = Object.freeze({
  ground: '#111318',
  raised: '#1b1f27',
  line: '#323845',
  muted: '#99a1b0',
  paper: '#f3f4f7',
  spark: '#ffcc33',
  sparkDim: '#8c7430',
  onSpark: '#111318',
  go: '#3ddc84',
  wait: '#5aa9ff',
  fault: '#ff5c5c',
  faultGround: '#3a1418'
})

// The mark, drawn on a 144 × 144 grid: a chat bubble shaped like a Stream Deck key, with a bolt in it.
// Bounding box x 18–126, y 16–126.
export const MARK = Object.freeze({
  bubble: 'M36 16H108A18 18 0 0 1 126 34V88A18 18 0 0 1 108 106H62L38 126V106H36A18 18 0 0 1 18 88V34A18 18 0 0 1 36 16Z',
  bolt: 'M82 28L50 66H70L62 96L94 56H74Z',
  centre: { x: 72, y: 71 }
})

/**
 * The mark as SVG elements, scaled about its centre and moved so the centre lands at (x, y).
 * @param {object} options
 * @param {number} options.x
 * @param {number} options.y
 * @param {number} options.scale
 * @param {string} options.bubble Bubble colour.
 * @param {string} options.bolt Bolt colour.
 * @param {'outline' | 'solid'} [options.style] Outline draws the bubble as a line; solid fills it.
 * @param {number} [options.stroke] Line width on the 144 grid, before scaling.
 * @param {boolean} [options.dashed]
 * @returns {string}
 */
export function markSvg ({ x, y, scale, bubble, bolt, style = 'outline', stroke = 10, dashed = false }) {
  const tx = round(x - MARK.centre.x * scale)
  const ty = round(y - MARK.centre.y * scale)
  const bubbleAttrs = style === 'solid'
    ? `fill="${bubble}"`
    : `fill="none" stroke="${bubble}" stroke-width="${stroke}" stroke-linejoin="round"${dashed ? ' stroke-dasharray="14 10"' : ''}`
  return `<g transform="translate(${tx} ${ty}) scale(${scale})">` +
    `<path d="${MARK.bubble}" ${bubbleAttrs}/>` +
    `<path d="${MARK.bolt}" fill="${bolt}"/>` +
    '</g>'
}

function round (number) {
  return Math.round(number * 100) / 100
}
