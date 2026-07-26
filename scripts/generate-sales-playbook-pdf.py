"""Generate the public NexID Sales Playbook from the verified architecture contract."""

from __future__ import annotations

from pathlib import Path
from shutil import copyfile

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps" / "dashboard" / "public" / "nexid_sales_playbook.pdf"
MIRRORS = (
    ROOT / "apps" / "web" / "public" / "nexid_sales_playbook.pdf",
    ROOT / "docs" / "nexid_sales_playbook.pdf",
)
VERSION = "2026-07-26"

NAVY = colors.HexColor("#07111F")
SLATE = colors.HexColor("#172033")
MUTED = colors.HexColor("#526078")
CYAN = colors.HexColor("#06B6D4")
PURPLE = colors.HexColor("#7C3AED")
GREEN = colors.HexColor("#059669")
AMBER = colors.HexColor("#D97706")
PALE = colors.HexColor("#F3F7FB")
LINE = colors.HexColor("#D8E2EC")
WHITE = colors.white


def build_styles():
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=29,
            leading=34,
            textColor=WHITE,
            alignment=TA_LEFT,
            spaceAfter=7 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=12,
            leading=18,
            textColor=colors.HexColor("#D5E7F2"),
            spaceAfter=6 * mm,
        ),
        "cover_table_label": ParagraphStyle(
            "CoverTableLabel",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=WHITE,
        ),
        "cover_table_value": ParagraphStyle(
            "CoverTableValue",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#D5E7F2"),
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=26,
            textColor=NAVY,
            spaceAfter=5 * mm,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=SLATE,
            spaceBefore=3 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=14,
            textColor=SLATE,
            spaceAfter=3 * mm,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.7,
            leading=11,
            textColor=MUTED,
        ),
        "eyebrow": ParagraphStyle(
            "Eyebrow",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=CYAN,
            uppercase=True,
            spaceAfter=2 * mm,
        ),
        "card_title": ParagraphStyle(
            "CardTitle",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=NAVY,
            spaceAfter=1.5 * mm,
        ),
        "card_body": ParagraphStyle(
            "CardBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11.5,
            textColor=MUTED,
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.5,
            textColor=WHITE,
            alignment=TA_LEFT,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=10,
            textColor=SLATE,
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=12,
            textColor=SLATE,
            leftIndent=4 * mm,
            rightIndent=4 * mm,
            borderColor=CYAN,
            borderWidth=1,
            borderPadding=4 * mm,
            backColor=colors.HexColor("#ECFEFF"),
            spaceBefore=2 * mm,
            spaceAfter=4 * mm,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=MUTED,
        ),
        "center": ParagraphStyle(
            "Center",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=NAVY,
        ),
    }


STYLES = build_styles()


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, STYLES[style])


