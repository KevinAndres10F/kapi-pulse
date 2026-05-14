import 'dotenv/config'

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  console.warn('REDIS_URL no configurado — worker en modo standby')
  console.log('Worker de publicacion iniciado (standby — sin Redis)')
} else {
  const { Queue, Worker } = await import('bullmq')
  const IORedis = (await import('ioredis')).default

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })

  const publishQueue = new Queue('publish', { connection })

  const publishWorker = new Worker(
    'publish',
    async (job) => {
      console.log(`Procesando job ${job.id}: ${job.name}`, job.data)
    },
    { connection, concurrency: 5 },
  )

  publishWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completado`)
  })

  publishWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} fallo:`, err.message)
  })

  console.log('Worker de publicacion iniciado (conectado a Redis)')
}

export {}
