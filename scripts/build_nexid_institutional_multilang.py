from __future__ import annotations

import asyncio
import json
import math
import shutil
import subprocess
import wave
from pathlib import Path
from typing import Any

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "source_assets"
ZIP_ASSETS = ASSETS / "zip"
STANDALONE_ASSETS = ASSETS / "standalone"
INTERMEDIATE = ROOT / "intermediate"
DELIVERABLES = ROOT / "deliverables"
SUBS = DELIVERABLES / "subs"
POSTERS = DELIVERABLES / "posters"

FFMPEG_CANDIDATES = [
    ROOT / ".bin" / "ffmpeg.exe",
    ROOT.parent / "alan-turing-enigma-youtube-package" / "hyperframes-full" / ".bin" / "ffmpeg.exe",
    ROOT.parent / "nexid-institutional-video-package" / "node_modules" / "ffmpeg-static" / "ffmpeg.exe",
]
FFPROBE_CANDIDATES = [
    ROOT / ".bin" / "ffprobe.exe",
    ROOT.parent / "alan-turing-enigma-youtube-package" / "hyperframes-full" / ".bin" / "ffprobe.exe",
]


def pick_binary(candidates: list[Path], name: str) -> Path:
    for candidate in candidates:
        if candidate.exists():
            return candidate
    resolved = shutil.which(name)
    if resolved:
        return Path(resolved)
    raise FileNotFoundError(f"{name} binary not found")


FFMPEG = pick_binary(FFMPEG_CANDIDATES, "ffmpeg")
FFPROBE = pick_binary(FFPROBE_CANDIDATES, "ffprobe")

WIDTH = 1920
HEIGHT = 1080
FPS = 30
TRANSITION = 0.45
SCENE_DURATIONS = [7.6, 7.6, 7.8, 7.8, 7.6, 7.6, 7.6, 9.55]
FINAL_DURATION = round(sum(SCENE_DURATIONS) - TRANSITION * (len(SCENE_DURATIONS) - 1), 2)

FONT_HEAD = Path(r"C:\Windows\Fonts\bahnschrift.ttf")
FONT_BODY = Path(r"C:\Windows\Fonts\segoeui.ttf")
if not FONT_HEAD.exists():
    FONT_HEAD = Path(r"C:\Windows\Fonts\arialbd.ttf")
if not FONT_BODY.exists():
    FONT_BODY = Path(r"C:\Windows\Fonts\arial.ttf")


def run(cmd: list[str], *, timeout: int | None = None) -> None:
    print("RUN", " ".join(str(x) for x in cmd[:8]), "...")
    subprocess.run(cmd, check=True, timeout=timeout)


def capture(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True, encoding="utf-8", errors="replace")


def ff_filter_path(path: Path) -> str:
    return path.resolve().as_posix().replace(":", r"\:")


def find_asset(pattern: str) -> Path:
    candidates = sorted(ZIP_ASSETS.glob(pattern)) + sorted(STANDALONE_ASSETS.glob(pattern))
    if not candidates:
        candidates = sorted(ASSETS.rglob(pattern))
    if not candidates:
        raise FileNotFoundError(f"Missing asset matching {pattern}")
    return candidates[0]


def probe(path: Path) -> dict[str, Any]:
    data = json.loads(
        capture(
            [
                str(FFPROBE),
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-print_format",
                "json",
                str(path),
            ]
        )
    )
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = any(s.get("codec_type") == "audio" for s in streams)
    width = int(video.get("width", 0)) if video else 0
    height = int(video.get("height", 0)) if video else 0
    fps = None
    if video and video.get("avg_frame_rate") and video["avg_frame_rate"] != "0/0":
        n, d = video["avg_frame_rate"].split("/")
        fps = round(float(n) / float(d), 3) if float(d) else None
    duration = None
    if data.get("format", {}).get("duration"):
        duration = round(float(data["format"]["duration"]), 3)
    elif video and video.get("duration"):
        duration = round(float(video["duration"]), 3)
    ext = path.suffix.lower()
    media_type = "image" if ext in {".png", ".jpg", ".jpeg", ".webp"} else "video"
    orientation = "landscape" if width >= height else "portrait"
    return {
        "file": path.name,
        "path": str(path),
        "type": media_type,
        "duration": duration,
        "width": width,
        "height": height,
        "orientation": orientation,
        "fps": fps,
        "has_audio": audio,
    }


