export const metadata = {
  title: 'Política de Privacidad — KAPI Pulse',
}

import { LegalShell } from '@/components/legal/legal-shell'

export default function PrivacyPage() {
  return (
    <LegalShell>
      <h1 className="text-3xl font-bold text-foreground">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        KAPI Pulse — operado por KAPI Service Group (Ecuador) · Vigente desde 14 de mayo de 2026
      </p>

      <section className="mt-8 space-y-6 leading-relaxed">
        <p>
          Esta política describe cómo KAPI Pulse recolecta, usa y protege tu
          información cuando usás la plataforma para gestionar tus redes
          sociales.
        </p>

        <h2 className="text-xl font-semibold text-foreground">Datos que recolectamos</h2>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong>Cuenta de usuario</strong>: nombre, correo electrónico, foto
            de perfil opcional.
          </li>
          <li>
            <strong>Datos de redes sociales conectadas</strong>: tokens OAuth
            (encriptados), nombre / ID público de la cuenta, foto de perfil,
            métricas básicas de tus propios posts.
          </li>
          <li>
            <strong>Contenido</strong>: los posts que creás, programás y publicás
            desde la plataforma.
          </li>
          <li>
            <strong>Datos técnicos</strong>: dirección IP, navegador, logs de
            acceso (para seguridad).
          </li>
        </ul>

        <h2 className="text-xl font-semibold text-foreground">Cómo usamos tus datos</h2>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Para autenticarte y mantener tu sesión.</li>
          <li>Para publicar contenido en tu nombre en las redes sociales que conectaste.</li>
          <li>Para mostrarte analíticas de tus propios posts.</li>
          <li>Para mejorar la plataforma (estadísticas agregadas, no datos individuales).</li>
        </ul>

        <h2 className="text-xl font-semibold text-foreground">Cómo NO usamos tus datos</h2>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>No vendemos ni alquilamos tus datos a terceros.</li>
          <li>No publicamos contenido sin tu autorización explícita.</li>
          <li>No accedemos a mensajes privados de tus redes sociales.</li>
          <li>No usamos tus datos para entrenar modelos de IA.</li>
        </ul>

        <h2 className="text-xl font-semibold text-foreground">Seguridad</h2>
        <p>
          Los tokens OAuth se almacenan encriptados con AES-256-GCM. Los datos
          viajan siempre por HTTPS. Cumplimos los requisitos de la LOPDP
          (Ley Orgánica de Protección de Datos Personales del Ecuador).
        </p>

        <h2 className="text-xl font-semibold text-foreground">Tus derechos</h2>
        <p>Podés en cualquier momento:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Acceder a una copia de tus datos.</li>
          <li>Corregir datos incorrectos.</li>
          <li>
            Solicitar la eliminación completa de tu cuenta y todos los datos —
            ver{' '}
            <a href="/data-deletion" className="text-primary underline">
              Eliminación de datos
            </a>
            .
          </li>
          <li>Desconectar redes sociales individualmente desde la plataforma.</li>
        </ul>

        <h2 className="text-xl font-semibold text-foreground">Compartición con terceros</h2>
        <p>
          Compartimos datos solo con los servicios estrictamente necesarios para
          operar la plataforma:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>Supabase</strong> (base de datos y autenticación).</li>
          <li><strong>Anthropic Claude</strong> (generación de contenido por IA, solo cuando vos lo pedís).</li>
          <li><strong>Hetzner Cloud</strong> (hosting del backend).</li>
          <li><strong>Netlify</strong> (hosting del frontend).</li>
          <li>
            <strong>Las redes sociales que conectes</strong> (Meta, LinkedIn,
            etc.) — para publicar tu contenido.
          </li>
        </ul>

        <h2 className="text-xl font-semibold text-foreground">Cookies</h2>
        <p>
          Usamos cookies estrictamente necesarias para mantener tu sesión. No
          usamos cookies de tracking publicitario.
        </p>

        <h2 className="text-xl font-semibold text-foreground">Cambios a esta política</h2>
        <p>
          Si actualizamos esta política, te notificaremos por correo y dentro de
          la plataforma. Si no estás de acuerdo, podés eliminar tu cuenta.
        </p>

        <h2 className="text-xl font-semibold text-foreground">Contacto</h2>
        <p>
          Para cualquier consulta sobre privacidad:{' '}
          <a href="mailto:privacidad@kapisg.com" className="text-primary underline">
            privacidad@kapisg.com
          </a>
        </p>
      </section>
    </LegalShell>
  )
}
