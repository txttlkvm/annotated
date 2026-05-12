const buffer: string[] = []
const MAX_TOKENS = 6000

export function appendToBuffer(sentence: string): void {
  buffer.push(sentence)
  while (Math.ceil(buffer.join(' ').length / 4) > MAX_TOKENS) {
    buffer.shift()
  }
}

export function getBuffer(): string {
  return buffer.join(' ')
}

export function clearBuffer(): void {
  buffer.length = 0
}