SCENE_ASSETS = [
    ("contact", "*Hand_holding_smartphone_touching*.mp4"),
    ("chip", "*3D_render_NTAG_424_DNA*.mp4"),
    ("verification", "*Smartphone_screen_displaying_hol*.mp4"),
    ("traceability", "*Smartphone_interface_showing_tra*.mp4"),
    ("multi_product", "*Hand_scanning_products_with_smar*.mp4"),
    ("experience", "*Man_and_woman_clinking_glasses*.mp4"),
    ("digital_twin", "*Wine_bottle_dissolves_into_digit*.mp4"),
    ("web_sdk", "*Smartphone_screen_nexID_web_inte*.mp4"),
]


LANGS: dict[str, dict[str, Any]] = {
    "es": {
        "label": "Castellano",
        "voice": "es-AR-ElenaNeural",
        "rate": "+8%",
        "pitch": "+4Hz",
        "poster": "IDENTIDAD DIGITAL\nPARA PRODUCTOS REALES",
        "cta": "Solicitá una demo en nexid.lat",
        "chapters": [
            ("El contacto", "TOCA PARA VERIFICAR", "Un toque convierte el producto en una prueba digital.", "En un mercado lleno de copias, la confianza ya no puede depender solo de una etiqueta."),
            ("El chip", "FIRMA CRIPTOGRÁFICA", "NTAG 424 DNA valida un desafío único.", "Con nex ai di, cada producto físico puede activar una identidad digital verificable con un simple toque."),
            ("La validación", "PASAPORTE DIGITAL", "Sin app: el navegador abre la identidad del producto.", "El chip N F C responde con una firma criptográfica única, validada en tiempo real, sin instalar aplicaciones."),
            ("Trazabilidad", "ORIGEN E HISTORIAL", "Lote, procedencia, eventos y estado en una sola vista.", "El consumidor accede a un pasaporte digital: origen, lote, historial y estado del producto."),
            ("Marca", "CANAL DIRECTO", "Cada escaneo puede abrir datos, soporte y relación.", "Para la marca, eso abre trazabilidad, prevención de fraude y nuevos canales de relación directa."),
            ("Experiencia", "BENEFICIOS REALES", "Garantías, recompensas y comunidad conectadas al objeto.", "Y para el usuario, beneficios, garantías y experiencias exclusivas conectadas al producto original."),
            ("Web3", "DEL OBJETO AL ACTIVO", "Producto real, datos verificables y propiedad digital.", "nex ai di une objetos reales con datos, propiedad digital y ecosistemas Web tres, de forma simple."),
            ("Cierre", "nexID", "La capa de confianza para productos reales.", "nex ai di. La capa de confianza para productos reales en un mundo digital."),
        ],
    },
    "en": {
        "label": "English",
        "voice": "en-US-AriaNeural",
        "rate": "+6%",
        "pitch": "+2Hz",
        "poster": "DIGITAL IDENTITY\nFOR REAL PRODUCTS",
        "cta": "Request a demo at nexid.lat",
        "chapters": [
            ("The contact", "TAP TO VERIFY", "A tap turns the product into digital proof.", "In a market full of counterfeits, trust can no longer depend on a label alone."),
            ("The chip", "CRYPTOGRAPHIC SIGNATURE", "NTAG 424 DNA validates a unique challenge.", "With nex I D, every physical product can activate a verifiable digital identity with a simple tap."),
            ("Validation", "DIGITAL PASSPORT", "No app required: the browser opens the product identity.", "The N F C chip responds with a unique cryptographic signature, validated in real time, with no app to install."),
            ("Traceability", "ORIGIN AND HISTORY", "Batch, provenance, events and status in one view.", "The consumer unlocks a digital passport: origin, batch, history and product status."),
            ("Brand", "DIRECT CHANNEL", "Every scan can open data, support and relationship.", "For the brand, that creates traceability, fraud prevention and new direct customer channels."),
            ("Experience", "REAL BENEFITS", "Warranties, rewards and community linked to the object.", "For the user, benefits, warranties and exclusive experiences stay connected to the original product."),
            ("Web3", "FROM OBJECT TO ASSET", "Real product, verifiable data and digital ownership.", "nex I D connects real objects with data, digital ownership and Web three ecosystems in a simple way."),
            ("Close", "nexID", "The trust layer for real products.", "nex I D. The trust layer for real products in a digital world."),
        ],
    },
    "pt": {
        "label": "Português",
        "voice": "pt-BR-FranciscaNeural",
        "rate": "+6%",
        "pitch": "+3Hz",
        "poster": "IDENTIDADE DIGITAL\nPARA PRODUTOS REAIS",
        "cta": "Peça uma demo em nexid.lat",
        "chapters": [
            ("O contato", "TOQUE PARA VERIFICAR", "Um toque transforma o produto em prova digital.", "Em um mercado cheio de falsificações, a confiança não pode depender apenas de uma etiqueta."),
            ("O chip", "ASSINATURA CRIPTOGRÁFICA", "NTAG 424 DNA valida um desafio único.", "Com nex ai di, cada produto físico pode ativar uma identidade digital verificável com um simples toque."),
            ("Validação", "PASSAPORTE DIGITAL", "Sem app: o navegador abre a identidade do produto.", "O chip N F C responde com uma assinatura criptográfica única, validada em tempo real, sem instalar aplicativos."),
            ("Rastreabilidade", "ORIGEM E HISTÓRICO", "Lote, procedência, eventos e status em uma única tela.", "O consumidor acessa um passaporte digital: origem, lote, histórico e status do produto."),
            ("Marca", "CANAL DIRETO", "Cada leitura pode abrir dados, suporte e relacionamento.", "Para a marca, isso abre rastreabilidade, prevenção de fraude e novos canais diretos com o cliente."),
            ("Experiência", "BENEFÍCIOS REAIS", "Garantias, recompensas e comunidade ligadas ao objeto.", "Para o usuário, benefícios, garantias e experiências exclusivas ficam conectadas ao produto original."),
            ("Web3", "DO OBJETO AO ATIVO", "Produto real, dados verificáveis e propriedade digital.", "nex ai di conecta objetos reais com dados, propriedade digital e ecossistemas Web três de forma simples."),
            ("Fechamento", "nexID", "A camada de confiança para produtos reais.", "nex ai di. A camada de confiança para produtos reais em um mundo digital."),
        ],
    },
}


