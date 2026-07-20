import { useSyncExternalStore } from 'react'

export type ToastVariant = 'default' | 'destructive'

export interface ToasterToast {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
}

const AUTO_DISMISS_MS = 5000

let toastCount = 0
let toasts: ToasterToast[] = []
const listeners = new Set<() => void>()
const dismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function toast(options: ToastOptions): string {
  toastCount += 1
  const id = String(toastCount)
  toasts = [...toasts, { id, ...options }]
  dismissTimeouts.set(
    id,
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
  )
  emit()
  return id
}

export function dismiss(id: string): void {
  const timeout = dismissTimeouts.get(id)
  if (timeout !== undefined) {
    clearTimeout(timeout)
    dismissTimeouts.delete(id)
  }
  if (toasts.some((t) => t.id === id)) {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ToasterToast[] {
  return toasts
}

export interface UseToastReturn {
  toasts: ToasterToast[]
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
}

export function useToast(): UseToastReturn {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { toasts: current, toast, dismiss }
}
