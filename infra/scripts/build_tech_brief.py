"""Genera presentación KAPI Pulse — 3 láminas A4 landscape."""
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm

OUT = "/home/user/kapi-pulse/docs/KAPI_Pulse_Tech_Brief.pdf"

NAVY  = HexColor("#0F172A")
BLUE  = HexColor("#2563EB")
GRAY  = HexColor("#475569")
LIGHT = HexColor("#F1F5F9")
GREEN = HexColor("#059669")
AMBER = HexColor("#D97706")
PURPLE = HexColor("#7C3AED")
TEAL = HexColor("#0891B2")

W, H = landscape(A4)


def _wrap(c, text, x, y, max_w, lh=11):
    font_name = c._fontname
    font_size = c._fontsize
    words = text.split()
    line = ""
    cy = y
    for w in words:
        trial = (line + " " + w).strip()
        if c.stringWidth(trial, font_name, font_size) <= max_w:
            line = trial
        else:
            c.drawString(x, cy, line)
            line = w
            cy -= lh
    if line:
        c.drawString(x, cy, line)


def draw_header(c, page_num, title, subtitle):
    c.setFillColor(NAVY)
    c.rect(0, H - 70, W, 70, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(2.2 * cm, H - 38, "KAPI Pulse")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#94A3B8"))
    c.drawString(2.2 * cm, H - 55, "Plataforma SaaS de gestión de redes sociales — Brief técnico")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(white)
    c.drawRightString(W - 2.2 * cm, H - 38, f"Lámina {page_num}/3")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#94A3B8"))
    c.drawRightString(W - 2.2 * cm, H - 55, "Mayo 2026")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(2.2 * cm, H - 105, title)
    if subtitle:
        c.setFillColor(GRAY)
        c.setFont("Helvetica-Oblique", 11)
        c.drawString(2.2 * cm, H - 125, subtitle)


def draw_footer(c):
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.setLineWidth(0.5)
    c.line(2.2 * cm, 1.5 * cm, W - 2.2 * cm, 1.5 * cm)
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 8)
    c.drawString(2.2 * cm, 1 * cm,
                 "KAPI Service Group  ·  Stack production-ready  ·  github.com/KevinAndres10F/kapi-pulse")


def bullet(c, x, y, text, size=10):
    c.setFillColor(BLUE)
    c.circle(x, y + 3, 1.5, fill=1, stroke=0)
    c.setFillColor(GRAY)
    c.setFont("Helvetica", size)
    c.drawString(x + 0.4 * cm, y, text)


def section_title(c, x, y, label):
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x, y, label)
    c.setStrokeColor(BLUE)
    c.setLineWidth(2)
    c.line(x, y - 4, x + 1.5 * cm, y - 4)


def card(c, x, y, w, h, fill=LIGHT, border=None):
    if border:
        c.setStrokeColor(border)
        c.setLineWidth(1.2)
    else:
        c.setStrokeColor(LIGHT)
        c.setLineWidth(0.5)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, 6, fill=1, stroke=1)


# =========================== PAGINA 1 ============================
c = canvas.Canvas(OUT, pagesize=landscape(A4))
draw_header(c, 1, "Qué se construyó",
            "De repositorio vacío a producto multi-tenant en producción")

arch_x, arch_y = 2.2 * cm, 7.2 * cm
arch_w, arch_h = W - 4.4 * cm, 7.5 * cm
card(c, arch_x, arch_y, arch_w, arch_h, fill=white, border=HexColor("#E2E8F0"))

c.setFillColor(NAVY)
c.setFont("Helvetica-Bold", 12)
c.drawString(arch_x + 0.5 * cm, arch_y + arch_h - 0.7 * cm, "Arquitectura desplegada")