def scene_start_times() -> list[float]:
    starts = []
    t = 0.0
    for dur in SCENE_DURATIONS:
        starts.append(round(t, 3))
        t += dur - TRANSITION
    return starts


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def wrap_text(text: str, max_chars: int = 48) -> str:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        trial = " ".join(current + [word])
        if len(trial) <= max_chars:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return "\n".join(lines[:2])


def build_asset_manifest(scene_paths: dict[str, Path]) -> None:
    all_files = sorted(ASSETS.rglob("*.*"))
    manifest = []
    uses = {
        scene_paths["contact"].name: "hero contact: tap NFC on premium product",
        scene_paths["chip"].name: "cryptographic chip explainer",
        scene_paths["verification"].name: "product authenticity validation",
        scene_paths["traceability"].name: "traceability and product data",
        scene_paths["multi_product"].name: "multi-category product scan",
        scene_paths["experience"].name: "loyalty and brand experience",
        scene_paths["digital_twin"].name: "digital twin and ownership bridge",
        scene_paths["web_sdk"].name: "web/platform closing scene",
    }
    for file in all_files:
        if file.is_file():
            info = probe(file)
            info["narrative_use"] = uses.get(file.name, "supporting/reference asset")
            manifest.append(info)
    write_text(ROOT / "asset_manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))


def create_music(path: Path, duration: float, sample_rate: int = 48000) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    total = int(duration * sample_rate)
    with wave.open(str(path), "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        for i in range(total):
            t = i / sample_rate
            beat = (math.sin(2 * math.pi * 0.52 * t) + 1) / 2
            pad = 0.28 * math.sin(2 * math.pi * 74 * t) + 0.18 * math.sin(2 * math.pi * 110 * t)
            pulse = 0.14 * math.sin(2 * math.pi * 148 * t) * (0.35 + 0.65 * beat)
            shimmer = 0.04 * math.sin(2 * math.pi * 660 * t) * (0.2 + 0.8 * beat)
            ramp = min(1.0, t / 4.0, (duration - t) / 3.0)
            val = max(-1.0, min(1.0, (pad + pulse + shimmer) * ramp * 0.55))
            sample = int(val * 32767)
            w.writeframesraw(sample.to_bytes(2, "little", signed=True) * 2)


async def synthesize_text(text: str, voice: str, rate: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    pitch = next((cfg.get("pitch", "+0Hz") for cfg in LANGS.values() if cfg["voice"] == voice), "+0Hz")
    communicator = edge_tts.Communicate(text, voice=voice, rate=rate, volume="+0%", pitch=pitch)
    await communicator.save(str(out))


def media_duration(path: Path) -> float:
    data = json.loads(
        capture(
            [
                str(FFPROBE),
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ]
        )
    )
    return float(data["format"]["duration"])


def fit_voice_segment(src: Path, out: Path, max_duration: float) -> None:
    dur = media_duration(src)
    filters = ["loudnorm=I=-17:TP=-1.5:LRA=10"]
    if dur > max_duration:
        ratio = dur / max_duration
        stages = []
        while ratio > 2.0:
            stages.append("atempo=2.0")
            ratio /= 2.0
        if ratio > 1.01:
            stages.append(f"atempo={ratio:.5f}")
        filters = stages + filters
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(src),
            "-t",
            f"{max_duration:.3f}",
            "-af",
            ",".join(filters),
            "-ar",
            "48000",
            "-ac",
            "2",
            str(out),
        ],
        timeout=120,
    )


def render_scene_clip(lang: str, idx: int, source: Path, duration: float, chapter: tuple[str, str, str, str]) -> Path:
    out = INTERMEDIATE / f"{lang}_scene_{idx:02d}.mp4"
    kicker, title, caption, _voice = chapter
    text_dir = INTERMEDIATE / "text" / lang / f"scene_{idx:02d}"
    write_text(text_dir / "kicker.txt", kicker.upper())
    write_text(text_dir / "title.txt", title.upper())
    write_text(text_dir / "caption.txt", wrap_text(caption, 52))

    text_head = ff_filter_path(FONT_HEAD)
    text_body = ff_filter_path(FONT_BODY)
    kicker_file = ff_filter_path(text_dir / "kicker.txt")
    title_file = ff_filter_path(text_dir / "title.txt")
    caption_file = ff_filter_path(text_dir / "caption.txt")

    vf = ",".join(
        [
            f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase",
            f"crop={WIDTH}:{HEIGHT}",
            "setsar=1",
            f"fps={FPS}",
            "eq=contrast=1.08:saturation=1.04:brightness=-0.025",
            "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.18:t=fill",
            "drawbox=x=0:y=0:w=iw:h=210:color=black@0.18:t=fill",
            "drawbox=x=0:y=h-230:w=iw:h=230:color=black@0.24:t=fill",
            f"drawtext=fontfile='{text_head}':textfile='{kicker_file}':x=88:y=64:fontsize=31:fontcolor=0x2DEBD2:alpha=0.96",
            f"drawtext=fontfile='{text_head}':textfile='{title_file}':x=88:y=111:fontsize=66:fontcolor=white:box=1:boxcolor=black@0.08:boxborderw=7",
            f"drawtext=fontfile='{text_body}':textfile='{caption_file}':x=(w-text_w)/2:y=h-154:fontsize=38:fontcolor=white:box=1:boxcolor=black@0.52:boxborderw=24:line_spacing=10",
            f"drawtext=fontfile='{text_head}':text='nexID':x=w-218:y=66:fontsize=42:fontcolor=white@0.86",
        ]
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-stream_loop",
            "-1",
            "-i",
            str(source),
            "-t",
            f"{duration:.3f}",
            "-an",
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            str(out),
        ],
        timeout=180,
    )
    return out


