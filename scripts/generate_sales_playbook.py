import os
from fpdf import FPDF

class NexidPlaybookPdf(FPDF):
    def __init__(self):
        super().__init__(orientation="portrait", unit="mm", format="A4")
        self.set_margin(0)
        self.set_auto_page_break(False)

    def draw_page_base(self, title):
        self.add_page()
        
        # Slate-950 Dark Background
        self.set_fill_color(2, 6, 23)
        self.rect(0, 0, 210, 297, "F")
        
        # Top Purple Accent Line
        self.set_fill_color(168, 85, 247)
        self.rect(0, 0, 210, 3, "F")
        
        # Footer
        self.set_xy(15, 282)
        self.set_font("helvetica", "I", 7.5)
        self.set_text_color(71, 85, 105) # slate-600
        self.cell(100, 5, "nexID Sales Playbook · Material Comercial Confidencial", ln=0)
        
        self.set_xy(110, 282)
        self.cell(85, 5, f"Pág. {self.page_no()} de 3 · nexID Suite 2026", ln=0, align="R")

        # Header Title
        self.set_xy(15, 12)
        self.set_font("helvetica", "B", 16)
        self.set_text_color(255, 255, 255)
        self.cell(0, 8, title, ln=1)
        
        self.set_xy(15, 20)
        self.set_font("helvetica", "B", 7)
        self.set_text_color(168, 85, 247)
        self.cell(0, 4, "MANUAL DE MANEJO DE OBJECIONES Y COMPARATIVAS TÉCNICAS", ln=1)

    def draw_card(self, x, y, w, h, border_color=(255, 255, 255, 0.1), fill_color=(15, 23, 42)):
        self.set_line_width(0.3)
        self.set_draw_color(border_color[0], border_color[1], border_color[2])
        self.set_fill_color(fill_color[0], fill_color[1], fill_color[2])
        self.rect(x, y, w, h, "FD")

