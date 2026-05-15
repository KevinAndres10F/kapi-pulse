export const metadata = {
  title: 'Términos de Servicio — KAPI Pulse',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold text-gray-900">Términos de Servicio</h1>
      <p className="mt-2 text-sm text-gray-500">
        KAPI Pulse — operado por KAPI Service Group (Ecuador) · Vigente desde 14 de mayo de 2026
      </p>

      <section className="mt-8 space-y-6 leading-relaxed">
        <h2 className="text-xl font-semibold text-gray-900">1. Aceptación</h2>
        <p>
          Al usar KAPI Pulse aceptás estos términos. Si no estás de acuerdo, no
          uses el servicio.
        </p>

        <h2 className="text-xl font-semibold text-gray-900">2. Descripción del servicio</h2>
        <p>
          KAPI Pulse es una plataforma SaaS que te permite gestionar, programar
          y publicar contenido en redes sociales (Facebook, Instagram,
          LinkedIn, entre otras) desde una sola interfaz.
        </p>

        <h2 className="text-xl font-semibold text-gray-900">3. Tu cuenta</h2>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Sos responsable de mantener segura tu contraseña.</li>
          <li>Sos responsable de todo el contenido que publicás.</li>
          <li>Debés tener al menos 18 años o autorización de un tutor.</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900">4. Uso aceptable</h2>
        <p>No podés usar KAPI Pulse para:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Spam, phishing, o contenido fraudulento.</li>
          <li>Contenido ilegal, que incite al odio o a la violencia.</li>
          <li>Contenido que infrinja derechos de autor de terceros.</li>
          <li>Automatizar acciones que violen los términos de las redes sociales.</li>
          <li>Suplantar a otra persona u organización.</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900">5. Cuentas conectadas</h2>
        <p>
          Cuando conectás una red social, KAPI Pulse obtiene un token OAuth con
          los permisos mínimos necesarios. Vos sos el dueño exclusivo de las
          cuentas conectadas y podés desconectarlas en cualquier momento.
        </p>

        <h2 className="text-xl font-semibold text-gray-900">6. IA y contenido generado</h2>
        <p>
          La función de generación de contenido con IA (Claude) produce
          sugerencias que vos siempre podés editar antes de publicar. Sos
          responsable del contenido final que publicás, no la IA.
        </p>

        <h2 className="text-xl font-semibold text-gray-900">7. Disponibilidad y suspensión</h2>
        <p>
          Hacemos esfuerzos razonables para mantener el servicio disponible
          24/7, pero no garantizamos disponibilidad ininterrumpida. Podemos
          suspender cuentas que violen estos términos.
        </p>

        <h2 className="text-xl font-semibold text-gray-900">8. Limitación de responsabilidad</h2>
        <p>
          KAPI Pulse no es responsable por:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Cambios en las APIs de las redes sociales que afecten funcionalidad.</li>
          <li>Pérdidas indirectas o lucro cesante.</li>
          <li>Decisiones de moderación que tomen las redes sociales sobre tu contenido.</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900">9. Datos personales</h2>
        <p>
          El tratamiento de tus datos se rige por nuestra{' '}
          <a href="/privacy" className="text-blue-600 underline">
            Política de Privacidad
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold text-gray-900">10. Cambios a los términos</h2>
        <p>
          Si actualizamos estos términos, te notificaremos por correo. El uso
          continuado tras la notificación implica aceptación.
        </p>

        <h2 className="text-xl font-semibold text-gray-900">11. Jurisdicción</h2>
        <p>
          Estos términos se rigen por las leyes de la República del Ecuador.
          Cualquier controversia se resuelve en los tribunales de Quito.
        </p>

        <h2 className="text-xl font-semibold text-gray-900">12. Contacto</h2>
        <p>
          <a href="mailto:legal@kapisg.com" className="text-blue-600 underline">
            legal@kapisg.com
          </a>
        </p>
      </section>
    </main>
  )
}
