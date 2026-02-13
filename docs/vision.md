# Petrify Vision

> E-ink tablet handwriting to Obsidian knowledge base, seamlessly.

## What is Petrify?

Petrify is an Obsidian plugin that automatically converts handwritten notes from E-ink tablets into your Obsidian vault. Supporting Viwoods, Supernote X-series, and any device that exports PDF.

## End Picture

```
[Tablet Handwriting] → [Auto Sync] → [Parse + OCR] → [LLM Refinement] → [Excalidraw/Markdown] → [Permanent PKM Storage]
```

### Multi-Device Support

Petrify supports multiple E-ink devices through dedicated parsers and a universal PDF fallback.

- **Viwoods**: Native `.note` parser — extracts page images from proprietary format
- **Supernote X-series**: Native `.note` parser — decodes RLE-compressed stroke bitmaps
- **PDF (universal)**: Any device that exports PDF — extracts pages as images via `pdf.js`
- **Devices with stroke data** *(planned)*: Map directly to Excalidraw freedraw elements for high-quality, zoomable, editable output

### Page-Level Incremental Processing

Replace file-level mtime comparison with page-content hashing for precise change detection.

- **Page hashing**: Hash each page's content individually, enabling per-page dirty detection instead of whole-file mtime comparison
- **Incremental conversion**: Only re-convert pages whose hash has changed — skip unchanged pages entirely
- **Incremental OCR**: Only re-run OCR on changed pages, reusing cached results for unchanged ones
- **Per-page OCR re-run**: Allow users to selectively trigger OCR on specific pages (e.g., after correcting handwriting or changing OCR provider)

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
| ParserPort | Device-specific file parsing | Viwoods, Supernote X, PDF |
| OcrPort | Text recognition | Tesseract.js, Google Vision |
| FileGeneratorPort | Output file generation | Excalidraw, Markdown |
| WatcherPort | File change detection | chokidar, Google Drive |
| LlmPort | AI text refinement | *(planned)* |

### 4. Composition Root

The Obsidian plugin serves as the sole Composition Root. All adapter assembly and configuration management happens here. The core has no knowledge of which adapters are in use.
