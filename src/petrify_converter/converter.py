import json
from pathlib import Path

from petrify_converter.excalidraw import ExcalidrawGenerator
from petrify_converter.excalidraw_md import ExcalidrawMdGenerator
from petrify_converter.parser import NoteParser


def convert(
    input_path: Path | str,
    output_path: Path | str,
    *,
    include_background: bool = True,
    stroke_color: str | None = None,
    stroke_width: float | None = None,
) -> None:
    """note 파일을 Excalidraw 포맷으로 변환.

    Args:
        input_path: 입력 note 파일 또는 디렉터리 경로
        output_path: 출력 파일 경로 (.excalidraw.md 또는 .excalidraw)
        include_background: 배경 이미지 포함 여부 (기본: True)
        stroke_color: 스트로크 색상 (기본: #000000)
        stroke_width: 스트로크 굵기 (기본: 1.0)
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    parser = NoteParser(input_path)
    note = parser.parse()

    if stroke_color is not None or stroke_width is not None:
        for page in note.pages:
            for stroke in page.strokes:
                if stroke_color is not None:
                    stroke.color = stroke_color
                if stroke_width is not None:
                    stroke.width = stroke_width

    generator = ExcalidrawGenerator(include_background=include_background)
    document = generator.generate(note)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    embedded_files: dict[str, bytes] = {}
    if include_background:
        embedded_files = _save_background_images(note, output_path, document)

    if output_path.suffix == ".md" or output_path.name.endswith(".excalidraw.md"):
        md_generator = ExcalidrawMdGenerator()
        content = md_generator.generate(document, embedded_files)
        output_path.write_text(content, encoding="utf-8")
    else:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(document, f, ensure_ascii=False, indent=2)


def _save_background_images(
    note, output_path: Path, document: dict
) -> dict[str, bytes]:
    """배경 이미지를 별도 파일로 저장하고 파일 매핑 반환."""
    embedded_files: dict[str, bytes] = {}
    image_elements = [e for e in document["elements"] if e["type"] == "image"]

    for i, page in enumerate(note.pages):
        if page.background_image is None:
            continue

        if i >= len(image_elements):
            continue

        file_id = image_elements[i]["fileId"]
        image_filename = f"{output_path.stem}_bg_{i}.png"
        image_path = output_path.parent / image_filename

        image_path.write_bytes(page.background_image)
        embedded_files[file_id] = image_filename.encode()

    document["files"] = {}

    return embedded_files
