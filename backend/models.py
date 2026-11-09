"""
Core data models shared across the crawler service.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator


class JobType(str, Enum):
    FULL_TIME = "full-time"
    PART_TIME = "part-time"
    INTERNSHIP = "internship"
    CONTRACT = "contract"
    UNKNOWN = "unknown"


class ExperienceLevel(str, Enum):
    FRESHER = "fresher"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    UNKNOWN = "unknown"


class CrawlStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"
    SKIPPED = "skipped"


class RawJob(BaseModel):
    """
    Exactly what the crawler returns — no processing, no normalisation.
    fingerprint is attached by the deduplicator before entering the pipeline.
    """
    source: str
    company: str
    title: str
    location: Optional[str] = None
    url: str
    description: Optional[str] = None
    posted_on: Optional[str] = None
    job_type: Optional[str] = None
    salary_range: Optional[str] = None
    tags: list[str] = []
    raw_data: dict = {}

    # Attached mid-pipeline by Deduplicator
    fingerprint: Optional[str] = None

    @field_validator("title", "company", "url")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class NormalizedJob(BaseModel):
    """
    Cleaned, typed, ready for database insert via portal API.
    """
    fingerprint: str
    source: str
    company: str
    title: str
    location: Optional[str] = None
    url: str
    description: Optional[str] = None
    job_type: JobType = JobType.UNKNOWN
    experience_level: ExperienceLevel = ExperienceLevel.UNKNOWN
    salary_range: Optional[str] = None
    tags: list[str] = []
    posted_on: Optional[datetime] = None


class CrawlResult(BaseModel):
    source: str
    company: str
    status: CrawlStatus = CrawlStatus.SUCCESS
    jobs_found: int = 0
    jobs_new: int = 0
    error: Optional[str] = None
    duration_ms: int = 0


class MatchProfile(BaseModel):
    """
    User-defined matching profile loaded from profile.yaml.
    Used to pre-filter jobs before sending to the portal.
    """
    name: str = "default"
    keywords: list[str] = []
    job_titles: list[str] = []
    locations: list[str] = []
    experience_levels: list[str] = []
    companies: list[str] = []
    exclude_keywords: list[str] = []
    description: str = ""