def xfade_scenes(lang: str, clips: list[Path]) -> Path:
    silent = INTERMEDIATE / f"{lang}_visual_silent.mp4"
    cmd = [str(FFMPEG), "-y"]
    for clip in clips:
        cmd += ["-i", str(clip)]
    filter_parts = []
    current = "[0:v]"
    current_duration = SCENE_DURATIONS[0]
    transitions = ["fade", "smoothleft", "fade", "smoothright", "fade", "circleopen", "fade"]
    for i in range(1, len(clips)):
        out_label = f"[v{i}]"
        offset = current_duration - TRANSITION
        transition = transitions[(i - 1) % len(transitions)]
        filter_parts.append(
            f"{current}[{i}:v]xfade=transition={transition}:duration={TRANSITION}:offset={offset:.3f}{out_label}"
        )
        current = out_label
        current_duration = current_duration + SCENE_DURATIONS[i] - TRANSITION
    run(
        cmd
        + [
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            current,
            "-an",
            "-t",
            f"{FINAL_DURATION:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            str(silent),
        ],
        timeout=240,
    )
    return silent


async def build_language_audio(lang: str, config: dict[str, Any], starts: list[float]) -> Path:
    audio_dir = INTERMEDIATE / "audio" / lang
    audio_dir.mkdir(parents=True, exist_ok=True)
    fitted_segments: list[Path] = []
    for idx, (_kicker, _title, _caption, voice_text) in enumerate(config["chapters"], start=1):
        raw = audio_dir / f"voice_{idx:02d}_raw.mp3"
        fitted = audio_dir / f"voice_{idx:02d}.wav"
        await synthesize_text(voice_text, config["voice"], config["rate"], raw)
        fit_voice_segment(raw, fitted, max_duration=max(2.5, SCENE_DURATIONS[idx - 1] - 0.7))
        fitted_segments.append(fitted)

    music = INTERMEDIATE / "music" / "nexid_institutional_bed.wav"
    if not music.exists():
        create_music(music, FINAL_DURATION + 0.25)

    out = INTERMEDIATE / f"{lang}_final_audio.wav"
    cmd = [str(FFMPEG), "-y", "-i", str(music)]
    for seg in fitted_segments:
        cmd += ["-i", str(seg)]

    filters = ["[0:a]volume=0.17[music]"]
    mix_labels = ["[music]"]
    for idx, seg in enumerate(fitted_segments, start=1):
        delay = int((starts[idx - 1] + 0.28) * 1000)
        filters.append(f"[{idx}:a]volume=1.22,adelay={delay}|{delay}[v{idx}]")
        mix_labels.append(f"[v{idx}]")
    filters.append(
        "".join(mix_labels)
        + f"amix=inputs={len(mix_labels)}:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.4:LRA=9[out]"
    )
    run(
        cmd
        + [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[out]",
            "-t",
            f"{FINAL_DURATION:.3f}",
            "-ar",
            "48000",
            "-ac",
            "2",
            str(out),
        ],
        timeout=180,
    )
    return out


