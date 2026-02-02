# src/petrify_converter/excalidraw_md.py
import json
from typing import Any

import lzstring


class ExcalidrawMdGenerator:
    """Obsidian Excalidraw 플러그인용 .excalidraw.md 포맷 생성."""

    def generate(self, excalidraw_data: dict[str, Any]) -> str:
        """Excalidraw 데이터를 .excalidraw.md 포맷으로 변환."""
        compressed = self._compress(excalidraw_data)

        return f"""---
excalidraw-plugin: parsed
tags:
---

# Excalidraw Data

## Text Elements
## Embedded Files

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
