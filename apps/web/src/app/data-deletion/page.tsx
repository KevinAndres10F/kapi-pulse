export const metadata = {
  title: 'Eliminación de datos — KAPI Pulse',
}

import { LegalShell } from '@/components/legal/legal-shell'

export default function DataDeletionPage() {
  return (
    <LegalShell>
      <h1 className="text-3xl font-bold text-foreground">Eliminación de tus datos</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        KAPI Pulse — operado por KAPI Service Group (Ecuador)
      </p>

      <section className="mt-8 space-y-4 leading-relaxed">
        <p>
          En KAPI Pulse respetamos tu derecho a eliminar tus datos personales y
          los de las cuentas de redes sociales que hayas conectado a la
          plataforma. Esta página explica cómo solicitar esa eliminación.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-foreground">
          ¿Qué datos almacenamos?
        </h2>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Tu correo electrónico y nombre (para autenticación).</li>
          <li>
            Los tokens OAuth de las redes sociales que conectaste (encriptados
            con AES-256-GCM en nuestra base de datos).
          </li>
          <li>
            El contenido de los posts que creaste y programaste desde la
            plataforma.
          </li>
          <li>
            Metadatos básicos de las cuentas conectadas (nombre de la página /
            perfil, foto, ID público).
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-foreground">
          Cómo solicitar la eliminación
        </h2>
        <p>
          Tenés dos opciones para que eliminemos completamente tus datos:
        </p>

        <h3 className="mt-4 font-semibold text-foreground">
          Opción 1 — Desde la plataforma (autoservicio)
        </h3>
        <ol className="list-decimal pl-6 space-y-1.5">
          <li>
            Iniciá sesión en{' '}
            <a
              href="https://kapi-pulse.netlify.app"
              className="text-primary underline"
            >
              kapi-pulse.netlify.app
            </a>
            .
          </li>
          <li>Andá a <strong>Conexiones</strong> y desconectá las cuentas que quieras.</li>
          <li>
            Andá a <strong>Configuración → Eliminar cuenta</strong> y confirmá.
            Tu cuenta y todos los datos asociados se borran de inmediato.
          </li>
        </ol>

        <h3 className="mt-4 font-semibold text-foreground">
          Opción 2 — Por correo electrónico
        </h3>
        <p>
          Escribinos a <strong>privacidad@kapisg.com</strong> con el asunto
          &ldquo;Eliminación de datos KAPI Pulse&rdquo; e incluí:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>El correo con el que te registraste.</li>
          <li>Las redes sociales que tenías conectadas (si lo recordás).</li>
        </ul>
        <p>
          Procesamos la solicitud en un máximo de <strong>14 días hábiles</strong>{' '}
          y te enviamos confirmación por correo cuando esté completa.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-foreground">
          Qué pasa con los datos en las redes sociales
        </h2>
        <p>
          Eliminar tu cuenta en KAPI Pulse <strong>no borra</strong> los posts que ya
          publicaste en Facebook, Instagram, LinkedIn u otras redes — esos viven
          en sus respectivas plataformas. Para borrarlos, hacelo directamente en
          cada red social.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-foreground">Contacto</h2>
        <p>
          Si tenés dudas, contactanos a{' '}
          <a href="mailto:privacidad@kapisg.com" className="text-primary underline">
            privacidad@kapisg.com
          </a>
          .
        </p>

        <p className="mt-12 text-sm text-muted-foreground">
          Última actualización: 14 de mayo de 2026
        </p>
      </section>
    </LegalShell>
  )
}
