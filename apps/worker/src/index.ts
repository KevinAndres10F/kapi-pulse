import 'dotenv/config'
import { refreshExpiringTokens } from './jobs/refresh-tokens.js'
import { publishPost } from './jobs/publish-post.js'
import { syncAllMetrics } from './jobs/metrics-sync.js'
import { generateImageJob } from './jobs/generation/generate-image.js'
import { generateVideoJob } from './jobs/generation/generate-video.js'
import { generateAvatarJob } from './jobs/generation/generate-avatar.js'
import { generateCopyJob } from './jobs/generation/generate-copy.js'
import { packageCampaignJob } from './jobs/generation/package-campaign.js'
import { refundIfNotRefunded } from './jobs/generation/lib.js'

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  console.warn('REDIS_URL no configurado — worker en modo standby')
  console.log('Worker de publicacion iniciado (standby — sin Redis)')
} else {
  const { Queue, Worker } = await import('bullmq')
  const IORedis = (await import('ioredis')).default

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })

  // ============== Cola de publicación ==============
  const publishQueue = new Queue('publish', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 30_000,
      },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  })

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
    },
  )

  publishWorker.on('completed', (job) => {
    console.log(`[worker] Job ${job.id} completado exitosamente`)
  })

  publishWorker.on('failed', (job, err) => {
    const attemptsLeft = job ? (job.opts.attempts || 3) - job.attemptsMade : 0
    console.error(`[worker] Job ${job?.id} falló (intentos restantes: ${attemptsLeft}):`, err.message)
  })

  // ============== Cola de generación visual (Studio) ==============
  const generationQueue = new Queue('generation', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  })

  const generationWorker = new Worker(
    'generation',
    async (job) => {
      console.log(`[generation] Procesando ${job.id}: ${job.name}`)
      switch (job.name) {
        case 'generate-image':
          return await generateImageJob(job.data)
        case 'generate-video':
          return await generateVideoJob(job.data)
        case 'generate-avatar':
          return await generateAvatarJob(job.data)
        case 'generate-copy':
          return await generateCopyJob(job.data)
        case 'package-campaign':
          return await packageCampaignJob(job.data)
        default:
          console.warn(`[generation] Job desconocido: ${job.name}`)
      }
    },
    {
      connection,
      concurrency: 10,
    },
  )

  generationWorker.on('completed', (job) => {
    console.log(`[generation] Job ${job.id} completado`)
  })

  generationWorker.on('failed', async (job, err) => {
    const attempts = job?.opts.attempts || 1
    const attemptsLeft = job ? attempts - job.attemptsMade : 0
    console.error(`[generation] Job ${job?.id} falló (intentos restantes: ${attemptsLeft}):`, err.message)
    // On final attempt failure, refund credits automatically
    if (job && attemptsLeft <= 0 && job.data?.jobId) {
      await refundIfNotRefunded(job.data.jobId).catch((e) => {
        console.error(`[generation] refund failed:`, e)
      })
    }
  })

  // ============== Cola de mantenimiento (refresh tokens) ==============
  const maintenanceQueue = new Queue('maintenance', { connection })

  const maintenanceWorker = new Worker(
    'maintenance',
    async (job) => {
      switch (job.name) {
        case 'refresh-tokens':
          return await refreshExpiringTokens()
        case 'metrics-sync':
          return await syncAllMetrics()
        default:
          console.warn(`[worker] Job de mantenimiento desconocido: ${job.name}`)
      }
    },
    { connection, concurrency: 1 },
  )

  await maintenanceQueue.upsertJobScheduler(
    'refresh-tokens-hourly',
    { every: 60 * 60 * 1000 },
    { name: 'refresh-tokens' },
  )

  await maintenanceQueue.upsertJobScheduler(
    'metrics-sync-6h',
    { every: 6 * 60 * 60 * 1000 },
    { name: 'metrics-sync' },
  )

  maintenanceWorker.on('completed', (job) => {
    console.log(`[maintenance] Job ${job.id} completado`)
  })

  maintenanceWorker.on('failed', (job, err) => {
    console.error(`[maintenance] Job ${job?.id} falló:`, err.message)
  })

  console.log('Worker iniciado (conectado a Redis)')
  console.log('  - Cola "publish": concurrency=5, retry=3 con backoff exponencial')
  console.log('  - Cola "generation": concurrency=10, retry=2 con refund automático')
  console.log('  - Cola "maintenance": refresh tokens 1h, metrics-sync 6h')
}

export {}