def mux_final(lang: str, silent_video: Path, audio: Path) -> Path:
    out = DELIVERABLES / f"nexid_institutional_{lang}_1920x1080.mp4"
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(silent_video),
            "-i",
            str(audio),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            "-shortest",
            str(out),
        ],
        timeout=120,
    )
    return out


def fmt_ts(seconds: float, srt: bool = False) -> str:
    ms = int(round((seconds - int(seconds)) * 1000))
    total = int(seconds)
    hh = total // 3600
    mm = (total % 3600) // 60
    ss = total % 60
    sep = "," if srt else "."
    return f"{hh:02d}:{mm:02d}:{ss:02d}{sep}{ms:03d}"


def write_subtitles(lang: str, config: dict[str, Any], starts: list[float]) -> None:
    vtt = ["WEBVTT", ""]
    srt_lines: list[str] = []
    for idx, chapter in enumerate(config["chapters"], start=1):
        start = starts[idx - 1] + 0.20
        end = min(FINAL_DURATION, starts[idx - 1] + SCENE_DURATIONS[idx - 1] - 0.35)
        text = chapter[3].replace("nex ai di", "nexID").replace("nex I D", "nexID")
        vtt.append(f"{fmt_ts(start)} --> {fmt_ts(end)}")
        vtt.append(text)
        vtt.append("")
        srt_lines.append(str(idx))
        srt_lines.append(f"{fmt_ts(start, True)} --> {fmt_ts(end, True)}")
        srt_lines.append(text)
        srt_lines.append("")
    write_text(SUBS / f"nexid_institutional_{lang}.vtt", "\n".join(vtt))
    write_text(SUBS / f"nexid_institutional_{lang}.srt", "\n".join(srt_lines))


