import { create } from 'zustand'

// ── notify port — the panel's own toast seam (replaces react-admin useNotify) ──
//
//  A tiny dependency-free Zustand slice. It is the ISP-clean substitution for the
//  one live capability react-admin carried (a toast hook): the port is OURS, so
//  the toast surface is decoupled from BOTH react-admin (now retired) AND MUI (the
//  rendering impl, and the flagged north-star exit). The renderer lives behind this
//  seam (shared/ToastHost.tsx) and can swap without touching a single call site.
//
//  `useToast()` returns a `notify(message, { type })` fn — API-compatible with the
//  old RA useNotify() call shape, so relocating a call site is a one-line import swap.

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id:      number
  message: string
  type:    ToastType
}

export interface NotifyOptions {
  type?: ToastType
}

interface NotifyState {
  queue:   Toast[]
  notify:  (message: string, opts?: NotifyOptions) => void
  dismiss: (id: number) => void
}

let nextId = 0

export const useNotifyStore = create<NotifyState>((set) => ({
  queue: [],
  notify: (message, opts) =>
    set((s) => ({ queue: [...s.queue, { id: nextId++, message, type: opts?.type ?? 'info' }] })),
  dismiss: (id) =>
    set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),
}))

// The consumer hook. Returns the stable `notify` action reference.
export function useToast() {
  return useNotifyStore((s) => s.notify)
}