boxes = [
    ("Usuario / Browser",                2.7 * cm,  11.0 * cm, 4.5 * cm, NAVY,   "Cualquier navegador"),
    ("Next.js 16  ·  Web",               7.7 * cm,  11.0 * cm, 5.5 * cm, BLUE,   "Netlify  ·  TLS auto  ·  CDN edge"),
    ("Hono API + BullMQ Worker",        13.7 * cm,  11.0 * cm, 7.2 * cm, GREEN,  "Hetzner CX22  ·  Coolify  ·  Docker"),
    ("Supabase  ·  Postgres + Auth + RLS", 2.7 * cm,  8.0 * cm, 9.0 * cm, AMBER,  "Schema dedicado kapi_pulse  ·  Multi-tenant"),
    ("Upstash Redis  ·  Cola BullMQ",   12.2 * cm,  8.0 * cm, 6.0 * cm, PURPLE, "Free tier 10k cmds/día"),
    ("api.kapisg.com  ·  TLS",          18.7 * cm,  8.0 * cm, 5.5 * cm, TEAL,   "Auto-deploy git push"),
]
for label, bx, by, bw, fill_c, sub in boxes:
    c.setFillColor(fill_c)
    c.roundRect(bx, by, bw, 1.6 * cm, 4, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(bx + 0.3 * cm, by + 1.05 * cm, label)
    c.setFont("Helvetica", 7.5)
    c.drawString(bx + 0.3 * cm, by + 0.4 * cm, sub)

section_title(c, 2.2 * cm, 6 * cm, "Capacidades funcionando hoy")

cols = [
    [
        "Auth multi-tenant: signup/login con email + RLS por organización",
        "9 migraciones SQL: tablas, RLS, triggers y funciones RPC",
        "OAuth conectores: Meta (FB + IG + Threads) y LinkedIn",
    ],
    [
        "Scheduler de posts con BullMQ (3 intentos, backoff exponencial)",
        "Refresh automático de tokens cada hora (Meta 60d, LinkedIn 365d)",
        "Tokens encriptados en DB con AES-256-GCM",
    ],
]
y = 5 * cm
for i, col in enumerate(cols):
    cx = 2.5 * cm + i * 12 * cm
    cy = y
    for text in col:
        bullet(c, cx, cy, text, size=9.5)
        cy -= 0.7 * cm

draw_footer(c)
c.showPage()


# =========================== PAGINA 2 ============================
draw_header(c, 2, "Por qué este stack",
            "Cada elección con su trade-off explícito vs. la alternativa común")

table_x = 2.2 * cm
table_y = 2.5 * cm
table_w = W - 4.4 * cm
row_h = 1.7 * cm
header_h = 0.9 * cm

rows = [
    ("Capa", "Elegimos", "Alternativa común", "Por qué la nuestra"),
    ("Base de datos + Auth",
     "Supabase (Postgres real)",
     "Firebase / DynamoDB",
     "SQL real con joins  ·  RLS nativa para multi-tenant  ·  Auth y Storage incluidos  ·  sin lock-in (es Postgres)"),
    ("Hosting frontend",
     "Netlify (free)",
     "Vercel (~$20/usuario/mes Pro)",
     "Igual de bueno para Next.js  ·  TLS y CDN automáticos  ·  branch deploys gratis"),
    ("Hosting backend (API + workers)",
     "Hetzner CX22 + Coolify",
     "Railway / Render / Fly.io",
     "€4.59/mes vs $20-40/mes a escala  ·  control total  ·  workers persistentes sin trucos"),
    ("Cola de jobs",
     "Upstash Redis (free)",
     "AWS SQS / RabbitMQ",
     "10k cmds/día gratis  ·  BullMQ es estándar Node  ·  serverless, sin operación"),
    ("Aislamiento de datos",
     "Schema kapi_pulse",
     "Proyecto Supabase aparte (~$25/mes)",
     "Cero costo extra  ·  convive con otros productos KAPI  ·  migración trivial si crecemos"),
]

col_widths = [3.5 * cm, 4.6 * cm, 4.6 * cm, table_w - 12.7 * cm]
col_offsets = [0]
for w_ in col_widths[:-1]:
    col_offsets.append(col_offsets[-1] + w_)

# Header
c.setFillColor(NAVY)
c.rect(table_x, table_y + 5 * row_h, table_w, header_h, fill=1, stroke=0)
c.setFillColor(white)
c.setFont("Helvetica-Bold", 10)
for j, header in enumerate(rows[0]):
    c.drawString(table_x + col_offsets[j] + 0.3 * cm,
                 table_y + 5 * row_h + 0.32 * cm, header)

# Filas
for i, row in enumerate(rows[1:]):
    ry = table_y + (4 - i) * row_h
    fill = white if i % 2 == 0 else LIGHT
    c.setFillColor(fill)
    c.rect(table_x, ry, table_w, row_h, fill=1, stroke=0)

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    _wrap(c, row[0], table_x + col_offsets[0] + 0.3 * cm,
          ry + row_h - 0.45 * cm, col_widths[0] - 0.4 * cm, lh=11)

    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 9)
    _wrap(c, row[1], table_x + col_offsets[1] + 0.3 * cm,
          ry + row_h - 0.45 * cm, col_widths[1] - 0.4 * cm, lh=11)

    c.setFillColor(GRAY)
    c.setFont("Helvetica", 9)
    _wrap(c, row[2], table_x + col_offsets[2] + 0.3 * cm,
          ry + row_h - 0.45 * cm, col_widths[2] - 0.4 * cm, lh=11)

    c.setFillColor(NAVY)
    c.setFont("Helvetica", 8.5)
    _wrap(c, row[3], table_x + col_offsets[3] + 0.3 * cm,
          ry + row_h - 0.45 * cm, col_widths[3] - 0.4 * cm, lh=10.5)

