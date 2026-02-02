from dataclasses import dataclass
from datetime import datetime

from petrify_converter.models.page import Page


@dataclass
class Note:
    title: str
    pages: list[Page]
    created_at: datetime
    modified_at: datetime
