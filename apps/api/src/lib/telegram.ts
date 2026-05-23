/**
 * Helper minimalista para mandar mensajes via Telegram Bot API.
 *
 * Versión inicial: solo manda a TELEGRAM_ADMIN_CHAT_ID (un único chat
 * del admin/equipo KAPI). No requiere mapping user↔chat_id en DB —
 * cuando se necesite notificar a usuarios individuales, hace falta una
 * tabla telegram_links y un comando /start <token> en el bot.
 *
 * Failures are silent (console.warn) — no queremos que una notificación
 * caída tumbe un flow crítico como aprobar una campaña.
 */

const TG_API = 'https://api.telegram.org'

interface SendOptions {
  parseMode?: 'MarkdownV2' | 'HTML'
  disablePreview?: boolean
}

export async function notifyAdmin(message: string, opts: SendOptions = {}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!token || !chatId) {
    // No configurado — no es error, simplemente no notificamos.
    return false
  }

  try {
    const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: opts.parseMode || 'HTML',
        disable_web_page_preview: opts.disablePreview ?? true,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[telegram] sendMessage failed:', res.status, body.slice(0, 200))
      return false
    }
    return true
  } catch (e) {
    console.warn('[telegram] error:', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * Helper para escapar HTML (para usar con parseMode: 'HTML').
 * Telegram HTML solo soporta unos pocos tags; cualquier < o > en el
 * contenido del usuario va escapado.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
