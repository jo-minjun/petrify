#!/usr/bin/env python3
"""CLI for petrify-converter."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from petrify_converter import convert


def main():
    parser = argparse.ArgumentParser(description="viwoods .note 파일을 Excalidraw로 변환")
    parser.add_argument("input", help="입력 .note 파일 또는 디렉토리")
    parser.add_argument("output", help="출력 파일 또는 디렉토리")
    parser.add_argument("--stroke-color", help="스트로크 색상 (예: #000000)")
    parser.add_argument("--stroke-width", type=float, help="스트로크 굵기")

    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if input_path.is_file():
        print(f"변환 중: {input_path.name}")
        convert(
            input_path,
            output_path,
            stroke_color=args.stroke_color,
            stroke_width=args.stroke_width,
        )
        print(f"완료: {output_path}")
    elif input_path.is_dir():
        note_files = list(input_path.glob("**/*.note"))
        if not note_files:
            print(f"오류: {input_path}에서 .note 파일을 찾을 수 없습니다.")
            sys.exit(1)

        output_path.mkdir(parents=True, exist_ok=True)

        for note_file in note_files:
            output_name = note_file.stem + ".excalidraw.md"
            output_file = output_path / output_name
            print(f"변환 중: {note_file.name} -> {output_name}")
            convert(
                note_file,
                output_file,
                stroke_color=args.stroke_color,
                stroke_width=args.stroke_width,
            )

        print(f"\n총 {len(note_files)}개 파일 변환 완료!")
    else:
        print(f"오류: {input_path}를 찾을 수 없습니다.")
        sys.exit(1)


if __name__ == "__main__":
    main()