c.setStrokeColor(HexColor("#CBD5E1"))
c.setLineWidth(0.5)
c.rect(table_x, table_y, table_w, 5 * row_h + header_h, stroke=1, fill=0)

draw_footer(c)
c.showPage()


# =========================== PAGINA 3 ============================
draw_header(c, 3, "Ventajas y próximos pasos",
            "Costo bajo, control alto, sin lock-in y un roadmap claro")

col_w = (W - 4.4 * cm - 2 * 0.5 * cm) / 3
col_h = 7 * cm
top_y = H - 6 * cm

advantages = [
    ("Económico", GREEN, [
        "Hetzner CX22: €4.59/mes",
        "Dominio kapisg.com: $7/año",
        "Supabase, Netlify, Upstash: free tier",
        "Total infraestructura: ~€5/mes",
        "Margen 10× antes de cambiar de tier",
    ]),
    ("Sin vendor lock-in", BLUE, [
        "Postgres puro (migrable a cualquier hosting)",
        "Docker estándar (corre en AWS/GCP/Azure)",
        "Auth vía JWT (intercambiable Auth0/Clerk)",
        "Open source en todas las capas críticas",
        "Si Supabase sube precios → self-host posible",
    ]),
    ("Listo para escalar", AMBER, [
        "Vertical: CX22 (4GB) → CX42 (16GB) en 1 click",
        "Horizontal: Coolify orquesta múltiples réplicas",
        "RLS nativa: multi-tenant en DB, no en app",
        "Workers BullMQ: scaling lineal por queue",
        "Auto-deploy git push (CI/CD ya configurado)",
    ]),
]

for i, (title, color, items) in enumerate(advantages):
    cx = 2.2 * cm + i * (col_w + 0.5 * cm)
    cy = top_y - col_h
    card(c, cx, cy, col_w, col_h, fill=white, border=color)
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(cx + 0.5 * cm, cy + col_h - 0.8 * cm, title)
    c.setStrokeColor(color)
    c.setLineWidth(2)
    c.line(cx + 0.5 * cm, cy + col_h - 1.0 * cm,
           cx + 2.0 * cm, cy + col_h - 1.0 * cm)
    iy = cy + col_h - 1.7 * cm
    for item in items:
        bullet(c, cx + 0.5 * cm, iy, item, size=9)
        iy -= 0.85 * cm

rm_y = 1.9 * cm
section_title(c, 2.2 * cm, rm_y + 4 * cm, "Próximos pasos sugeridos")

steps = [
    ("Fase 4a", "IA editorial con Claude — generar copy por red, sugerir hashtags, mejor hora", BLUE),
    ("Fase 4b", "TikTok, X, YouTube y WhatsApp Cloud API (faltan los conectores OAuth)", GREEN),
    ("Fase 4c", "Analítica — ingesta de métricas FB/IG/LinkedIn → dashboard real", AMBER),
    ("Fase 4d", "Bot Telegram + alertas (publicación fallida, token expirado, mejor hora)", PURPLE),
]
sy = rm_y + 3.2 * cm
for label, desc, color in steps:
    c.setFillColor(color)
    c.roundRect(2.2 * cm, sy - 0.2 * cm, 1.7 * cm, 0.55 * cm, 4, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(2.2 * cm + 0.85 * cm, sy - 0.05 * cm, label)
    c.setFillColor(NAVY)
    c.setFont("Helvetica", 9.5)
    c.drawString(4.2 * cm, sy - 0.05 * cm, desc)
    sy -= 0.75 * cm

draw_footer(c)
c.showPage()
c.save()
print(f"PDF generado: {OUT}")
