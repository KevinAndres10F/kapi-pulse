/**
 * Tipos del schema `kapi_pulse` para uso con supabase-js.
 *
 * Mantener en sync con las migraciones en infra/supabase/migrations/.
 * Si cambias el esquema, actualiza este archivo a mano (el generador automático
 * solo extrae el schema `public`, que aquí pertenece a otro producto).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type SocialProvider =
  | 'facebook' | 'instagram' | 'threads' | 'whatsapp'
  | 'tiktok' | 'linkedin' | 'x' | 'youtube' | 'pinterest'
export type AccountStatus = 'active' | 'expired' | 'disconnected' | 'error'
export type PostStatus =
  | 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'

export interface Database {
  kapi_pulse: {
    Tables: {
      organizations: {
        Row: {
          id: string
          slug: string
          name: string
          logo_url: string | null
          timezone: string
          locale: string
          plan_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          slug: string
          name: string
          logo_url?: string | null
          timezone?: string
          locale?: string
          plan_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['kapi_pulse']['Tables']['organizations']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          preferred_locale: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_locale?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['kapi_pulse']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      organization_members: {
        Row: {
          organization_id: string
          user_id: string
          role: MemberRole
          joined_at: string | null
        }
        Insert: {
          organization_id: string
          user_id: string
          role?: MemberRole
          joined_at?: string | null
        }
        Update: Partial<Database['kapi_pulse']['Tables']['organization_members']['Insert']>
        Relationships: []
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: MemberRole
          token: string
          expires_at: string
          accepted_at: string | null
          invited_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          role?: MemberRole
          token?: string
          expires_at?: string
          accepted_at?: string | null
          invited_by?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['kapi_pulse']['Tables']['invitations']['Insert']>
        Relationships: []
      }
      social_accounts: {
        Row: {
          id: string
          organization_id: string
          provider: SocialProvider
          external_id: string
          display_name: string | null
          avatar_url: string | null
          access_token_encrypted: string
          refresh_token_encrypted: string | null
          expires_at: string | null
          scopes: string[] | null
          status: AccountStatus
          metadata: Json
          connected_by: string | null
          connected_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          provider: SocialProvider
          external_id: string
          display_name?: string | null
          avatar_url?: string | null
          access_token_encrypted: string
          refresh_token_encrypted?: string | null
          expires_at?: string | null
          scopes?: string[] | null
          status?: AccountStatus
          metadata?: Json
          connected_by?: string | null
          connected_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['kapi_pulse']['Tables']['social_accounts']['Insert']>
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          organization_id: string
          created_by: string | null
          title: string | null
          internal_notes: string | null
          status: PostStatus
          scheduled_at: string | null
          published_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          created_by?: string | null
          title?: string | null
          internal_notes?: string | null
          status?: PostStatus
          scheduled_at?: string | null
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['kapi_pulse']['Tables']['posts']['Insert']>
        Relationships: []
      }
      post_variants: {
        Row: {
          id: string
          post_id: string
          social_account_id: string
          content: string | null
          hashtags: string[] | null
          link_url: string | null
          external_post_id: string | null
          status: PostStatus
          error_message: string | null
          published_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          post_id: string
          social_account_id: string
          content?: string | null
          hashtags?: string[] | null
          link_url?: string | null
          external_post_id?: string | null
          status?: PostStatus
          error_message?: string | null
          published_at?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['kapi_pulse']['Tables']['post_variants']['Insert']>
        Relationships: []
      }
      post_media: {
        Row: {
          id: string
          post_variant_id: string
          position: number
          media_type: string
          storage_path: string
          external_media_id: string | null
          width: number | null
          height: number | null
          duration_seconds: number | null
          alt_text: string | null
        }
        Insert: {
          id?: string
          post_variant_id: string
          position?: number
          media_type: string
          storage_path: string
          external_media_id?: string | null
          width?: number | null
          height?: number | null
          duration_seconds?: number | null
          alt_text?: string | null
        }
        Update: Partial<Database['kapi_pulse']['Tables']['post_media']['Insert']>
        Relationships: []
      }
      post_metrics: {
        Row: {
          id: string
          post_variant_id: string
          period_start: string
          collected_at: string
          impressions: number | null
          reach: number | null
          likes: number | null
          comments: number | null
          shares: number | null
          saves: number | null
          clicks: number | null
          video_views: number | null
          engagement_rate: number | null
          raw: Json
        }
        Insert: {
          id?: string
          post_variant_id: string
          period_start: string
          collected_at?: string
          impressions?: number | null
          reach?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          clicks?: number | null
          video_views?: number | null
          engagement_rate?: number | null
          raw?: Json
        }
        Update: Partial<Database['kapi_pulse']['Tables']['post_metrics']['Insert']>
        Relationships: []
      }
      account_metrics: {
        Row: {
          id: string
          social_account_id: string
          period_start: string
          collected_at: string
          followers: number | null
          following: number | null
          posts_count: number | null
          impressions: number | null
          reach: number | null
          profile_views: number | null
          raw: Json
        }
        Insert: {
          id?: string
          social_account_id: string
          period_start: string
          collected_at?: string
          followers?: number | null
          following?: number | null
          posts_count?: number | null
          impressions?: number | null
          reach?: number | null
          profile_views?: number | null
          raw?: Json
        }
        Update: Partial<Database['kapi_pulse']['Tables']['account_metrics']['Insert']>
        Relationships: []
      }
    }
    Views: {
      post_metrics_latest: {
        Row: {
          post_variant_id: string
          period_start: string
          collected_at: string
          impressions: number | null
          reach: number | null
          likes: number | null
          comments: number | null
          shares: number | null
          saves: number | null
          clicks: number | null
          video_views: number | null
          engagement_rate: number | null
        }
      }
      account_metrics_latest: {
        Row: {
          social_account_id: string
          period_start: string
          collected_at: string
          followers: number | null
          following: number | null
          posts_count: number | null
          impressions: number | null
          reach: number | null
          profile_views: number | null
        }
      }
    }
    Functions: {
      is_member_of: { Args: { org_id: string }; Returns: boolean }
      has_write_access: { Args: { org_id: string }; Returns: boolean }
      is_admin_of: { Args: { org_id: string }; Returns: boolean }
    }
    Enums: {
      member_role: MemberRole
      social_provider: SocialProvider
      account_status: AccountStatus
      post_status: PostStatus
    }
    CompositeTypes: Record<string, never>
  }
}
