"""Tests for the job normalizer."""

import pytest
from models import ExperienceLevel, JobType, RawJob
from pipeline.normalizer import detect_experience, detect_job_type, normalize, parse_date


# ─── Job type detection ───────────────────────────────────────────────────────

@pytest.mark.parametrize("title,expected", [
    ("Software Engineer Intern", JobType.INTERNSHIP),
    ("Graduate Engineer Trainee", JobType.FULL_TIME),
    ("Contract Backend Developer", JobType.CONTRACT),
    ("Part-Time Data Analyst", JobType.PART_TIME),
    ("Senior Software Engineer", JobType.FULL_TIME),
    ("Java Developer", JobType.FULL_TIME),
])
def test_detect_job_type(title, expected):
    assert detect_job_type(title) == expected


# ─── Experience level detection ──────────────────────────────────────────────

@pytest.mark.parametrize("title,expected", [
    ("Software Engineer Fresher", ExperienceLevel.FRESHER),
    ("Junior Backend Developer", ExperienceLevel.JUNIOR),
    ("Senior Software Engineer", ExperienceLevel.SENIOR),
    ("Lead Platform Engineer", ExperienceLevel.LEAD),
    ("Java Developer", ExperienceLevel.UNKNOWN),
    ("Associate Software Engineer", ExperienceLevel.JUNIOR),
    ("Principal Engineer", ExperienceLevel.LEAD),
])
def test_detect_experience(title, expected):
    assert detect_experience(title) == expected


# ─── Date parsing ─────────────────────────────────────────────────────────────

def test_parse_iso_date():
    dt = parse_date("2024-05-01T10:30:00Z")
    assert dt is not None
    assert dt.year == 2024
    assert dt.month == 5


def test_parse_epoch_ms():
    # 2024-01-01 00:00:00 UTC in milliseconds
    dt = parse_date("1704067200000")
    assert dt is not None
    assert dt.year == 2024


def test_parse_none():
    assert parse_date(None) is None
    assert parse_date("") is None


# ─── Full normalize ───────────────────────────────────────────────────────────

def test_normalize_basic():
    raw = RawJob(
        source="greenhouse",
        company="Stripe",
        title="  Software Engineer Intern  ",
        location="  Bangalore  ",
        url="https://stripe.com/jobs/1",
        fingerprint="abc123",
    )
    result = normalize(raw)
    assert result.title == "Software Engineer Intern"
    assert result.location == "Bangalore"
    assert result.job_type == JobType.INTERNSHIP
    assert result.fingerprint == "abc123"


def test_normalize_caps_description():
    raw = RawJob(
        source="workday",
        company="Google",
        title="SDE",
        url="https://google.com/jobs/1",
        description="x" * 10000,
        fingerprint="xyz",
    )
    result = normalize(raw)
    assert len(result.description) <= 5000
