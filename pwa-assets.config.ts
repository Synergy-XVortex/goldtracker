import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const ICON_BACKGROUND = '#121315'

// Generates the favicon, Apple touch icon and manifest icons from a single SVG at build time.
// public/logo.svg already keeps its artwork inside the 80% safe circle and fills the whole
// square, so the maskable and Apple icons need no extra padding (which would show a border).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
      resizeOptions: { background: ICON_BACKGROUND },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: ICON_BACKGROUND },
    },
  },
  images: ['public/logo.svg'],
})
