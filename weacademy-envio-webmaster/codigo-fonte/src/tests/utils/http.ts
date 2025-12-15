import { NextRequest } from 'next/server'

type JsonRequestInit = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
}

export function createJsonRequest(url: string, init: JsonRequestInit = {}) {
  const { method = 'POST', headers = {}, body } = init
  const serializedBody = body !== undefined ? JSON.stringify(body) : undefined
  return new NextRequest(url, {
    method,
    body: serializedBody,
    headers: {
      'content-type': serializedBody ? 'application/json' : headers['content-type'] || 'application/json',
      ...headers,
    },
  })
}
