# Petrify Vision

> E-ink tablet handwriting to Obsidian knowledge base, seamlessly.

## What is Petrify?

Petrify is an Obsidian plugin that automatically converts handwritten notes from E-ink tablets into your Obsidian vault. Currently supporting Viwoods devices, with plans to expand to various E-ink tablets.

## End Picture

```
[Tablet Handwriting] → [Auto Sync] → [Parse + OCR] → [LLM Refinement] → [Excalidraw/Markdown] → [Permanent PKM Storage]
```

### Multi-Device Support

Starting with Viwoods, Petrify aims to support major E-ink devices including Supernote, reMarkable, and Onyx Boox.

- **Devices without sufficient stroke data**: Convert page images as-is (e.g., Viwoods)
- **Devices with stroke data**: Map directly to Excalidraw freedraw elements for high-quality, zoomable, editable output

### LLM-Powered Intelligence

Optional features that refine OCR results using LLMs.

- **Content Summary**: Restructure OCR text into well-organized markdown
- **Prettify**: Correct OCR typos, complete incomplete sentences, apply markdown formatting

## Key Technical Decisions

### 1. Excalidraw-Aligned Domain Model

The domain model (IR) is designed to align with Excalidraw's data structure.

**Rationale:**
- Excalidraw is the primary output format, making IR-to-output conversion natural
- Stroke data from vector-capable devices can be represented without loss
- Avoids over-engineering a "universal stroke abstraction"

**Structure:**
- `Page.imageData?`: For devices without sufficient stroke data (e.g., Viwoods)
- `Page.elements?`: Stroke elements for vector-capable devices (points, pressures, strokeWidth, strokeColor, opacity)

The core defines its own Excalidraw-compatible types rather than depending on the Excalidraw library directly. This preserves the hexagonal architecture's dependency direction (core ← adapters).

### 2. Offline-First Philosophy

Petrify's core pipeline works entirely without network access.

- **Default**: Local OCR (Tesseract.js) + local file watching (chokidar)
- **Optional extensions**: Cloud OCR (Google Vision), Google Drive watching, LLM refinement

LLM features are designed as **optional enhancements**, not core engine components. They activate only when a user provides their API key, and all base functionality works without them.

### 3. Hexagonal Architecture

```
Adapters → Core ← Adapters
```

Dependency inversion through port interfaces allows independent addition of new devices, OCR providers, output formats, and watch sources.

| Port | Purpose | Current Adapters |
|------|---------|-----------------|
| ParserPort | Device-specific file parsing | Viwoods |
| OcrPort | Text recognition | Tesseract.js, Google Vision |
| FileGeneratorPort | Output file generation | Excalidraw, Markdown |
| WatcherPort | File change detection | chokidar, Google Drive |
| LlmPort | AI text refinement | *(planned)* |

### 4. Composition Root

The Obsidian plugin serves as the sole Composition Root. All adapter assembly and configuration management happens here. The core has no knowledge of which adapters are in use.
