import { z } from 'zod'

export const PostStatus = z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'])
export type PostStatus = z.infer<typeof PostStatus>

export const SocialProvider = z.enum([
  'facebook', 'instagram', 'threads', 'whatsapp',
  'tiktok', 'linkedin', 'x', 'youtube', 'pinterest',
])
export type SocialProvider = z.infer<typeof SocialProvider>

export const CreatePostSchema = z.object({
  title: z.string().max(200).optional(),
  internalNotes: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
  variants: z.array(z.object({
    socialAccountId: z.string().uuid(),
    content: z.string().max(5000),
    hashtags: z.array(z.string()).optional(),
    linkUrl: z.string().url().optional(),
  })).min(1),
})
export type CreatePost = z.infer<typeof CreatePostSchema>
