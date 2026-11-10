import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the favicon, Apple touch icon and manifest icons from a single SVG at build time.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
})
