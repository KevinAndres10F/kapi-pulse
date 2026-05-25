import { Bell, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <Bell className="size-6 text-primary" />
          Alertas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Notificaciones inteligentes por Telegram para que no se te escape nada.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-6 text-primary" />
          </span>
          <div>
            <p className="text-base font-medium text-foreground">Próximamente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Configurá tu bot de Telegram para recibir alertas de aprobaciones, lanzamientos y posts fallidos.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
