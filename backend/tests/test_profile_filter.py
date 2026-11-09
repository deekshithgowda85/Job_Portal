"""Tests for the profile-based job filter."""

import pytest
from models import ExperienceLevel, JobType, NormalizedJob
from pipeline.profile_filter import ProfileFilter


def make_job(**kwargs) -> NormalizedJob:
    defaults = dict(
        fingerprint="abc",
        source="greenhouse",
        company="Stripe",
        title="Software Engineer",
        location="Bangalore",
        url="https://stripe.com/jobs/1",
        job_type=JobType.FULL_TIME,
        experience_level=ExperienceLevel.FRESHER,
    )
    defaults.update(kwargs)
    return NormalizedJob(**defaults)


# ─── Empty profile passes everything ─────────────────────────────────────────

def test_empty_profile_passes_all():
    pf = ProfileFilter({})
    jobs = [make_job(), make_job(title="Data Scientist")]
    assert len(pf.filter(jobs)) == 2


# ─── Keyword filtering ───────────────────────────────────────────────────────

def test_keyword_match():
    pf = ProfileFilter({"keywords": ["java"]})
    jobs = [
        make_job(title="Java Developer"),
        make_job(title="Python Engineer"),
    ]
    result = pf.filter(jobs)
    assert len(result) == 1
    assert result[0].title == "Java Developer"


def test_keyword_in_description():
    pf = ProfileFilter({"keywords": ["spring boot"]})
    jobs = [
        make_job(title="Backend Developer", description="Requires knowledge of Spring Boot"),
        make_job(title="Frontend Developer", description="React skills needed"),
    ]
    result = pf.filter(jobs)
    assert len(result) == 1


# ─── Exclude keywords ────────────────────────────────────────────────────────

def test_exclude_keyword_drops_job():
    pf = ProfileFilter({"exclude_keywords": ["director"]})
    jobs = [
        make_job(title="Director of Engineering"),
        make_job(title="Software Engineer"),
    ]
    result = pf.filter(jobs)
    assert len(result) == 1
    assert result[0].title == "Software Engineer"


# ─── Location filtering ──────────────────────────────────────────────────────

def test_location_filter():
    pf = ProfileFilter({"locations": ["bangalore"]})
    jobs = [
        make_job(location="Bangalore, India"),
        make_job(location="New York, USA"),
    ]
    result = pf.filter(jobs)
    assert len(result) == 1


def test_remote_always_passes_when_location_set():
    pf = ProfileFilter({"locations": ["bangalore"]})
    jobs = [make_job(location="Remote")]
    result = pf.filter(jobs)
    assert len(result) == 1


# ─── Experience level filtering ──────────────────────────────────────────────

def test_experience_filter():
    pf = ProfileFilter({"experience_levels": ["fresher", "junior"]})
    jobs = [
        make_job(experience_level=ExperienceLevel.FRESHER),
        make_job(experience_level=ExperienceLevel.SENIOR),
        make_job(experience_level=ExperienceLevel.JUNIOR),
    ]
    result = pf.filter(jobs)
    assert len(result) == 2


def test_only_fresher_and_junior_are_allowed():
    pf = ProfileFilter({})
    jobs = [
        make_job(experience_level=ExperienceLevel.FRESHER),
        make_job(experience_level=ExperienceLevel.JUNIOR),
        make_job(experience_level=ExperienceLevel.UNKNOWN),
        make_job(experience_level=ExperienceLevel.SENIOR),
    ]
    result = pf.filter(jobs)
    assert [job.experience_level for job in result] == [
        ExperienceLevel.FRESHER,
        ExperienceLevel.JUNIOR,
    ]


# ─── Company whitelist ───────────────────────────────────────────────────────

def test_company_whitelist():
    pf = ProfileFilter({"companies": ["stripe", "google"]})
    jobs = [
        make_job(company="Stripe"),
        make_job(company="Meta"),
        make_job(company="Google"),
    ]
    result = pf.filter(jobs)
    assert len(result) == 2
