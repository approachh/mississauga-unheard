import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { handleStatus, handleTranscribe } from './api/transcribe.ts'

/**
 * Serves /api/transcribe locally (dev and preview) with the same handler Vercel deploys.
 * Server-only env vars (ELEVENLABS_API_KEY) are read from .env.local here and never
 * reach the client bundle: Vite only exposes VITE_-prefixed variables to the browser.
 */
function transcribeApi(env: Record<string, string>): Plugin {
  const middleware: Connect.NextHandleFunction = (req: IncomingMessage, res: ServerResponse, next) => {
    if (!req.url?.startsWith('/api/transcribe')) return next()
    const run = async () => {
      let response: Response
      if (req.method === 'GET') {
        response = handleStatus(env)
      } else if (req.method === 'POST') {
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
        const request = new Request(`http://localhost${req.url}`, {
          method: 'POST',
          headers,
          body: Readable.toWeb(req) as ReadableStream,
          duplex: 'half',
        } as RequestInit)
        response = await handleTranscribe(request, env)
      } else {
        response = new Response(JSON.stringify({ error: { code: 'method_not_allowed', message: 'Use GET or POST.' } }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', Allow: 'GET, POST' },
        })
      }
      res.statusCode = response.status
      response.headers.forEach((v, k) => res.setHeader(k, v))
      res.end(Buffer.from(await response.arrayBuffer()))
    }
    run().catch((e: unknown) => {
      console.error('[api/transcribe]', e instanceof Error ? e.message : e)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: { code: 'internal', message: 'Unexpected server error.' } }))
    })
  }
  return {
    name: 'voxelo-transcribe-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), transcribeApi({ ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, string>)],
}))
