import pytest
from pathlib import Path


@pytest.fixture
def examples_dir() -> Path:
    return Path(__file__).parent.parent / "examples"


@pytest.fixture
def example_note_files(examples_dir) -> dict[str, Path]:
    files = {}
    for f in examples_dir.iterdir():
        files[f.name] = f
    return files
