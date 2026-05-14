import { z } from 'zod'

export const MemberRole = z.enum(['owner', 'admin', 'editor', 'viewer'])
export type MemberRole = z.infer<typeof MemberRole>

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  timezone: z.string().default('America/Guayaquil'),
  locale: z.string().default('es-EC'),
})
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>
