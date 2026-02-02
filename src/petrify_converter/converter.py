import json
from pathlib import Path

from petrify_converter.excalidraw import ExcalidrawGenerator
from petrify_converter.parser import NoteParser


def convert(
    input_path: Path | str,
    output_path: Path | str,
    *,
    include_background: bool = False,
    stroke_color: str | None = None,
    stroke_width: float | None = None,
) -> None:
    """note 파일을 Excalidraw 포맷으로 변환.

    Args:
        input_path: 입력 note 파일 또는 디렉터리 경로
        output_path: 출력 excalidraw 파일 경로
        include_background: 배경 이미지 포함 여부
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

    generator = ExcalidrawGenerator()
    document = generator.generate(note)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(document, f, ensure_ascii=False, indent=2)
