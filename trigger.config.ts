import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: 'proj_caio',
  runtime: 'node',
  logLevel: 'log',
  maxDuration: 300, // 5 minutes max per task
  dirs: ['./jobs'],
})
