import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function sqlJsWasmInlinePlugin(): Plugin {
  return {
    name: 'sql-js-wasm-inline',
    resolveId(id) {
      if (id === 'virtual:sql-wasm') return '\0virtual:sql-wasm'
    },
    load(id) {
      if (id === '\0virtual:sql-wasm') {
        const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
        const base64 = fs.readFileSync(wasmPath).toString('base64')
        return `export default "${base64}";`
      }
    },
  }
}

export default defineConfig({
  build: { outDir: 'docs' },
  plugins: [sqlJsWasmInlinePlugin(), react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