def card(title: str, body: str, accent=CYAN):
    table = Table(
        [[p(title, "card_title"), p(body, "card_body")]],
        colWidths=[43 * mm, 112 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return table


def faq(question: str, answer: str, proof: str):
    return KeepTogether(
        [
            p(question, "h2"),
            p(answer, "body"),
            Spacer(1, 2 * mm),
            p(f"<b>Cómo sostenerlo:</b> {proof}", "callout"),
            Spacer(1, 2 * mm),
        ]
    )


def page_chrome(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 15 * mm, width, 15 * mm, stroke=0, fill=1)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(WHITE)
    canvas.drawString(18 * mm, height - 9.5 * mm, "nexID | Sales Playbook verificable")
    canvas.setFont("Helvetica", 7)
    version_text = f"Versión {VERSION}"
    canvas.drawRightString(width - 18 * mm, height - 9.5 * mm, version_text)

    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 8.5 * mm, "Uso comercial interno. Validar alcance, red, SLA, packaging y costos en cada propuesta.")
    page_label = f"{doc.page}"
    canvas.drawRightString(width - 18 * mm, 8.5 * mm, page_label)
    canvas.restoreState()


def cover_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    canvas.setFillColor(PURPLE)
    canvas.circle(width - 8 * mm, height - 18 * mm, 63 * mm, stroke=0, fill=1)
    canvas.setFillColor(CYAN)
    canvas.circle(width - 28 * mm, 28 * mm, 42 * mm, stroke=0, fill=1)
    canvas.restoreState()


def build_story():
    story = [
        Spacer(1, 42 * mm),
        p("SALES PLAYBOOK | ARQUITECTURA ACTUAL", "eyebrow"),
        p("Vender confianza<br/>sin vender humo", "cover_title"),
        p(
            "Objeciones, arquitectura, packaging y demo comercial de nexID. Este documento separa capacidad operativa, piloto blockchain y fallback de IA para que cada promesa pueda demostrarse.",
            "cover_subtitle",
        ),
        Spacer(1, 12 * mm),
        Table(
            [
                [p("Runtime", "cover_table_label"), p("Vercel", "cover_table_value")],
                [p("Datos", "cover_table_label"), p("Neon PostgreSQL", "cover_table_value")],
                [p("NFC", "cover_table_label"), p("SUN/CMAC server-side", "cover_table_value")],
                [p("Blockchain piloto", "cover_table_label"), p("Google Cloud KMS SOFTWARE envelope", "cover_table_value")],
            ],
            colWidths=[45 * mm, 70 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.Color(1, 1, 1, alpha=0.10)),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.Color(1, 1, 1, alpha=0.25)),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.Color(1, 1, 1, alpha=0.15)),
                    ("TEXTCOLOR", (0, 0), (-1, -1), WHITE),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                ]
            ),
        ),
        PageBreak(),
        p("01 | POSICIONAMIENTO", "eyebrow"),
        p("Qué puede vender nexID hoy", "h1"),
        p(
            "nexID asocia identidades NFC/QR a productos mediante el proceso de packaging del cliente y valida evidencia digital del tag con operación por tenant, SDK/webhooks y experiencias post-tap. Blockchain y asistencia de copy son capas opcionales con procedencia y límites visibles.",
            "body",
        ),
        card(
            "Runtime y datos",
            "APIs y funciones en Vercel. PostgreSQL administrado en Neon con alcance lógico por tenant. No se presenta infraestructura de otros proveedores como despliegue actual.",
            CYAN,
        ),
        Spacer(1, 3 * mm),
        card(
            "Custodia NFC / SUN",
            "K_META y K_FILE de lote se guardan cifradas en Neon. KMS_MASTER_KEY_HEX permanece como variable del backend en Vercel y permite descifrar server-side para validar SUN/CMAC. Es cifrado de aplicación tipo envelope.",
            GREEN,
        ),
        Spacer(1, 3 * mm),
        card(
            "Custodia blockchain piloto",
            "Polygon e IOTA usan wallets separadas del flujo NFC. Google Cloud KMS con nivel SOFTWARE envuelve el material en modo kms_wrapped; el executor lo descifra de forma efímera para firmar. No se vende como firma directa no exportable.",
            PURPLE,
        ),
        Spacer(1, 3 * mm),
        card(
            "Asistencia de copy",
            "La interfaz declara proveedor y modelo sólo tras una respuesta confirmada. Falta de token, cuota o respuesta útil activa un fallback determinístico identificado como tal.",
            AMBER,
        ),
        Spacer(1, 5 * mm),
        p(
            "<b>Regla comercial:</b> no todo tap se escribe en blockchain. La frecuencia, red, gas, modelo de custodia y SLA se acuerdan por tenant y por evento de negocio.",
            "callout",
        ),
        PageBreak(),
        p("02 | NFC, QR Y PACKAGING", "eyebrow"),
        p("Comparar controles, no promesas absolutas", "h1"),
    ]

    comparison = [
        [p("Dimensión", "table_head"), p("QR tradicional", "table_head"), p("nexID NFC / NTAG 424", "table_head")],
        [p("Copia visual", "table_cell"), p("El contenido impreso puede copiarse.", "table_cell"), p("Una foto no genera una nueva firma SUN del chip.", "table_cell")],
        [p("Interacción", "table_cell"), p("Cámara y encuadre.", "table_cell"), p("Tap sin app en móviles compatibles; la latencia se mide en piloto.", "table_cell")],
        [p("Apertura", "table_cell"), p("No informa estado físico por sí solo.", "table_cell"), p("Disponible con tag TT y construcción tamper validada.", "table_cell")],
        [p("Ubicación", "table_cell"), p("Depende de permiso del usuario e IP aproximada.", "table_cell"), p("Mismas señales declaradas más evidencia criptográfica del chip.", "table_cell")],
        [p("Valor", "table_cell"), p("Depende de diseño y contenido.", "table_cell"), p("Punto de contacto físico interactivo, medible por caso.", "table_cell")],
    ]
    comparison_table = Table(comparison, colWidths=[34 * mm, 58 * mm, 70 * mm], repeatRows=1)
    comparison_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    story.extend(
        [
            comparison_table,
            Spacer(1, 6 * mm),
            p("Wet inlay, dry inlay y línea industrial", "h2"),
            p(
                "Para aplicación directa suele convenir wet inlay en rollo. Un dry inlay necesita conversión o laminado antes de entrar a la etiquetadora. La decisión depende de adhesivo, liner, material, separación, core, sentido de bobinado y equipo real.",
                "body",
            ),
            Spacer(1, 2 * mm),
            p(
                "Antes de volumen: aprobar radio de curvatura, metal o líquido cercano, posición de antena, lectura, construcción tamper, velocidad y rechazo de línea. El costo unitario se cotiza con ese diseño; no existe un porcentaje universal.",
                "callout",
            ),
            PageBreak(),
            p("03 | OBJECIONES OPERATIVAS", "eyebrow"),
            p("Respuestas que un equipo técnico puede respaldar", "h1"),
            faq(
                "¿NFC reemplaza el código regulatorio?",
                "No necesariamente. El código regulatorio sigue vigente cuando corresponde. Cuando el carrier lo permite, nexID valida un mensaje SUN dinámico server-side y agrega trazabilidad declarada y reglas post-tap.",
                "Mostrar un tap físico y una copia visual. Explicar qué valida cada canal y qué no valida.",
            ),
            faq(
                "¿Cómo ayuda en semillas y agroquímicos?",
                "Asocia el lote declarado por la marca con la identidad NFC/QR aplicada durante el proceso de packaging y permite consultar canal, documentación y eventos autorizados. Esa asociación operativa no certifica por sí sola contenido u origen físico ni reemplaza la etiqueta legal o la recomendación agronómica.",
                "Usar datos del lote piloto y diferenciar campos declarados, verificados y opcionales.",
            ),
            faq(
                "¿Cómo ayuda con refill o apertura?",
                "Una construcción compatible con tag TT puede cambiar de estado al abrir el cierre. El backend registra ese estado para reglas de advertencia y revisión, siempre que la integración física haya sido validada.",
                "Enseñar una muestra TT real; si la muestra no fue abierta físicamente, declarar modo demo.",
            ),
            faq(
                "¿Sirve para accesos VIP?",
                "Una pulsera o credencial NFC puede exigir tap fresco y decisión server-side. Latencia, conectividad, antifraude y modo offline se validan en el recinto antes de producción.",
                "Cronometrar el piloto y documentar comportamiento con red degradada.",
            ),
            PageBreak(),
            p("04 | BLOCKCHAIN, CUSTODIA E IA", "eyebrow"),
            p("Separar capas reduce costo y riesgo", "h1"),
            faq(
                "¿Por qué Vercel + Neon y blockchain opcional?",
                "La operación cotidiana necesita baja fricción, aislamiento por tenant y consultas eficientes. Polygon se reserva para claims o certificados autorizados; IOTA para anclar hashes de integridad o eventos declarados de supply chain. Ninguna red procesa cada tap por defecto.",
                "Definir en la propuesta qué evento ancla, frecuencia, red, gas, RPC, retención y responsable.",
            ),
            faq(
                "¿Cómo se protegen las claves NFC?",
                "K_META y K_FILE se cifran antes de persistir en Neon. KMS_MASTER_KEY_HEX queda sólo en el entorno backend de Vercel y se usa server-side para SUN/CMAC. El proveedor de fábrica nunca recibe esa clave maestra ni acceso a la base.",
                "Mostrar el diagrama de flujo, redacciones de export pack y pruebas de no exposición; nunca mostrar secretos.",
            ),
            faq(
                "¿Cómo se protegen las wallets del piloto?",
                "Polygon e IOTA usan identidades separadas y Google Cloud KMS SOFTWARE envelope en modo kms_wrapped. El executor solicita descifrado y mantiene el material sólo durante la firma. Es una frontera distinta de NFC.",
                "Mostrar signer mode, key ID redacted, red testnet, hash, receipt y verificación RPC.",
            ),
            faq(
                "¿Cuándo es realmente live la asistencia de copy?",
                "Sólo cuando la respuesta confirma proveedor y modelo. Sin token, cuota o respuesta útil, el producto muestra fallback determinístico; una configuración lista no se presenta como ejecución live.",
                "Señalar el badge de procedencia en el dashboard antes de enseñar el resultado.",
            ),
            PageBreak(),
            p("05 | MODELO COMERCIAL Y DEMO", "eyebrow"),
            p("Un piloto que produce evidencia comprable", "h1"),
            p("Modelo comercial", "h2"),
            p(
                "El modelo combina suministro y programación de tags con suscripción por workspace, usuarios, operación, SDK/webhooks y módulos opcionales. Los límites, costos variables y SLA se cotizan por tenant. La asistencia de copy es una herramienta; no es el fundamento del moat.",
                "body",
            ),
            card(
                "1. Mostrar el límite visual",
                "Usar un QR de muestra para explicar que una foto conserva el mismo contenido. Aclarar que esto no demuestra fraude por sí solo.",
                AMBER,
            ),
            Spacer(1, 3 * mm),
            card(
                "2. Ejecutar un tap físico",
                "Usar una muestra NTAG 424 configurada. El portal debe indicar tap fresco o modo demo. Una captura no genera una nueva firma SUN.",
                CYAN,
            ),
            Spacer(1, 3 * mm),
            card(
                "3. Mostrar evidencia y fuente",
                "En CRM, enseñar fuente y estado del evento. Si son datos demo, mantener la etiqueta visible. Mostrar Polygon o IOTA sólo con evidencia de red verificada.",
                PURPLE,
            ),
            Spacer(1, 6 * mm),
            p("Checklist antes de prometer", "h2"),
            p(
                "- Packaging y lectura aprobados en muestra real.<br/>- Tenant, roles y retención definidos.<br/>- Eventos on-chain, red, gas y custodia acordados.<br/>- SLA y conectividad medidos, no estimados.<br/>- IA y datos demo con procedencia visible.<br/>- Claims regulatorios revisados por el cliente.",
                "body",
            ),
            Spacer(1, 2 * mm),
            p(
                "<b>Frase de cierre:</b> nexID no vende una blockchain por cada lectura. Vende una identidad NFC verificable, una operación por tenant y evidencia externa sólo cuando aporta valor al negocio.",
                "callout",
            ),
        ]
    )
    return story


def generate():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        title="nexID Sales Playbook verificable",
        author="nexID",
        subject="Arquitectura, objeciones y demo comercial",
        creator="nexID reproducible PDF generator",
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
        id="normal",
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[frame], onPage=cover_page, autoNextPageTemplate="content"),
            PageTemplate(id="content", frames=[frame], onPage=page_chrome),
        ]
    )
    doc.build(build_story())
    for mirror in MIRRORS:
        mirror.parent.mkdir(parents=True, exist_ok=True)
        copyfile(OUTPUT, mirror)
    return OUTPUT


if __name__ == "__main__":
    result = generate()
    size_kb = result.stat().st_size / 1024
    print(f"Generated {result} and {len(MIRRORS)} identical mirrors ({size_kb:.1f} KiB each)")
