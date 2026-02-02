import json
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from petrify_converter.color_extractor import ColorExtractor
from petrify_converter.exceptions import InvalidNoteFileError, ParseError
from petrify_converter.models import Note, Page, Point, Stroke


class NoteParser:
    RESOURCE_TYPE_MAINBMP = 1
    RESOURCE_TYPE_PATH = 7
    DEFAULT_GAP_THRESHOLD = 6
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

    def _parse_page_resource(self) -> dict[str, str]:
        """PageResource.json 파싱하여 path ID -> mainBmp 파일명 매핑 생성."""
        resource_file = self._find_file_by_suffix("_PageResource.json")
        if resource_file is None:
            return {}

        try:
            resources = json.loads(resource_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

        mainbmp_by_id: dict[str, str] = {}
        path_id_to_mainbmp_id: dict[str, str] = {}

        for res in resources:
            res_type = res.get("resourceType")
            res_id = res.get("id", "")
            filename = res.get("fileName", "")
            nickname = res.get("nickname", "")

            if res_type == self.RESOURCE_TYPE_MAINBMP:
                mainbmp_by_id[res_id] = filename
            elif res_type == self.RESOURCE_TYPE_PATH:
                path_id_to_mainbmp_id[nickname] = nickname

        result: dict[str, str] = {}
        for path_nickname, mainbmp_id in path_id_to_mainbmp_id.items():
            if mainbmp_id in mainbmp_by_id:
                result[path_nickname] = mainbmp_by_id[mainbmp_id]

        return result

    def _find_mainbmp_files(self) -> list[Path]:
        """mainBmp_*.png 파일 찾기."""
        if self._is_directory:
            search_dir = self.path
        else:
            search_dir = self._extracted_dir

        if search_dir is None:
            return []

        return list(search_dir.glob("mainBmp_*.png"))

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
        path_to_mainbmp = self._parse_page_resource()
        mainbmp_files = self._find_mainbmp_files()
        pages = []

        for path_file in path_files:
            page_id = path_file.stem.replace("path_", "")

            background_image = self._load_mainbmp(
                page_id, path_to_mainbmp, mainbmp_files
            )

            strokes = self._parse_strokes(path_file, background_image)

            page = Page(
                id=page_id,
                strokes=strokes,
                background_image=background_image,
            )
            pages.append(page)

        return pages if pages else [Page(id="empty", strokes=[])]

    def _load_mainbmp(
        self,
        page_id: str,
        path_to_mainbmp: dict[str, str],
        mainbmp_files: list[Path],
    ) -> bytes | None:
        """mainBmp 이미지 로드."""
        search_dir = self.path if self._is_directory else self._extracted_dir
        if search_dir is None:
            return None

        if page_id in path_to_mainbmp:
            mainbmp_path = search_dir / path_to_mainbmp[page_id]
            if mainbmp_path.exists():
                return mainbmp_path.read_bytes()

        if len(mainbmp_files) == 1:
            return mainbmp_files[0].read_bytes()

        return None

    def _parse_strokes(self, path_file: Path, mainbmp_data: bytes | None) -> list[Stroke]:
        """스트로크 파싱 (mainBmp에서 색상 추출 포함)."""
        try:
            data = json.loads(path_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ParseError(f"Failed to parse stroke data: {e}")

        if not data:
            return []

        if mainbmp_data is None:
            return Stroke.split_by_timestamp_gap(data, gap_threshold=self.DEFAULT_GAP_THRESHOLD)

        extractor = ColorExtractor(mainbmp_data)
        return self._split_strokes_with_color(data, extractor)

    def _split_strokes_with_color(
        self, data: list[list], extractor: ColorExtractor
    ) -> list[Stroke]:
        """색상 변경 또는 timestamp gap으로 스트로크 분리."""
        if not data:
            return []

        sorted_data = sorted(data, key=lambda p: p[2])

        strokes = []
        current_points: list[Point] = []
        current_color: str | None = None
        current_alpha: int | None = None

        for i, point_data in enumerate(sorted_data):
            x, y = int(point_data[0]), int(point_data[1])
            color, alpha = extractor.get_color_at(x, y)

            is_background = color.lower() in ColorExtractor.BACKGROUND_COLORS

            if is_background:
                if current_color is not None:
                    color = current_color
                    alpha = current_alpha
                else:
                    color = "#000000"
                    alpha = 255

            if i > 0:
                prev_ts = sorted_data[i - 1][2]
                curr_ts = point_data[2]
                gap = curr_ts - prev_ts

                color_changed = (
                    current_color is not None
                    and not is_background
                    and color != current_color
                )

                if gap >= self.DEFAULT_GAP_THRESHOLD or color_changed:
                    if current_points:
                        opacity = int((current_alpha / 255) * 100) if current_alpha else 100
                        strokes.append(
                            Stroke(
                                points=current_points,
                                color=current_color or "#000000",
                                opacity=opacity,
                            )
                        )
                    current_points = []

            current_points.append(Point.from_list(point_data))
            if not is_background or current_color is None:
                current_color = color
                current_alpha = alpha

        if current_points:
            opacity = int((current_alpha / 255) * 100) if current_alpha else 100
            strokes.append(
                Stroke(
                    points=current_points,
                    color=current_color or "#000000",
                    opacity=opacity,
                )
            )

        return strokes

    @staticmethod
    def _timestamp_to_datetime(timestamp: int) -> datetime:
        """밀리초 타임스탬프를 datetime으로 변환."""
        if timestamp == 0:
            return datetime.now()
        return datetime.fromtimestamp(timestamp / 1000)
