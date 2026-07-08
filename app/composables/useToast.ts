export interface Toast {
  id: number
  type: 'ok' | 'error' | 'info'
  text: string
}

export const useToasts = () => useState<Toast[]>('toasts', () => [])

export function useToast() {
  const toasts = useToasts()

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(type: Toast['type'], text: string) {
    const id = Date.now() + Math.random()
    toasts.value = [...toasts.value, { id, type, text }]
    if (import.meta.client) setTimeout(() => dismiss(id), 5500)
  }

  return {
    dismiss,
    ok: (t: string) => push('ok', t),
    error: (t: string) => push('error', t),
    info: (t: string) => push('info', t),
  }
}
