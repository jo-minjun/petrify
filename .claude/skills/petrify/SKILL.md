---
name: petrify
description: "viwoods .note 파일을 Obsidian Excalidraw (.excalidraw.md) 형식으로 변환. 사용자가 .note 파일 변환, Excalidraw 변환, petrify 사용을 요청할 때 사용."
---

# Petrify Converter

viwoods .note 파일을 Obsidian Excalidraw 형식으로 변환하는 도구.

## 프로젝트 경로

- **petrify 프로젝트**: `~/Projects/me/petrify`
- **출력 디렉토리**: `~/Documents/Obsidian Vault/Excalidraw`
- **예시 파일**: `~/Projects/me/petrify/examples/`

## 변환 방법

```bash
cd ~/Projects/me/petrify && source .venv/bin/activate && python scripts/convert.py <input> <output>
```

## 변환 스크립트 사용법

```bash
# 단일 파일 변환
python scripts/convert.py examples/normal/normal.note "~/Documents/Obsidian Vault/Excalidraw/normal.excalidraw.md"

# 여러 파일 변환 (디렉토리 내 모든 .note 파일)
python scripts/convert.py examples/ "~/Documents/Obsidian Vault/Excalidraw/"
```

## 사용 가능한 예시

| 이름 | 경로 |
|------|------|
| normal | `examples/normal/normal.note` |
| pen_pressure | `examples/pen_pressure/pen_pressure.note` |
| various_text | `examples/various_text/various_text.note` |
| position_only_moved | `examples/position_only_moved/position_only_moved.note` |
| lasso_size_increased | `examples/lasso_size_increased/lasso_size_increased.note` |
| lasso_size_reduced | `examples/lasso_size_reduced/lasso_size_reduced.note` |

## 옵션

- `--stroke-color`: 스트로크 색상 (기본: #000000)
- `--stroke-width`: 스트로크 굵기 (기본: 1.0)