def build_playbook_pdf():
    pdf = NexidPlaybookPdf()
    
    # ----------------------------------------------------
    # PAGE 1: Intro & NFC vs QR Table
    # ----------------------------------------------------
    pdf.draw_page_base("nexID: Playbook de Ventas & FAQs")
    
    # Intro Card
    pdf.draw_card(15, 30, 180, 26, border_color=(168, 85, 247, 0.2), fill_color=(20, 18, 48))
    pdf.set_xy(19, 34)
    pdf.set_font("helvetica", "B", 9.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(100, 5, "Propósito de esta Guía de Ventas:", ln=1)
    pdf.set_xy(19, 40)
    pdf.set_font("helvetica", "", 8.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(172, 4.5, "Este documento provee las herramientas argumentativas y comparaciones técnicas necesarias para afrontar reuniones comerciales con enólogos, gerentes de operaciones e inversores del sector vitivinícola premium.", border=0)

    # Table Title
    pdf.set_xy(15, 64)
    pdf.set_font("helvetica", "B", 12)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 6, "1. Comparativa Técnica: nexID NFC vs. Código QR", ln=1)
    
    # Table Header Row
    tx, ty = 15, 74
    tw_feat, tw_qr, tw_nfc = 52, 60, 68
    pdf.draw_card(tx, ty, tw_feat + tw_qr + tw_nfc, 8, border_color=(255, 255, 255, 0.15), fill_color=(15, 23, 42))
    
    pdf.set_xy(tx + 3, ty + 1.5)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(tw_feat - 3, 5, "Característica", ln=0)
    
    pdf.cell(tw_qr, 5, "Código QR Tradicional", ln=0)
    
    pdf.set_text_color(6, 182, 212)
    pdf.cell(tw_nfc, 5, "nexID NFC (NTAG 424 DNA)", ln=1)

    # Table Data Rows
    rows = [
        ("Copiabilidad / Fraude", "Crítica (Cualquiera le saca foto y lo copia)", "Imposible (Firma única SUN de un solo uso)"),
        ("Experiencia de Usuario", "Lenta (Abrir cámara, enfocar, click)", "Instantánea (Apoyar móvil - 0.5s nativo)"),
        ("Sello de Apertura", "Inexistente (El QR no sabe si fue abierto)", "Física (Circuito TagTamper en cápsula)"),
        ("Ubicación Antifraude", "Fácil de engañar (Solo IP de red)", "Validación satelital activa en vivo (GPS/IP)"),
        ("Percepción de Lujo", "Baja (Carta de bar, menú barato)", "Premium (Igual a tarjeta de crédito Gold)")
    ]

    for idx, row in enumerate(rows):
        r_y = ty + 8 + (idx * 13)
        pdf.draw_card(tx, r_y, tw_feat + tw_qr + tw_nfc, 13, border_color=(255, 255, 255, 0.05), fill_color=(2, 6, 23) if idx % 2 == 0 else (15, 23, 42))
        
        pdf.set_xy(tx + 3, r_y + 4)
        pdf.set_font("helvetica", "B", 8)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(tw_feat - 3, 5, row[0], ln=0)
        
        pdf.set_font("helvetica", "", 7.5)
        pdf.set_text_color(244, 63, 94) if "Crítica" in row[1] else pdf.set_text_color(156, 163, 175)
        pdf.cell(tw_qr, 5, row[1], ln=0)
        
        pdf.set_font("helvetica", "B" if "Imposible" in row[2] or "Física" in row[2] else "", 7.5)
        pdf.set_text_color(16, 185, 129) if "Imposible" in row[2] or "Física" in row[2] else pdf.set_text_color(6, 182, 212)
        pdf.cell(tw_nfc - 3, 5, row[2], ln=1)

    # Live objection speech bubble box
    pdf.draw_card(tx, 148, tw_feat + tw_qr + tw_nfc, 34, border_color=(6, 182, 212, 0.25), fill_color=(10, 24, 40))
    pdf.set_xy(tx + 4, 151)
    pdf.set_font("helvetica", "B", 8.5)
    pdf.set_text_color(6, 182, 212)
    pdf.cell(100, 4, "DISCURSO COMERCIAL EN REUNIÓN:", ln=1)
    pdf.set_xy(tx + 4, 156)
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(172, 4.2, '"Mire, un QR es una fotocopia que cualquiera puede duplicar en diez mil botellas falsas. Con nexID, insertamos un microchip criptográfico: cada toque genera evidencia SUN única en nexID, y solo los claims de ownership o auditoría que aportan valor se anclan en Polygon/IOTA sin publicar datos sensibles. Su QR es publicidad; nuestro chip es procedencia, control y seguridad operacional."', border=0)

    # ----------------------------------------------------
    # ----------------------------------------------------
    # PAGE 2: Multi-Market Objections (Part 1)
    # ----------------------------------------------------
    pdf.draw_page_base("2. Objeciones por Sector Comercial")
    
    # Subtitle Bodegas & Cosmética
    pdf.set_xy(15, 28)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(251, 191, 36) # Amber
    pdf.cell(100, 5, "A. BODEGAS Y COSMÉTICA DE LUJO (COSTOS Y OPERACIONES)", ln=1)
    
    # QA 1
    y_qa = 35
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 4, "¿Esto me va a encarecer mucho el costo por botella o empaque premium?", ln=1)
    pdf.set_xy(15, y_qa + 4.5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(180, 4, "Representa centavos de dólar por unidad (<1.5% en gama alta). Además, la línea estándar opera sobre backend seguro nexID sin transacciones on-chain obligatorias para cada tap. Polygon/IOTA se activan por política enterprise cuando hay ownership, auditoría, DPP o mercado secundario que justifiquen gas, RPC y custodia.", border=0)

    # QA 2
    y_qa = 56
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 4, "¿Me va a ralentizar la línea de envasado o empaque industrial?", ln=1)
    pdf.set_xy(15, y_qa + 4.5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(180, 4, "No. Los chips se entregan en rollos autoadhesivos estándar (inlays) que se aplican automáticamente debajo de la etiqueta o el cierre sin detener la maquinaria ni perder velocidad de producción.", border=0)

    # QA 3
    y_qa = 77
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 4, "En cosmética, ¿cómo evito que rellenen envases de perfumes o cremas?", ln=1)
    pdf.set_xy(15, y_qa + 4.5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(180, 4, "nexID integra sensores TagTamper en el cierre. Al abrir la tapa o atomizador, el filamento del chip se rompe físicamente. El sistema registra permanentemente en el servidor SQL la apertura del envase original.", border=0)

    # Divider Line
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(15, 102, 180, 0.4, "F")

    # Subtitle Pharma & Agro
    pdf.set_xy(15, 108)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(16, 185, 129) # Green
    pdf.cell(100, 5, "B. FARMACÉUTICA Y AGROPECUARIO (TRAZABILIDAD Y MERCADO NEGRO)", ln=1)

    # QA 4
    y_qa = 115
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 4, "¿Qué ventaja tiene sobre el código de barras que exige la regulación farmacéutica?", ln=1)
    pdf.set_xy(15, y_qa + 4.5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(180, 4, "El código de barras es estático y fácilmente clonable por fotocopiadoras en cajas falsificadas. El microchip nexID genera firmas criptográficas dinámicas validadas contra la nube de Render/AWS en tiempo real.", border=0)

    # QA 5
    y_qa = 136
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 4, "En el agro, ¿qué valor aporta un chip en bolsas de semillas o bidones agroquímicos?", ln=1)
    pdf.set_xy(15, y_qa + 4.5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(180, 4, "El mercado negro de semillas adulteradas y agroquímicos diluidos genera pérdidas millonarias. El chip nexID certifica el origen del criadero o laboratorio oficial directamente en el campo mediante un tap con el celular.", border=0)

    # ----------------------------------------------------
    # PAGE 3: Events, Investors & Live Demo Flow
    # ----------------------------------------------------
    pdf.draw_page_base("3. Eventos, Inversores & Demo en Vivo")
    
    # Subtitle Events & Investors
    pdf.set_xy(15, 28)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(6, 182, 212) # Cyan
    pdf.cell(100, 5, "C. EVENTOS VIP Y TECNOLOGÍA HÍBRIDA", ln=1)

    # QA 6
    y_qa = 35
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 4, "Los códigos QR de las entradas se revenden y duplican. ¿Cómo lo soluciona nexID?", ln=1)
    pdf.set_xy(15, y_qa + 4.5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(180, 4, "Reemplazamos el QR digital por pulseras o credenciales VIP físicas inteligentes con chip NFC. Cada acceso requiere un tap físico imposible de duplicar que valida la firma digital en milisegundos en Render.", border=0)

    # QA 7
    y_qa = 56
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 4, "¿Por qué ofrecer solución híbrida (SQL + Blockchain Opcional) en el SaaS?", ln=1)
    pdf.set_xy(15, y_qa + 4.5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(180, 4, "Porque elimina barreras: onboarding inmediato con base SQL segura en AWS/Render por defecto. Si el cliente lanza una línea premium y desea inmutabilidad on-chain (Polygon), activa la capa Web3 como un add-on.", border=0)

    # QA 8
    y_qa = 77
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 4, "¿Cómo se garantiza la seguridad de la base SQL si es centralizada?", ln=1)
    pdf.set_xy(15, y_qa + 4.5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(180, 4, "Las firmas dinámicas SUN se validan con claves maestras encriptadas en KMS. Incluso si un hacker vulnera el servidor SQL centralizado, no puede generar firmas dinámicas falsas de chips físicos sin las claves maestras.", border=0)

    # Divider Line
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(15, 102, 180, 0.4, "F")

    # Subtitle Demo Flow
    pdf.set_xy(15, 108)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(168, 85, 247) # Purple
    pdf.cell(100, 5, "D. EL \"AS BAJO LA MANGA\": TU DEMO EN VIVO EN 3 PASOS", ln=1)

    # Step 1
    y_qa = 115
    pdf.set_fill_color(168, 85, 247)
    pdf.rect(15, y_qa, 5, 5, "F")
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 7.5)
    pdf.set_text_color(2, 6, 23)
    pdf.cell(5, 5, "1", ln=0, align="C")
    
    pdf.set_xy(23, y_qa)
    pdf.set_font("helvetica", "B", 8.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(150, 5, "Hackear el QR común en frente de ellos", ln=1)
    
    pdf.set_xy(23, y_qa + 5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(172, 4, "Lleva una botella o empaque común con un QR. Escanealo, sácale una foto y haz que escaneen la foto. Explícales: 'Miren qué fácil es duplicar su marca en un segundo. Cualquiera puede hacerlo'.", border=0)

    # Step 2
    y_qa = 138
    pdf.set_fill_color(6, 182, 212)
    pdf.rect(15, y_qa, 5, 5, "F")
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 7.5)
    pdf.set_text_color(2, 6, 23)
    pdf.cell(5, 5, "2", ln=0, align="C")
    
    pdf.set_xy(23, y_qa)
    pdf.set_font("helvetica", "B", 8.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(150, 5, "El Tap Criptográfico nexID", ln=1)
    
    pdf.set_xy(23, y_qa + 5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(172, 4, "Haz que apoyen su celular en tu empaque con chip nexID. Se abrirá de inmediato su Portal VIP. Explícales que el chip generó una firma cifrada dinámica de un solo uso imposible de fotocopiar o clonar.", border=0)

    # Step 3
    y_qa = 161
    pdf.set_fill_color(16, 185, 129)
    pdf.rect(15, y_qa, 5, 5, "F")
    pdf.set_xy(15, y_qa)
    pdf.set_font("helvetica", "B", 7.5)
    pdf.set_text_color(2, 6, 23)
    pdf.cell(5, 5, "3", ln=0, align="C")
    
    pdf.set_xy(23, y_qa)
    pdf.set_font("helvetica", "B", 8.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(150, 5, "Cerrar la venta con el CRM en vivo", ln=1)
    
    pdf.set_xy(23, y_qa + 5)
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(172, 4, "Abre tu notebook con el CRM de nexID. Muéstrales cómo el tap que acaban de hacer apareció en el mapa operativo de Render en tiempo real, validando la firma criptográfica y la procedencia.", border=0)

    # Output file
    base_path = "c:/Users/guill/OneDrive/Documentos/GitHub/NFC-Tokenizacion"
    
    # 1. Output to docs/
    output_dir = os.path.join(base_path, "docs")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    output_pdf_path = os.path.join(output_dir, "nexid_sales_playbook.pdf")
    pdf.output(output_pdf_path)
    print(f"SUCCESS: Playbook PDF successfully generated at {output_pdf_path}")
    
    # 2. Output to apps/dashboard/public/
    dashboard_public = os.path.join(base_path, "apps/dashboard/public")
    if os.path.exists(dashboard_public):
        dashboard_pdf = os.path.join(dashboard_public, "nexid_sales_playbook.pdf")
        pdf.output(dashboard_pdf)
        print(f"SUCCESS: Playbook PDF successfully copied to {dashboard_pdf}")
        
    # 3. Output to apps/web/public/
    web_public = os.path.join(base_path, "apps/web/public")
    if os.path.exists(web_public):
        web_pdf = os.path.join(web_public, "nexid_sales_playbook.pdf")
        pdf.output(web_pdf)
        print(f"SUCCESS: Playbook PDF successfully copied to {web_pdf}")

if __name__ == "__main__":
    build_playbook_pdf()
