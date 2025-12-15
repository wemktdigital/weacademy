export async function collectSSE(response: Response) {
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []

  if (!reader) return { raw: '', events: [] as string[] }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(decoder.decode(value))
  }

  const raw = chunks.join('')
  const events = raw
    .split('\n\n')
    .filter(Boolean)
    .map((entry) => entry.replace(/^data: */g, '').trim())

  return { raw, events }
}
