"""
Profile Filter — applies the user's matching profile to filter jobs
before they are published to the portal.

Profile is loaded from profile.yaml at the root of the project.
If no profile is defined, all jobs pass through.

Fields in profile.yaml:
  keywords        — job must contain at least one (in title or description)
  job_titles      — job title must fuzzy-match at least one
  locations       — job location must contain at least one (or "remote")
  experience_levels — job experience_level must match one of these
  companies       — whitelist of companies (empty = all companies allowed)
  exclude_keywords — if any of these appear in title/description, skip job
"""

import re
from typing import Optional

import structlog

from models import NormalizedJob

logger = structlog.get_logger()

ALLOWED_EXPERIENCE_LEVELS = {"fresher", "junior"}


class ProfileFilter:
    def __init__(self, profile: dict):
        self.keywords: list[str] = [k.lower() for k in profile.get("keywords", [])]
        self.job_titles: list[str] = [t.lower() for t in profile.get("job_titles", [])]
        self.locations: list[str] = [l.lower() for l in profile.get("locations", [])]
        self.experience_levels: list[str] = [
            e.lower() for e in profile.get("experience_levels", [])
        ]
        self.companies: list[str] = [c.lower() for c in profile.get("companies", [])]
        self.exclude_keywords: list[str] = [
            k.lower() for k in profile.get("exclude_keywords", [])
        ]

        # Profile active only if at least one filter is defined
        self.is_active = any([
            self.keywords,
            self.job_titles,
            self.locations,
            self.experience_levels,
            self.companies,
            self.exclude_keywords,
        ])

    def _text(self, job: NormalizedJob) -> str:
        return f"{job.title} {job.description or ''}".lower()

    def _matches_keywords(self, job: NormalizedJob) -> bool:
        if not self.keywords:
            return True
        text = self._text(job)
        return any(kw in text for kw in self.keywords)

    def _matches_title(self, job: NormalizedJob) -> bool:
        if not self.job_titles:
            return True
        title_lower = job.title.lower()
        return any(t in title_lower for t in self.job_titles)

    def _matches_location(self, job: NormalizedJob) -> bool:
        if not self.locations:
            return True
        job_loc = (job.location or "").lower()
        return any(loc in job_loc or "remote" in job_loc for loc in self.locations)

    def _matches_experience(self, job: NormalizedJob) -> bool:
        if not self.experience_levels:
            return True
        return job.experience_level.value.lower() in self.experience_levels

    def _matches_company(self, job: NormalizedJob) -> bool:
        if not self.companies:
            return True
        return any(c in job.company.lower() for c in self.companies)

    def _has_excluded_keyword(self, job: NormalizedJob) -> bool:
        if not self.exclude_keywords:
            return False
        text = self._text(job)
        return any(kw in text for kw in self.exclude_keywords)

    def passes(self, job: NormalizedJob) -> bool:
        if job.experience_level.value.lower() not in ALLOWED_EXPERIENCE_LEVELS:
            return False

        if not self.is_active:
            return True  # no profile = pass everything

        if self._has_excluded_keyword(job):
            return False

        # At least one of keywords OR title must match
        keyword_or_title = self._matches_keywords(job) or self._matches_title(job)

        return all([
            keyword_or_title,
            self._matches_location(job),
            self._matches_experience(job),
            self._matches_company(job),
        ])

    def filter(self, jobs: list[NormalizedJob]) -> list[NormalizedJob]:
        eligible = [
            job for job in jobs
            if job.experience_level.value.lower() in ALLOWED_EXPERIENCE_LEVELS
        ]
        if not self.is_active:
            return eligible

        passed = [j for j in eligible if self.passes(j)]
        logger.info(
            "profile_filter_applied",
            total=len(jobs),
            passed=len(passed),
            dropped=len(jobs) - len(passed),
        )
        return passed
