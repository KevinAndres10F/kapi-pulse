'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Character {
  id: string
  name: string
  description?: string
  personality?: string
  visual_style?: string
  eleven_labs_voice_id?: string
  is_default: boolean
  reference_image_urls?: string[]
}

interface CharacterSelectorProps {
  orgId: string
  accessToken?: string
  onSelect?: (characterId: string) => void
}

export function CharacterSelector({ orgId, accessToken, onSelect }: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || !accessToken) return
    const fetchCharacters = async () => {
      try {
        const headers: Record<string, string> = {}
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

        const response = await fetch(`${API_URL}/studio/branded/characters?orgId=${orgId}`, { headers })
        const data = await response.json()
        setCharacters(data.characters || [])

        // Select default character
        const defaultChar = data.characters?.find((c: Character) => c.is_default)
        if (defaultChar) {
          setSelectedCharacter(defaultChar)
          onSelect?.(defaultChar.id)
        }
      } catch (error) {
        console.error('Failed to fetch characters:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCharacters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, orgId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Character</CardTitle>
        <CardDescription>Choose a character for your content</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedCharacter?.id || ''} onValueChange={(id) => {
          const char = characters.find(c => c.id === id)
          if (char) {
            setSelectedCharacter(char)
            onSelect?.(char.id)
          }
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Select a character" />
          </SelectTrigger>
          <SelectContent>
            {characters.map((char) => (
              <SelectItem key={char.id} value={char.id}>
                {char.name}
                {char.is_default && ' (Default)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedCharacter && (
          <div className="space-y-3 rounded-lg bg-slate-50 p-4">
            <div>
              <h3 className="font-semibold">{selectedCharacter.name}</h3>
              {selectedCharacter.is_default && <Badge variant="secondary">Default</Badge>}
            </div>

            {selectedCharacter.description && (
              <div>
                <p className="text-sm text-slate-600">{selectedCharacter.description}</p>
              </div>
            )}

            {selectedCharacter.personality && (
              <div>
                <p className="text-xs font-medium text-slate-500">Personality</p>
                <p className="text-sm text-slate-600">{selectedCharacter.personality}</p>
              </div>
            )}

            {selectedCharacter.visual_style && (
              <div>
                <p className="text-xs font-medium text-slate-500">Visual Style</p>
                <p className="text-sm text-slate-600">{selectedCharacter.visual_style}</p>
              </div>
            )}

            {selectedCharacter.eleven_labs_voice_id && (
              <div>
                <Badge variant="outline">🎙️ Voice Ready</Badge>
              </div>
            )}

            {selectedCharacter.reference_image_urls && selectedCharacter.reference_image_urls.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {selectedCharacter.reference_image_urls.length} Reference Images
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
