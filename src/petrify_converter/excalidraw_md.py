# src/petrify_converter/excalidraw_md.py
import json
from typing import Any

import lzstring


class ExcalidrawMdGenerator:
    """Obsidian Excalidraw 플러그인용 .excalidraw.md 포맷 생성."""

    def generate(
        self,
        excalidraw_data: dict[str, Any],
        embedded_files: dict[str, bytes] | None = None,
    ) -> str:
        """Excalidraw 데이터를 .excalidraw.md 포맷으로 변환."""
        compressed = self._compress(excalidraw_data)
        embedded_section = self._generate_embedded_section(embedded_files)

        return f"""---
excalidraw-plugin: parsed
tags:
---

# Excalidraw Data

## Text Elements
## Embedded Files
{embedded_section}
%%
## Drawing
```compressed-json
{compressed}
```
%%
"""

    def _compress(self, data: dict[str, Any]) -> str:
        """Excalidraw 데이터를 LZString으로 압축."""
        json_str = json.dumps(data, ensure_ascii=False)
        lz = lzstring.LZString()
        return lz.compressToBase64(json_str)

    def _generate_embedded_section(
        self, embedded_files: dict[str, bytes] | None
    ) -> str:
        """Embedded Files 섹션 생성."""
        if not embedded_files:
            return "\n"

        lines = []
        for file_id, filename in embedded_files.items():
            if isinstance(filename, bytes):
                filename = filename.decode()
            lines.append(f"{file_id}: [[{filename}]]")

        return "\n" + "\n".join(lines) + "\n"