def export_poster(lang: str, video: Path, config: dict[str, Any]) -> Path:
    poster = POSTERS / f"poster_nexid_institutional_{lang}.jpg"
    headline_file = INTERMEDIATE / "posters" / f"{lang}_headline.txt"
    cta_file = INTERMEDIATE / "posters" / f"{lang}_cta.txt"
    write_text(headline_file, config["poster"])
    write_text(cta_file, config["cta"])
    vf = ",".join(
        [
            "scale=1920:1080",
            "eq=contrast=1.08:saturation=1.03:brightness=-0.03",
            "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.20:t=fill",
            f"drawtext=fontfile='{ff_filter_path(FONT_HEAD)}':textfile='{ff_filter_path(headline_file)}':x=88:y=92:fontsize=72:fontcolor=white:line_spacing=12:box=1:boxcolor=black@0.18:boxborderw=16",
            f"drawtext=fontfile='{ff_filter_path(FONT_BODY)}':textfile='{ff_filter_path(cta_file)}':x=94:y=h-132:fontsize=38:fontcolor=0x2DEBD2:box=1:boxcolor=black@0.46:boxborderw=18",
            f"drawtext=fontfile='{ff_filter_path(FONT_HEAD)}':text='nexID':x=w-250:y=h-132:fontsize=54:fontcolor=white@0.90",
        ]
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-ss",
            "0.9",
            "-i",
            str(video),
            "-frames:v",
            "1",
            "-vf",
            vf,
            "-q:v",
            "2",
            str(poster),
        ],
        timeout=80,
    )
    return poster


