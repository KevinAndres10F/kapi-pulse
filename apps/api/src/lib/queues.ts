import type { Queue } from 'bullmq'

let _publishQueue: Queue | null = null
let _generationQueue: Queue | null = null
let _maintenanceQueue: Queue | null = null

async function createQueue(name: string): Promise<Queue | null> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null
  try {
    const { Queue: BullQueue } = await import('bullmq')
    const IORedis = (await import('ioredis')).default
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })
    return new BullQueue(name, { connection })
  } catch (err) {
    console.warn(`[queues] No se pudo conectar a Redis para cola ${name}:`, err)
    return null
  }
}

export async function getPublishQueue(): Promise<Queue | null> {
  if (_publishQueue) return _publishQueue
  _publishQueue = await createQueue('publish')
  return _publishQueue
}

export async function getGenerationQueue(): Promise<Queue | null> {
  if (_generationQueue) return _generationQueue
  _generationQueue = await createQueue('generation')
  return _generationQueue
}

export async function getMaintenanceQueue(): Promise<Queue | null> {
  if (_maintenanceQueue) return _maintenanceQueue
  _maintenanceQueue = await createQueue('maintenance')
  return _maintenanceQueue
}
