import json
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from petrify_converter.exceptions import InvalidNoteFileError, ParseError
from petrify_converter.models import Note, Page, Stroke


class NoteParser:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        if not self.path.exists():
            raise FileNotFoundError(f"File not found: {self.path}")

        self._extracted_dir: Path | None = None
        self._is_directory = self.path.is_dir()

    def _find_path_files(self) -> list[Path]:
        """path_*.json 파일 찾기."""
        if self._is_directory:
            search_dir = self.path
        else:
            search_dir = self._extracted_dir

        if search_dir is None:
            return []

        return list(search_dir.glob("path_*.json"))

    def _find_file_by_suffix(self, suffix: str) -> Path | None:
        """특정 suffix로 끝나는 파일 찾기."""
        if self._is_directory:
            search_dir = self.path
        else:
            search_dir = self._extracted_dir

        if search_dir is None:
            return None

        for f in search_dir.iterdir():
            if f.name.endswith(suffix):
                return f
        return None

    def parse(self) -> Note:
        """note 파일 파싱."""
        if self._is_directory:
            return self._parse_directory()
        else:
            return self._parse_zip()

    def _parse_zip(self) -> Note:
        """zip 파일 파싱."""
        try:
            with zipfile.ZipFile(self.path, "r") as zf:
                with tempfile.TemporaryDirectory() as tmpdir:
                    zf.extractall(tmpdir)
                    self._extracted_dir = Path(tmpdir)
                    return self._parse_contents()
        except zipfile.BadZipFile:
            raise InvalidNoteFileError(f"Not a valid zip file: {self.path}")

    def _parse_directory(self) -> Note:
        """디렉터리 파싱 (이미 압축 해제된 경우)."""
        return self._parse_contents()

    def _parse_contents(self) -> Note:
        """압축 해제된 내용 파싱."""
        note_info = self._parse_note_info()
        pages = self._parse_pages()

        return Note(
            title=note_info.get("fileName", "Untitled"),
            pages=pages,
            created_at=self._timestamp_to_datetime(note_info.get("creationTime", 0)),
            modified_at=self._timestamp_to_datetime(
                note_info.get("lastModifiedTime", 0)
            ),
        )

    def _parse_note_info(self) -> dict:
        """NoteFileInfo.json 파싱."""
        info_file = self._find_file_by_suffix("_NoteFileInfo.json")
        if info_file is None:
            return {}

        try:
            return json.loads(info_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ParseError(f"Failed to parse NoteFileInfo: {e}")

    def _parse_pages(self) -> list[Page]:
        """페이지 파싱."""
        path_files = self._find_path_files()
        pages = []

        for path_file in path_files:
            page_id = path_file.stem.replace("path_", "")
            strokes = self._parse_strokes(path_file)

            page = Page(
                id=page_id,
                strokes=strokes,
            )
            pages.append(page)

        return pages if pages else [Page(id="empty", strokes=[])]

    def _parse_strokes(self, path_file: Path) -> list[Stroke]:
        """스트로크 파싱."""
        try:
            data = json.loads(path_file.read_text(encoding="utf-8"))
            return Stroke.split_by_timestamp_gap(data, gap_threshold=6)
        except json.JSONDecodeError as e:
            raise ParseError(f"Failed to parse stroke data: {e}")

    @staticmethod
    def _timestamp_to_datetime(timestamp: int) -> datetime:
        """밀리초 타임스탬프를 datetime으로 변환."""
        if timestamp == 0:
            return datetime.now()
        return datetime.fromtimestamp(timestamp / 1000)
