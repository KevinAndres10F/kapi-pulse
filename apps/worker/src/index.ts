import 'dotenv/config'
import { refreshExpiringTokens } from './jobs/refresh-tokens.js'
import { publishPost } from './jobs/publish-post.js'

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  console.warn('REDIS_URL no configurado — worker en modo standby')
  console.log('Worker de publicacion iniciado (standby — sin Redis)')
} else {
  const { Queue, Worker, QueueScheduler } = await import('bullmq')
  const IORedis = (await import('ioredis')).default

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })

  // ============== Cola de publicación ==============
  const publishQueue = new Queue('publish', { connection })

  const publishWorker = new Worker(
    'publish',
    async (job) => {
      console.log(`[worker] Procesando job ${job.id}: ${job.name}`, job.data)

      switch (job.name) {
        case 'publish-post':
          return await publishPost(job.data)
        default:
          console.warn(`[worker] Job desconocido: ${job.name}`)
      }
    },
    {
      connection,
      concurrency: 5,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30_000, // 30s, 60s, 120s
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    },
  )

  publishWorker.on('completed', (job) => {
    console.log(`[worker] Job ${job.id} completado exitosamente`)
  })

  publishWorker.on('failed', (job, err) => {
    const attemptsLeft = job ? (job.opts.attempts || 3) - job.attemptsMade : 0
    console.error(`[worker] Job ${job?.id} falló (intentos restantes: ${attemptsLeft}):`, err.message)
  })

  // ============== Cola de mantenimiento (refresh tokens) ==============
  const maintenanceQueue = new Queue('maintenance', { connection })

  const maintenanceWorker = new Worker(
    'maintenance',
    async (job) => {
      switch (job.name) {
        case 'refresh-tokens':
          return await refreshExpiringTokens()
        default:
          console.warn(`[worker] Job de mantenimiento desconocido: ${job.name}`)
      }
    },
    { connection, concurrency: 1 },
  )

  // Programar refresh de tokens cada hora
  await maintenanceQueue.upsertJobScheduler(
    'refresh-tokens-hourly',
    { every: 60 * 60 * 1000 }, // cada hora
    { name: 'refresh-tokens' },
  )

  maintenanceWorker.on('completed', (job) => {
    console.log(`[maintenance] Job ${job.id} completado`)
  })

  maintenanceWorker.on('failed', (job, err) => {
    console.error(`[maintenance] Job ${job?.id} falló:`, err.message)
  })

  console.log('Worker de publicación iniciado (conectado a Redis)')
  console.log('  - Cola "publish": concurrency=5, retry=3 con backoff exponencial')
  console.log('  - Cola "maintenance": refresh tokens cada 1h')
}

export {}
