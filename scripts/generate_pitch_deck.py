import os
from fpdf import FPDF

class NexidPitchDeck(FPDF):
    def __init__(self):
        super().__init__(orientation="landscape", unit="mm", format="A4")
        self.set_margin(0)
        self.set_auto_page_break(False)

    def draw_slide_base(self, title, tagline):
        self.add_page()
        
        # 1. Dark Background fill
        self.set_fill_color(2, 6, 23) # slate-950 (#020617)
        self.rect(0, 0, 297, 210, "F")
        
        # 2. Top Accent Line (nexID Purple)
        self.set_fill_color(168, 85, 247) # purple-500 (#a855f7)
        self.rect(0, 0, 297, 3, "F")
        
        # 3. Footer Branding
        self.set_xy(15, 198)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(71, 85, 105) # slate-600
        self.cell(100, 5, "nexID Inc. · Material de Inversión Reservado", ln=0)
        
        self.set_xy(182, 198)
        self.cell(100, 5, f"Pág. {self.page_no()} de 8 · nexID Cognitive AI Suite 2026", ln=0, align="R")

        # 4. Slide Title & Tagline
        self.set_xy(15, 12)
        self.set_font("helvetica", "B", 20)
        self.set_text_color(255, 255, 255) # white
        self.cell(0, 10, title, ln=1)
        
        self.set_xy(15, 21)
        self.set_font("helvetica", "B", 7.5)
        self.set_text_color(168, 85, 247) # purple-400
        self.cell(0, 5, tagline.upper(), ln=1)

    def draw_card(self, x, y, w, h, border_color=(255, 255, 255, 0.1), fill_color=(15, 23, 42)):
        # fpdf2 rect drawing with fill and outline
        self.set_line_width(0.3)
        self.set_draw_color(border_color[0], border_color[1], border_color[2])
        self.set_fill_color(fill_color[0], fill_color[1], fill_color[2])
        self.rect(x, y, w, h, "FD")

