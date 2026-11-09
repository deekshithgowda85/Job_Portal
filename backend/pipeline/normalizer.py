"""
Normalizer — converts RawJob into a typed NormalizedJob.

Detects:
  - job_type  (full-time / internship / contract / part-time)
  - experience_level  (fresher / junior / mid / senior / lead)
  - posted_on datetime (tries multiple formats)
"""

import re
from datetime import datetime, timezone
from typing import Optional

from models import ExperienceLevel, JobType, NormalizedJob, RawJob

# ─── Regex patterns ───────────────────────────────────────────────────────────

JOB_TYPE_PATTERNS: list[tuple[JobType, list[str]]] = [
    (JobType.INTERNSHIP, [r"\bintern\b", r"\binternship\b", r"\btrainee\b", r"\bapprentice\b"]),
    (JobType.CONTRACT, [r"\bcontract\b", r"\bcontractor\b", r"\bfreelance\b", r"\bconsultant\b", r"\bc2c\b"]),
    (JobType.PART_TIME, [r"\bpart[-\s]time\b"]),
    (JobType.FULL_TIME, [r"\bfull[-\s]time\b", r"\bpermanent\b", r"\bregular\b"]),
]

EXPERIENCE_PATTERNS: list[tuple[ExperienceLevel, list[str]]] = [
    (ExperienceLevel.FRESHER, [
        r"\bfresher\b", r"\bfresh graduate\b", r"\b0[-–]1\s*years?\b",
        r"\bentry[-\s]level\b", r"\bgraduate engineer\b", r"\bgraduate\b",
        r"\bintern(ship)?\b", r"\b2027[-\s]?batch\b", r"\bcampus\b",
        r"\bjunior software engineer\b",
    ]),
    (ExperienceLevel.JUNIOR, [
        r"\bjunior\b", r"\bassociate\b", r"\b1[-–]3\s*years?\b", r"\b1[-–]2\s*years?\b",
    ]),
    (ExperienceLevel.MID, [
        r"\bmid[-\s]level\b", r"\b3[-–]5\s*year\b", r"\b2[-–]4\s*year\b",
    ]),
    (ExperienceLevel.SENIOR, [
        r"\bsenior\b", r"\bsr\.\b", r"\b5\+?\s*year\b", r"\b6\+?\s*year\b",
        r"\b7\+?\s*year\b",
    ]),
    (ExperienceLevel.LEAD, [
        r"\blead\b", r"\bprincipal\b", r"\bstaff\b", r"\barchitect\b",
        r"\bdirector\b", r"\bvp\b", r"\bhead of\b",
    ]),
]

# Multiple date formats Workday / Greenhouse / Lever use
DATE_FORMATS = [
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S+00:00",
    "%Y-%m-%d",
    "%B %d, %Y",
    "%d %B %Y",
]


def _detect(text: str, patterns_list: list[tuple]) -> Optional[object]:
    lowered = text.lower()
    for label, patterns in patterns_list:
        if any(re.search(p, lowered) for p in patterns):
            return label
    return None


def detect_job_type(title: str, description: str = "") -> JobType:
    result = _detect(f"{title} {description}", JOB_TYPE_PATTERNS)
    return result or JobType.FULL_TIME


def detect_experience(title: str, description: str = "") -> ExperienceLevel:
    result = _detect(f"{title} {description}", EXPERIENCE_PATTERNS)
    return result or ExperienceLevel.UNKNOWN


def parse_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None

    raw = raw.strip()

    # Lever uses millisecond epoch integers (as strings)
    if raw.isdigit() and len(raw) >= 10:
        try:
            ts = int(raw)
            if len(raw) == 13:  # milliseconds
                ts //= 1000
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except (ValueError, OSError):
            pass

    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return None


def normalize(raw: RawJob) -> NormalizedJob:
    description = raw.description or ""
    title = raw.title
    detected_experience = detect_experience(title, description)
    if detected_experience == ExperienceLevel.UNKNOWN:
        search_experience = str(raw.raw_data.get("search_experience", ""))
        detected_experience = {
            "0": ExperienceLevel.FRESHER,
            "1": ExperienceLevel.JUNIOR,
        }.get(search_experience, detected_experience)

    return NormalizedJob(
        fingerprint=raw.fingerprint or "",
        source=raw.source,
        company=raw.company.strip(),
        title=title.strip(),
        location=raw.location.strip() if raw.location else None,
        url=raw.url.strip(),
        description=description[:5000] if description else None,  # cap size
        job_type=detect_job_type(title, description),
        experience_level=detected_experience,
        salary_range=raw.salary_range,
        tags=raw.tags,
        posted_on=parse_date(raw.posted_on),
    )