def write_docs(scene_paths: dict[str, Path], final_videos: dict[str, Path], posters: dict[str, Path]) -> None:
    starts = scene_start_times()
    edit_rows = []
    for idx, ((scene_id, _pattern), dur, start) in enumerate(zip(SCENE_ASSETS, SCENE_DURATIONS, starts), start=1):
        edit_rows.append(
            f"| {idx} | {start:05.2f}s | {dur:04.2f}s | `{scene_id}` | `{scene_paths[scene_id].name}` | Crossfade / focus pull |"
        )
    write_text(
        ROOT / "edit_plan.md",
        "\n".join(
            [
                "# NexID institutional multilang edit plan",
                "",
                "Formato base: 1920x1080, 30fps, duración final aproximada 60s.",
                "",
                "| # | Inicio | Duración fuente | Escena | Asset | Transición |",
                "|---|---:|---:|---|---|---|",
                *edit_rows,
                "",
                "Decisión editorial: una edición visual común para web y tres locuciones/subtítulos por idioma.",
                "Claims ajustados: se usa 'verificable', 'criptográfico' y 'prevención de fraude' en lugar de promesas absolutas no certificadas.",
            ]
        ),
    )

    script_lines = ["# Scripts finales por idioma", ""]
    for lang, cfg in LANGS.items():
        script_lines += [f"## {cfg['label']} ({lang})", ""]
        for idx, chapter in enumerate(cfg["chapters"], start=1):
            script_lines.append(f"{idx}. **{chapter[1]}**")
            script_lines.append(f"   - Subtítulo: {chapter[2]}")
            script_lines.append(f"   - Locución: {chapter[3]}")
        script_lines.append("")
    write_text(ROOT / "scripts_multilang.md", "\n".join(script_lines))

    locale_manifest = {
        "default": "es",
        "duration_seconds": FINAL_DURATION,
        "variants": {
            lang: {
                "label": LANGS[lang]["label"],
                "video": str(path),
                "poster": str(posters[lang]),
                "vtt": str(SUBS / f"nexid_institutional_{lang}.vtt"),
                "srt": str(SUBS / f"nexid_institutional_{lang}.srt"),
            }
            for lang, path in final_videos.items()
        },
    }
    write_text(ROOT / "locale_manifest.json", json.dumps(locale_manifest, ensure_ascii=False, indent=2))

    write_text(
        ROOT / "web_embed_instructions.md",
        """# Web embed notes

Use the localized file according to the active language route or IP/browser locale.

Suggested mapping:
- `es` / `es-AR` / LatAm Spanish route: `nexid_institutional_es_1920x1080.mp4`
- `en` / fallback international route: `nexid_institutional_en_1920x1080.mp4`
- `pt` / `pt-BR`: `nexid_institutional_pt_1920x1080.mp4`

Example:

```html
<video
  autoplay
  muted
  loop
  playsinline
  poster="/video/poster_nexid_institutional_es.jpg"
>
  <source src="/video/nexid_institutional_es_1920x1080.mp4" type="video/mp4" />
  <track src="/video/nexid_institutional_es.vtt" kind="subtitles" srclang="es" label="Castellano" default />
</video>
```

For landing hero use muted autoplay. For the explainer section, enable controls/audio so the localized voice can be heard.
""",
    )

    write_text(
        ROOT / "review_report.md",
        "\n".join(
            [
                "# Review report",
                "",
                f"- Duración final objetivo: {FINAL_DURATION:.2f}s.",
                "- Resolución: 1920x1080.",
                "- Idiomas exportados: castellano, inglés, portugués.",
                "- Voz: Microsoft Neural TTS por idioma; pronunciación de nexID forzada fonéticamente en locución.",
                "- Subtítulos: quemados como frases de escena y sidecars `.srt`/`.vtt` por idioma.",
                "- Música: cama sintética generada localmente, sin copyright.",
                "- Assets descartados: storyboards estáticos solo como referencia visual, no dentro del video final.",
                "- Riesgo editorial controlado: no se usan promesas absolutas de certificación, seguridad o eliminación total de fraude.",
                "",
                "Recomendación honesta: para campaña paga grande, reemplazar TTS por locución humana/licenciada y usar estos cortes como máster de edición.",
            ]
        ),
    )


def validate_outputs(videos: dict[str, Path]) -> dict[str, Any]:
    validation = {}
    for lang, path in videos.items():
        info = probe(path)
        validation[lang] = info
    write_text(DELIVERABLES / "technical_validation.json", json.dumps(validation, ensure_ascii=False, indent=2))
    return validation


async def main() -> None:
    for folder in [INTERMEDIATE, DELIVERABLES, SUBS, POSTERS]:
        folder.mkdir(parents=True, exist_ok=True)

    if not FFMPEG.exists() or not FFPROBE.exists():
        raise FileNotFoundError("ffmpeg/ffprobe binaries not found")

    scene_paths = {scene_id: find_asset(pattern) for scene_id, pattern in SCENE_ASSETS}
    build_asset_manifest(scene_paths)
    starts = scene_start_times()

    final_videos: dict[str, Path] = {}
    posters: dict[str, Path] = {}
    for lang, config in LANGS.items():
        print(f"\n=== BUILD {lang} ===")
        scene_clips = []
        for idx, ((scene_id, _pattern), duration, chapter) in enumerate(
            zip(SCENE_ASSETS, SCENE_DURATIONS, config["chapters"]), start=1
        ):
            scene_clips.append(render_scene_clip(lang, idx, scene_paths[scene_id], duration, chapter))
        silent = xfade_scenes(lang, scene_clips)
        audio = await build_language_audio(lang, config, starts)
        final_videos[lang] = mux_final(lang, silent, audio)
        write_subtitles(lang, config, starts)
        posters[lang] = export_poster(lang, final_videos[lang], config)

    write_docs(scene_paths, final_videos, posters)
    validate_outputs(final_videos)

    package_zip = ROOT.parent / "nexid-institutional-multilang-20260621-final-package.zip"
    if package_zip.exists():
        package_zip.unlink()
    shutil.make_archive(str(package_zip.with_suffix("")), "zip", ROOT)
    print(f"\nDONE {package_zip}")


if __name__ == "__main__":
    asyncio.run(main())