def build_pdf():
    pdf = NexidPitchDeck()
    
    # Path settings for assets
    base_path = "c:/Users/guill/OneDrive/Documentos/GitHub/NFC-Tokenizacion"
    img_magnum = os.path.join(base_path, "apps/web/public/images/premium_magnum.png")
    img_crate = os.path.join(base_path, "apps/web/public/images/wine_crate.png")
    img_tasting = os.path.join(base_path, "apps/web/public/images/wine_tasting.png")

    # Dynamic cropping to prevent image distortion (stretch) in PDF layout
    img_magnum_pdf = img_magnum
    if os.path.exists(img_magnum):
        try:
            from PIL import Image
            img = Image.open(img_magnum)
            w, h = img.size
            target_w = int(h * (26.0 / 73.0)) # ~364 pixels
            left = (w - target_w) // 2
            right = left + target_w
            cropped_path = os.path.join(base_path, "apps/web/public/images/premium_magnum_cropped.png")
            img.crop((left, 0, right, h)).save(cropped_path)
            img_magnum_pdf = cropped_path
            print(f"SUCCESS: Cropped magnum dynamically to 26:73 aspect ratio at {cropped_path}")
        except Exception as e:
            print(f"Error cropping magnum image: {e}")

    img_tasting_pdf = img_tasting
    if os.path.exists(img_tasting):
        try:
            from PIL import Image
            img = Image.open(img_tasting)
            w, h = img.size
            target_w = int(h * (107.0 / 130.0)) # ~842 pixels
            left = (w - target_w) // 2
            right = left + target_w
            cropped_path = os.path.join(base_path, "apps/web/public/images/wine_tasting_cropped.png")
            img.crop((left, 0, right, h)).save(cropped_path)
            img_tasting_pdf = cropped_path
            print(f"SUCCESS: Cropped tasting dynamically to 107:130 aspect ratio at {cropped_path}")
        except Exception as e:
            print(f"Error cropping tasting image: {e}")

    # ----------------------------------------------------
    # SLIDE 1: Cover Page
    # ----------------------------------------------------
    pdf.add_page()
    pdf.set_fill_color(2, 6, 23)
    pdf.rect(0, 0, 297, 210, "F")
    
    # Top Accent Line
    pdf.set_fill_color(168, 85, 247)
    pdf.rect(0, 0, 297, 3.5, "F")

    # Big "N" Branded Logo Icon
    logo_x, logo_y = 15, 20
    pdf.set_fill_color(30, 27, 75) # dark purple/indigo
    pdf.set_draw_color(168, 85, 247)
    pdf.set_line_width(0.5)
    pdf.rect(logo_x, logo_y, 16, 16, "FD")
    
    pdf.set_xy(logo_x, logo_y + 1)
    pdf.set_font("helvetica", "B", 12)
    pdf.set_text_color(6, 182, 212) # cyan
    pdf.cell(16, 14, "N", ln=0, align="C")

    # Brand text
    pdf.set_xy(36, 21)
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(50, 10, "nexID", ln=0)
    
    # Main Header
    pdf.set_xy(15, 60)
    pdf.set_font("helvetica", "B", 28)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(170, 12, "Ecosistema de Autenticidad", ln=1)
    pdf.set_xy(15, 74)
    pdf.cell(170, 12, "Física y Lujo Inteligente", ln=1)
    
    # Subtitle
    pdf.set_xy(15, 92)
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(168, 85, 247)
    pdf.cell(170, 5, "LA REVOLUCIÓN DE LA PROPIEDAD DIGITAL Y FIDELIZACIÓN VIP ON-CHAIN", ln=1)

    # Paragraph text
    pdf.set_xy(15, 105)
    pdf.set_font("helvetica", "", 10.5)
    pdf.set_text_color(156, 163, 175) # grey-400
    pdf.multi_cell(145, 6, "Una plataforma Web3 que conecta botellas de alta gama y productos premium con el mundo digital mediante microchips NFC de última generación. Aseguramos procedencia criptográfica y construimos canales directos de fidelización interactiva entre la marca y el consumidor final.", border=0)

    # Tag Badge
    badge_x, badge_y = 15, 145
    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(6, 182, 212) # cyan
    pdf.set_line_width(0.3)
    pdf.rect(badge_x, badge_y, 48, 8, "FD")
    pdf.set_xy(badge_x, badge_y + 1)
    pdf.set_font("helvetica", "B", 7.5)
    pdf.set_text_color(6, 182, 212)
    pdf.cell(48, 6, "MATERIAL DE INVERSIÓN VIP", ln=0, align="C")

    # Image Showcase
    if os.path.exists(img_tasting_pdf):
        # Draw nice thin border for the image
        img_x, img_y, img_w, img_h = 175, 40, 107, 130
        pdf.set_draw_color(168, 85, 247)
        pdf.set_line_width(0.4)
        pdf.rect(img_x - 1, img_y - 1, img_w + 2, img_h + 2, "D")
        pdf.image(img_tasting_pdf, img_x, img_y, img_w, img_h)

    # Slide 1 Footer
    pdf.set_xy(15, 195)
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(100, 5, "nexID Inc. · info@nexid.lat · nexid.lat", ln=0)
    pdf.set_xy(182, 195)
    pdf.cell(100, 5, "Pág. 1 de 8 · Presentación General de Negocios", ln=0, align="R")

    # ----------------------------------------------------
    # SLIDE 2: The Core Problem
    # ----------------------------------------------------
    pdf.draw_slide_base("El Problema del Mercado de Lujo", "pérdida de control, fraude y desconexión con el cliente")
    
    # 3 Columns Cards
    card_w = 82
    card_h = 125
    y_pos = 50
    
    # Card 1: Falta de Datos
    pdf.draw_card(15, y_pos, card_w, card_h, border_color=(6, 182, 212)) # cyan
    pdf.set_xy(20, y_pos + 10)
    pdf.set_font("helvetica", "B", 13)
    pdf.set_text_color(6, 182, 212)
    pdf.cell(0, 8, "01. Desconexión del Cliente", ln=1)
    pdf.set_xy(20, y_pos + 22)
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(card_w - 10, 5.5, "Una vez que la bodega vende una botella premium en vinotecas, retail o la exporta a Europa o Brasil, pierde el rastro por completo.\n\nNo sabe quién la consume, qué opina, ni puede enviarle una oferta del club directamente, perdiendo el valioso contacto de recompra Direct-to-Consumer.", border=0)

    # Card 2: Falsificación
    pdf.draw_card(107, y_pos, card_w, card_h, border_color=(244, 63, 94)) # rose
    pdf.set_xy(112, y_pos + 10)
    pdf.set_font("helvetica", "B", 13)
    pdf.set_text_color(244, 63, 94)
    pdf.cell(0, 8, "02. Fraude de Falsificación", ln=1)
    pdf.set_xy(112, y_pos + 22)
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(card_w - 10, 5.5, "El mercado internacional de vinos finos falsificados mueve miles de millones de dólares anualmente.\n\nLos códigos QR comunes, números de lote impresos o hologramas tradicionales son fotocopiables o imitables de forma extremadamente sencilla. Esto destruye el prestigio y valor comercial de las cosechas de autor.", border=0)

    # Card 3: Marketing Frío
    pdf.draw_card(199, y_pos, card_w, card_h, border_color=(245, 158, 11)) # amber
    pdf.set_xy(204, y_pos + 10)
    pdf.set_font("helvetica", "B", 13)
    pdf.set_text_color(245, 158, 11)
    pdf.cell(0, 8, "03. Marketing Tradicional Frío", ln=1)
    pdf.set_xy(204, y_pos + 22)
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(card_w - 10, 5.5, "Los folletos impresos y las newsletters masivas por correo tienen tasas de apertura menores al 2%.\n\nLos coleccionistas de lujo exigen experiencias digitales interactivas, personalizadas y de alta fidelidad. Buscan estatus y pertenencia directa, no correos de spam no deseados.", border=0)

    # ----------------------------------------------------
    # SLIDE 3: El Ecosistema nexID
    # ----------------------------------------------------
    pdf.draw_slide_base("El Ecosistema nexID", "integración híbrida de base sql en la nube (aws/render) y capa web3 opcional")
    
    # 4 Steps horizontally
    step_w = 58
    step_h = 60
    y_step = 55
    
    steps = [
        {"num": "Fase 1", "title": "Embotellado Físico", "desc": "Se inserta un microchip NFC criptográfico nexID en el cuello de la botella o empaque."},
        {"num": "Fase 2", "title": "Validación y Tap", "desc": "El comprador toca el empaque con su celular y valida la procedencia al instante."},
        {"num": "Fase 3", "title": "Nube SQL Segura", "desc": "La firma dinámica se verifica contra la base SQL custodiada en Render/AWS."},
        {"num": "Fase 4", "title": "Web3 Opcional", "desc": "Acuñación opcional on-chain (Polygon) para líneas de alta gama o colección."}
    ]
    
    for i, step in enumerate(steps):
        x_pos = 15 + (i * 68)
        pdf.draw_card(x_pos, y_step, step_w, step_h, border_color=(255, 255, 255, 0.08))
        
        pdf.set_xy(x_pos + 5, y_step + 6)
        pdf.set_font("helvetica", "B", 8)
        pdf.set_text_color(168, 85, 247)
        pdf.cell(0, 4, step["num"].upper(), ln=1)
        
        pdf.set_xy(x_pos + 5, y_step + 12)
        pdf.set_font("helvetica", "B", 10.5)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(0, 6, step["title"], ln=1)
        
        pdf.set_xy(x_pos + 5, y_step + 22)
        pdf.set_font("helvetica", "", 8.5)
        pdf.set_text_color(156, 163, 175)
        pdf.multi_cell(step_w - 10, 4.5, step["desc"], border=0)
        
        # Draw Arrow
        if i < 3:
            pdf.set_xy(x_pos + step_w + 2, y_step + 25)
            pdf.set_font("helvetica", "B", 16)
            pdf.set_text_color(168, 85, 247)
            pdf.cell(6, 10, "->", ln=0, align="C")

    # Bottom summary box
    summary_y = 130
    pdf.draw_card(15, summary_y, 267, 45, border_color=(168, 85, 247, 0.25), fill_color=(20, 18, 48))
    
    badge_w = 40
    badge_h = 16
    pdf.set_fill_color(168, 85, 247)
    pdf.rect(25, summary_y + 145 - 130, badge_w, badge_h, "F")
    pdf.set_xy(25, summary_y + 145 - 130 + 1)
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(2, 6, 23)
    pdf.cell(badge_w, 14, "SQL + WEB3 LAYER", ln=0, align="C")
    
    pdf.set_xy(75, summary_y + 8)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 6, "Una arquitectura híbrida que maximiza velocidad, seguridad y compatibilidad:", ln=1)
    
    pdf.set_xy(75, summary_y + 15)
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(195, 5, "Registramos firmas dinámicas en bases de datos SQL redundantes por defecto alojadas en Render/AWS. Activamos la capa de Polygon Blockchain on-chain con un solo clic únicamente para líneas exclusivas o coleccionables de alta gama.", border=0)

    # ----------------------------------------------------
    # SLIDE 4: Pilar A - Cryptographic Security
    # ----------------------------------------------------
    pdf.draw_slide_base("Pilar A: Seguridad Criptográfica", "protección avanzada contra duplicados y monitoreo activo")
    
    # Left Column: Features
    x_left = 15
    y_start = 50
    
    features = [
        {"title": "Firma Criptográfica Dinámica (NFC SUN)", "desc": "Cada toque ('tap') físico del celular genera un token único de un solo uso en el chip. Si alguien copia el chip o clona el circuito, la firma digital se vuelve inválida al instante, evitando falsificaciones."},
        {"title": "Telemetría de Geolocalización Activa", "desc": "El sistema analiza en tiempo real las coordenadas GPS e IPs de los escaneos. Si la misma botella reporta lecturas simultáneas en Buenos Aires y Londres, se genera una alerta inmediata de copia."},
        {"title": "Detección de Apertura de Sello (TagTamper)", "desc": "El microchip cuenta con un filamento que recorre la cápsula del corcho. Al descorchar, el lazo eléctrico se rompe físicamente. El chip informa que la botella ya fue abierta, impidiendo el rellenado."}
    ]
    
    for i, feat in enumerate(features):
        y_pos = y_start + (i * 45)
        
        # Checkmark Icon
        pdf.set_fill_color(15, 118, 110) # dark teal
        pdf.rect(x_left, y_pos, 6, 6, "F")
        pdf.set_xy(x_left, y_pos)
        pdf.set_font("helvetica", "B", 8)
        pdf.set_text_color(45, 212, 191) # emerald
        pdf.cell(6, 6, "v", ln=0, align="C")
        
        # Text
        pdf.set_xy(x_left + 10, y_pos)
        pdf.set_font("helvetica", "B", 11)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(130, 6, feat["title"], ln=1)
        
        pdf.set_xy(x_left + 10, y_pos + 6)
        pdf.set_font("helvetica", "", 9.5)
        pdf.set_text_color(156, 163, 175)
        pdf.multi_cell(130, 4.5, feat["desc"], border=0)

    # Right Column: Terminal Emulator
    x_term = 165
    y_term = 50
    w_term = 117
    h_term = 125
    pdf.draw_card(x_term, y_term, w_term, h_term, border_color=(6, 182, 212), fill_color=(2, 6, 23))
    
    # Terminal Top bar
    pdf.set_fill_color(15, 23, 42)
    pdf.rect(x_term + 0.3, y_term + 0.3, w_term - 0.6, 8, "F")
    
    pdf.set_xy(x_term + 5, y_term + 1)
    pdf.set_font("helvetica", "B", 7.5)
    pdf.set_text_color(6, 182, 212)
    pdf.cell(100, 6, "LEDGER AUDITOR nexID SECURITY v2.8", ln=0)
    
    # Terminal lines
    pdf.set_font("courier", "B", 8.5)
    pdf.set_text_color(16, 185, 129) # green
    
    lines = [
        ("STATUS:", "ONLINE (SECURE_VERDICT)"),
        ("TAG TYPE:", "NTAG 424 DNA (SUN CRYPTO)"),
        ("FINGERPRINT:", "04:A5:8C:12:F3:60:80"),
        ("SUN GENERATOR:", "E01180215F3369A1C"),
        ("DECODE RESULT:", "SUCCESS (SIGNATURE VALID)"),
        ("SEAL STATUS:", "CLOSED (ORIGINAL FACTORY)"),
        ("GPS VERDICT:", "Lat -34.6037 / Lon -58.3816"),
        ("DEVICE HYDRO:", "iOS 18.2 (iPhone 16 Pro Max)"),
        ("BLOCK ANCHOR:", "Polygon Block #189,203"),
        ("TAMPER RISK:", "0% (NO ANOMALIES DETECTED)")
    ]
    
    pdf.set_xy(x_term + 5, y_term + 14)
    pdf.set_font("courier", "B", 9)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 5, ">>> INICIANDO ANÁLISIS DE TAP...", ln=1)
    
    for i, line in enumerate(lines):
        y_l = y_term + 24 + (i * 9)
        pdf.set_xy(x_term + 5, y_l)
        pdf.set_font("courier", "", 8.5)
        pdf.set_text_color(156, 163, 175)
        pdf.cell(38, 5, line[0], ln=0)
        
        pdf.set_font("courier", "B", 8.5)
        if "ONLINE" in line[1] or "SUCCESS" in line[1] or "CLOSED" in line[1] or "0%" in line[1]:
            pdf.set_text_color(16, 185, 129)
        elif "NTAG" in line[1]:
            pdf.set_text_color(6, 182, 212)
        else:
            pdf.set_text_color(255, 255, 255)
        pdf.cell(60, 5, line[1], ln=1)

    # ----------------------------------------------------
    # SLIDE 5: Pilar B - Cognitive AI Engine
    # ----------------------------------------------------
    pdf.draw_slide_base("Pilar B: nexID Cognitive AI Engine", "traductor a copys premium y estimación en tiempo real")
    
    # Left side: Tone Profiles
    x_left = 15
    y_start = 50
    w_card = 135
    h_card = 38
    
    tones = [
        {"title": "Perfil 1: Tono Sommelier (Exclusivo)", "desc": "Traduce borradores comerciales simples a vocabulario organoléptico distinguido (notas de cata, barricas de roble francés, complejidad persistente)."},
        {"title": "Perfil 2: Tono Club Privado (Fidelidad)", "desc": "Modifica el texto para insertar gatillos de escasez absoluta, invitaciones VIP exclusivas, asignación de cupos y reservas limitadas."},
        {"title": "Perfil 3: Tono Modern Web3 (Tecnología)", "desc": "Traduce el copy enfocado a coleccionistas criptográficos, tokens on-chain, gemelos digitales y propiedad digital registrada."}
    ]
    
    for i, tone in enumerate(tones):
        y_pos = y_start + (i * 42)
        pdf.draw_card(x_left, y_pos, w_card, h_card, border_color=(168, 85, 247, 0.15))
        
        pdf.set_xy(x_left + 5, y_pos + 4)
        pdf.set_font("helvetica", "B", 10.5)
        pdf.set_text_color(168, 85, 247)
        pdf.cell(100, 6, tone["title"], ln=1)
        
        pdf.set_xy(x_left + 5, y_pos + 12)
        pdf.set_font("helvetica", "", 9)
        pdf.set_text_color(156, 163, 175)
        pdf.multi_cell(w_card - 10, 4.5, tone["desc"], border=0)

    # Right side: AI Telemetry
    x_right = 165
    y_right = 50
    w_right = 117
    h_right = 126
    pdf.draw_card(x_right, y_right, w_right, h_right, border_color=(168, 85, 247, 0.3), fill_color=(20, 15, 40))
    
    pdf.set_xy(x_right + 10, y_right + 10)
    pdf.set_font("helvetica", "B", 13)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 6, "Telemetría de Impacto AI", ln=1)
    
    pdf.set_xy(x_right + 10, y_right + 16)
    pdf.set_font("helvetica", "B", 7.5)
    pdf.set_text_color(168, 85, 247)
    pdf.cell(0, 5, "MÉTRICAS ESTIMADAS ANTES DEL ENVÍO DE LA CAMPAÑA", ln=1)

    # Metric blocks
    # Box 1: Prestige Score
    pdf.draw_card(x_right + 10, y_right + 26, 45, 24, border_color=(251, 191, 36, 0.2), fill_color=(2, 6, 23))
    pdf.set_xy(x_right + 12, y_right + 29)
    pdf.set_font("helvetica", "B", 7)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(40, 4, "SCORE DE PRESTIGIO", ln=1)
    pdf.set_xy(x_right + 12, y_right + 34)
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(251, 191, 36) # Amber
    pdf.cell(40, 8, "92% (Lujo VIP)", ln=1)

    # Box 2: CTR Estimado
    pdf.draw_card(x_right + 62, y_right + 26, 45, 24, border_color=(6, 182, 212, 0.2), fill_color=(2, 6, 23))
    pdf.set_xy(x_right + 64, y_right + 29)
    pdf.set_font("helvetica", "B", 7)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(40, 4, "CTR / VIRALIDAD", ln=1)
    pdf.set_xy(x_right + 64, y_right + 34)
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(6, 182, 212) # Cyan
    pdf.cell(40, 8, "28% (Conversión)", ln=1)

    # Description of Footprint
    pdf.set_xy(x_right + 10, y_right + 58)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 6, "Huella Emocional del Texto:", ln=1)

    emotions = [
        ("Exclusividad (Vocabulario VIP)", 88, (168, 85, 247)), # purple
        ("Confianza (Trazabilidad y Sello)", 95, (16, 185, 129)), # green
        ("Curiosidad (Misiones del Club)", 74, (6, 182, 212)), # cyan
        ("Urgencia (Acceso a Cupos)", 60, (251, 191, 36)) # amber
    ]

    for i, emo in enumerate(emotions):
        y_e = y_right + 68 + (i * 13)
        pdf.set_xy(x_right + 10, y_e)
        pdf.set_font("helvetica", "", 8.5)
        pdf.set_text_color(156, 163, 175)
        pdf.cell(50, 4, emo[0], ln=0)
        
        pdf.set_font("helvetica", "B", 8.5)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(15, 4, f"{emo[1]}%", ln=0, align="R")
        
        # Progress Bar background
        pdf.set_fill_color(15, 23, 42)
        pdf.rect(x_right + 10, y_e + 5, 97, 2.5, "F")
        # Active bar
        pdf.set_fill_color(*emo[2])
        w_bar = int(97 * (emo[1] / 100))
        pdf.rect(x_right + 10, y_e + 5, w_bar, 2.5, "F")

    # ----------------------------------------------------
    # SLIDE 6: Pilar C - Active Loyalty & Gamification
    # ----------------------------------------------------
    pdf.draw_slide_base("Pilar C: Gamificación y Fidelidad VIP", "conversión del consumo en un club de estatus digital")
    
    # Left side: Mechanics
    x_left = 15
    y_start = 50
    
    mechanics = [
        {"title": "Cava Digital del Coleccionista", "desc": "Cada botella escaneada y reclamada se añade a la bodega 3D virtual del consumidor. Fomenta el coleccionismo al crear el impulso de 'completar las cosechas' y poseer todos los varietales."},
        {"title": "Membresías y Tarjetas VIP de Metal", "desc": "Cuanto más consume y escanea, el usuario sube de categoría de estatus: de Bronce a Plata, Platino y Oro. Cada tarjeta VIP animada desbloquea invitaciones privadas y preventas exclusivas."},
        {"title": "Gobernanza VIP Activa (Votos Reales)", "desc": "Los coleccionistas de alto rango ganan peso de voto para tomar decisiones con la bodega: elección del blend de la próxima cosecha, composición de barricas, o la locación del próximo evento presencial."},
        {"title": "Cata Virtual (Sommelier AI) & Sello Óptico", "desc": "Chat bot enólogo que asesora según el vino del usuario y análisis óptico del corcho con Inteligencia Artificial mediante fotos para verificar la salud y potencial de guarda de la botella."}
    ]
    
    for i, mech in enumerate(mechanics):
        y_pos = y_start + (i * 35)
        
        # Icon
        pdf.set_fill_color(30, 27, 75)
        pdf.rect(x_left, y_pos, 5, 5, "F")
        pdf.set_xy(x_left, y_pos)
        pdf.set_font("helvetica", "B", 8)
        pdf.set_text_color(168, 85, 247)
        pdf.cell(5, 5, "+", ln=0, align="C")
        
        pdf.set_xy(x_left + 8, y_pos)
        pdf.set_font("helvetica", "B", 10.5)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(130, 5, mech["title"], ln=1)
        
        pdf.set_xy(x_left + 8, y_pos + 5)
        pdf.set_font("helvetica", "", 9)
        pdf.set_text_color(156, 163, 175)
        pdf.multi_cell(125, 4.5, mech["desc"], border=0)

    # Right side: VIP Mock card & Product Display
    x_right = 160
    y_right = 50
    w_right = 122
    h_right = 126
    pdf.draw_card(x_right, y_right, w_right, h_right, border_color=(251, 191, 36, 0.2), fill_color=(15, 23, 42))

    # Governance voting simulation
    pdf.set_xy(x_right + 10, y_right + 8)
    pdf.set_font("helvetica", "B", 10.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(100, 5, "Módulo de Votación VIP", ln=1)
    
    pdf.set_xy(x_right + 10, y_right + 14)
    pdf.set_font("helvetica", "", 8.5)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(100, 4, "Decisión de Cofradía: Diseño de Etiqueta Cosecha 2026", ln=1)

    # Progress bars for votes
    # Option A
    pdf.set_xy(x_right + 10, y_right + 22)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(251, 191, 36)
    pdf.cell(60, 4, "Opción A (Grabado Clásico)", ln=0)
    pdf.cell(40, 4, "58% de Votos", ln=1, align="R")
    
    pdf.set_fill_color(2, 6, 23)
    pdf.rect(x_right + 10, y_right + 27, 102, 2.5, "F")
    pdf.set_fill_color(251, 191, 36)
    pdf.rect(x_right + 10, y_right + 27, int(102 * 0.58), 2.5, "F")

    # Option B
    pdf.set_xy(x_right + 10, y_right + 33)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(60, 4, "Opción B (Líneas Modernas)", ln=0)
    pdf.cell(40, 4, "42% de Votos", ln=1, align="R")
    
    pdf.set_fill_color(2, 6, 23)
    pdf.rect(x_right + 10, y_right + 38, 102, 2.5, "F")
    pdf.set_fill_color(71, 85, 105)
    pdf.rect(x_right + 10, y_right + 38, int(102 * 0.42), 2.5, "F")

    # Image Product
    if os.path.exists(img_magnum_pdf):
        # Center the magnum image at the bottom of the card
        pdf.image(img_magnum_pdf, x_right + 48, y_right + 48, 26, 73)
        
        # Draw dynamic validation HUD
        hud_x = x_right + 8
        hud_y = y_right + 65
        pdf.draw_card(hud_x, hud_y, 35, 38, border_color=(6, 182, 212, 0.15), fill_color=(2, 6, 23))
        pdf.set_xy(hud_x + 3, hud_y + 3)
        pdf.set_font("helvetica", "B", 6.5)
        pdf.set_text_color(6, 182, 212)
        pdf.cell(0, 4, "VERIFICACIÓN TAP", ln=1)
        pdf.set_font("helvetica", "", 6)
        pdf.set_text_color(156, 163, 175)
        pdf.set_xy(hud_x + 3, hud_y + 8)
        pdf.cell(0, 4, "Código: NTAG-424", ln=1)
        pdf.set_xy(hud_x + 3, hud_y + 12)
        pdf.cell(0, 4, "Ledger: Validado OK", ln=1)
        pdf.set_xy(hud_x + 3, hud_y + 16)
        pdf.set_font("helvetica", "B", 7)
        pdf.set_text_color(16, 185, 129)
        pdf.cell(0, 4, "PROPIETARIO VIP", ln=1)
        
        # Draw passive card HUD on the right
        hud_x2 = x_right + 78
        hud_y2 = y_right + 65
        pdf.draw_card(hud_x2, hud_y2, 35, 38, border_color=(168, 85, 247, 0.15), fill_color=(2, 6, 23))
        pdf.set_xy(hud_x2 + 3, hud_y2 + 3)
        pdf.set_font("helvetica", "B", 6.5)
        pdf.set_text_color(168, 85, 247)
        pdf.cell(0, 4, "MEMBRESÍA ACTIVA", ln=1)
        pdf.set_font("helvetica", "", 6)
        pdf.set_text_color(156, 163, 175)
        pdf.set_xy(hud_x2 + 3, hud_y2 + 8)
        pdf.cell(0, 4, "Nivel: ORO (GOLD)", ln=1)
        pdf.set_xy(hud_x2 + 3, hud_y2 + 12)
        pdf.cell(0, 4, "Puntos: 4,890 Pts", ln=1)
        pdf.set_xy(hud_x2 + 3, hud_y2 + 16)
        pdf.set_font("helvetica", "B", 7)
        pdf.set_text_color(251, 191, 36)
        pdf.cell(0, 4, "COFRADÍA EXCLUSIVA", ln=1)

    # ----------------------------------------------------
    # SLIDE 7: Commercial Traction & Business Opportunity
    # ----------------------------------------------------
    pdf.draw_slide_base("Tracción y Oportunidad de Negocio", "valor comercial disruptivo para productores y distribuidores")
    
    # 3 Large Cards
    card_w = 82
    card_h = 125
    y_pos = 50

    # Metric Card 1: 100%
    pdf.draw_card(15, y_pos, card_w, card_h, border_color=(168, 85, 247, 0.3))
    pdf.set_xy(20, y_pos + 12)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(168, 85, 247)
    pdf.cell(card_w - 10, 5, "DATOS DE MERCADO DTC", ln=1)
    
    pdf.set_xy(20, y_pos + 20)
    pdf.set_font("helvetica", "B", 42)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(card_w - 10, 20, "100%", ln=1)
    
    pdf.set_xy(20, y_pos + 48)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(card_w - 10, 5, "Propiedad Directa de Datos", ln=1)
    
    pdf.set_xy(20, y_pos + 58)
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(card_w - 10, 5, "Las bodegas finalmente adueñan los datos demográficos y hábitos de consumo del cliente final. Obtienen visibilidad instantánea del mercado secundario y consumo real, sin depender de distribuidores o intermediarios.", border=0)

    # Metric Card 2: Zero
    pdf.draw_card(107, y_pos, card_w, card_h, border_color=(6, 182, 212, 0.3))
    pdf.set_xy(112, y_pos + 12)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(6, 182, 212)
    pdf.cell(card_w - 10, 5, "PROTECCIÓN ACTIVA", ln=1)
    
    pdf.set_xy(112, y_pos + 20)
    pdf.set_font("helvetica", "B", 42)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(card_w - 10, 20, "ZERO", ln=1)
    
    pdf.set_xy(112, y_pos + 48)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(card_w - 10, 5, "Falsificaciones en Red", ln=1)
    
    pdf.set_xy(112, y_pos + 58)
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(card_w - 10, 5, "Eliminación completa del fraude en lotes de alta gama. La bodega bloquea los mercados grises de reventa ilegal y protege el valor percibido del vino, asegurando un canal inmaculado y inalterable de procedencia.", border=0)

    # Metric Card 3: +24%
    pdf.draw_card(199, y_pos, card_w, card_h, border_color=(16, 185, 129, 0.3))
    pdf.set_xy(204, y_pos + 12)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(16, 185, 129)
    pdf.cell(card_w - 10, 5, "INCREMENTO DE INGRESOS", ln=1)
    
    pdf.set_xy(204, y_pos + 20)
    pdf.set_font("helvetica", "B", 42)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(card_w - 10, 20, "+24%", ln=1)
    
    pdf.set_xy(204, y_pos + 48)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(card_w - 10, 5, "Retención y Recurrencia", ln=1)
    
    pdf.set_xy(204, y_pos + 58)
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(card_w - 10, 5, "Aumenta la recompra recurrente a través del portal VIP integrado. La bodega vende preventas exclusivas, experiencias turísticas y coleccionables directamente al consumidor que ya demostró fidelidad física.", border=0)

    # ----------------------------------------------------
    # SLIDE 8: Live Demo & Next Steps
    # ----------------------------------------------------
    pdf.draw_slide_base("Demostración en Vivo", "preparación para la experiencia con tags físicos en tiempo real")
    
    # Left side details
    x_left = 15
    y_pos = 50
    
    pdf.set_xy(x_left, y_pos)
    pdf.set_font("helvetica", "B", 15)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(140, 8, "Flujo de Demostración Práctica", ln=1)
    
    pdf.set_xy(x_left, y_pos + 10)
    pdf.set_font("helvetica", "", 10.5)
    pdf.set_text_color(156, 163, 175)
    pdf.multi_cell(140, 6, "A continuación, llevaremos a cabo la demostración interactiva en vivo utilizando elementos del kit real nexID:\n\n1.  [Físico] Mostraremos una botella equipada con el microchip criptográfico nexID NFC oculto en su cuello.\n\n2.  [Celular] Utilizaremos un smartphone común para hacer un 'tap' rápido y abrir instantáneamente el Portal del Consumidor, verificando la firma original.\n\n3.  [Notebook Admin] Abriremos el panel CRM del Bodeguero para ver cómo el sistema capturó la geolocalización, actualizó el ledger en vivo y gatilló las métricas de fidelidad.", border=0)

    # Display steps inside nice compact boxes
    steps_y = 138
    pdf.draw_card(x_left, steps_y, 140, 38, border_color=(168, 85, 247, 0.2), fill_color=(20, 15, 42))
    
    pdf.set_xy(x_left + 5, steps_y + 4)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(168, 85, 247)
    pdf.cell(130, 4, "REQUERIMIENTOS PARA LA DEMO EN VIVO:", ln=1)
    
    pdf.set_xy(x_left + 5, steps_y + 11)
    pdf.set_font("helvetica", "", 8.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(130, 5, "- 1 Botella de cata física con chip nexID insertado.", ln=1)
    pdf.set_xy(x_left + 5, steps_y + 17)
    pdf.cell(130, 5, "- Teléfono móvil inteligente con NFC activo (iOS o Android).", ln=1)
    pdf.set_xy(x_left + 5, steps_y + 23)
    pdf.cell(130, 5, "- Conexión a Internet móvil y pantalla de notebook para el CRM.", ln=1)

    # Right side: Large Kit Mockup Showcase
    if os.path.exists(img_crate):
        crate_x, crate_y, crate_w, crate_h = 165, 48, 117, 128
        pdf.draw_card(crate_x, crate_y, crate_w, crate_h, border_color=(16, 185, 129, 0.25), fill_color=(15, 23, 42))
        
        pdf.set_xy(crate_x + 10, crate_y + 8)
        pdf.set_font("helvetica", "B", 11)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(0, 6, "nexID Partner Kit 2026", ln=1)
        
        pdf.set_xy(crate_x + 10, crate_y + 14)
        pdf.set_font("helvetica", "B", 7.5)
        pdf.set_text_color(16, 185, 129)
        pdf.cell(0, 5, "GEMELO DIGITAL Y CONTENEDOR FÍSICO INTEGRADO", ln=1)

        # Image Crate placement
        pdf.image(img_crate, crate_x + 16, crate_y + 24, 85, 85)
        
        pdf.set_xy(crate_x + 5, crate_y + 114)
        pdf.set_font("helvetica", "I", 7.5)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(crate_w - 10, 5, "Imagen real de nuestro Kit de Colección Verificado", ln=0, align="C")

    # Output file
    # 1. Output to docs/
    output_dir = os.path.join(base_path, "docs")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    output_pdf_path = os.path.join(output_dir, "nexid_pitch_deck.pdf")
    pdf.output(output_pdf_path)
    print(f"SUCCESS: Pitch deck PDF successfully generated at {output_pdf_path}")
    
    # 2. Output to apps/dashboard/public/
    dashboard_public = os.path.join(base_path, "apps/dashboard/public")
    if os.path.exists(dashboard_public):
        dashboard_pdf = os.path.join(dashboard_public, "nexid_pitch_deck.pdf")
        pdf.output(dashboard_pdf)
        print(f"SUCCESS: Pitch deck PDF successfully copied to {dashboard_pdf}")
        
    # 3. Output to apps/web/public/
    web_public = os.path.join(base_path, "apps/web/public")
    if os.path.exists(web_public):
        web_pdf = os.path.join(web_public, "nexid_pitch_deck.pdf")
        pdf.output(web_pdf)
        print(f"SUCCESS: Pitch deck PDF successfully copied to {web_pdf}")

if __name__ == "__main__":
    build_pdf()
