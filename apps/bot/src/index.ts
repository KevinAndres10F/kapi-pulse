import 'dotenv/config'
import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.warn('TELEGRAM_BOT_TOKEN no configurado — bot en modo standby')
} else {
  const bot = new Bot(token)

  bot.command('start', (ctx) => ctx.reply(
    'Bienvenido a KAPI Pulse. Usa /help para ver los comandos disponibles.'
  ))

  bot.command('help', (ctx) => ctx.reply(
    'Comandos disponibles:\n' +
    '/start <token> — Vincular cuenta\n' +
    '/status — Estado de tus cuentas\n' +
    '/silenciar 1h — Silenciar alertas\n' +
    '/resumen — Resumen del día'
  ))

  bot.command('status', (ctx) => ctx.reply('Estado: todo operativo.'))

  bot.start()
  console.log('Bot de Telegram iniciado')
}

export {}
