/**
 * Store en memoria de estados OAuth pendientes (mientras el usuario está en
 * el flow del proveedor). En producción multi-instancia hay que mover esto a
 * Redis para que cualquier réplica de la API pueda completar el callback.
 */

export interface PendingOAuthState {
  orgId: string
  userId: string
  provider: string
  createdAt: number
}

const pendingStates = new Map<string, PendingOAuthState>()

// Limpieza de estados >10 min cada minuto
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of pendingStates) {
    if (now - val.createdAt > 600_000) pendingStates.delete(key)
  }
}, 60_000)

export function savePendingState(state: string, payload: Omit<PendingOAuthState, 'createdAt'>) {
  pendingStates.set(state, { ...payload, createdAt: Date.now() })
}

export function consumePendingState(state: string): PendingOAuthState | undefined {
  const found = pendingStates.get(state)
  if (found) pendingStates.delete(state)
  return found
}
