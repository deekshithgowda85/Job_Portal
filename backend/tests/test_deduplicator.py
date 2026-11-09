"""Tests for the deduplicator fingerprint logic."""

import pytest
from pipeline.deduplicator import build_fingerprint


def test_fingerprint_is_deterministic():
    fp1 = build_fingerprint("Google", "Software Engineer", "Bangalore")
    fp2 = build_fingerprint("Google", "Software Engineer", "Bangalore")
    assert fp1 == fp2


def test_fingerprint_case_insensitive():
    fp1 = build_fingerprint("GOOGLE", "Software Engineer", "BANGALORE")
    fp2 = build_fingerprint("google", "software engineer", "bangalore")
    assert fp1 == fp2


def test_fingerprint_strips_whitespace():
    fp1 = build_fingerprint("  Google  ", "  Software Engineer  ", " Bangalore ")
    fp2 = build_fingerprint("Google", "Software Engineer", "Bangalore")
    assert fp1 == fp2


def test_fingerprint_different_locations_differ():
    fp1 = build_fingerprint("Google", "Software Engineer", "Bangalore")
    fp2 = build_fingerprint("Google", "Software Engineer", "Hyderabad")
    assert fp1 != fp2


def test_fingerprint_different_companies_differ():
    fp1 = build_fingerprint("Google", "Software Engineer", "Bangalore")
    fp2 = build_fingerprint("Microsoft", "Software Engineer", "Bangalore")
    assert fp1 != fp2


def test_fingerprint_different_titles_differ():
    fp1 = build_fingerprint("Google", "Software Engineer", "Bangalore")
    fp2 = build_fingerprint("Google", "Senior Software Engineer", "Bangalore")
    assert fp1 != fp2
