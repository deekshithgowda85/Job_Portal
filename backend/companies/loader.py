"""
Loads company and profile configs from YAML files.
"""

from pathlib import Path

import yaml

COMPANIES_FILE = Path(__file__).parent / "companies.yaml"
COMPANY_URLS_FILE = Path(__file__).parent / "company_urls.yaml"
PROFILE_FILE = Path(__file__).parent.parent / "profile.yaml"


def load_companies() -> dict[str, list[dict]]:
    """
    Returns a dict keyed by crawler source name.
    Example: { "workday": [...], "greenhouse": [...], "linkedin": [...] }
    """
    with open(COMPANIES_FILE, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data or {}


def load_profile() -> dict:
    """
    Returns the user's matching profile from profile.yaml.
    Returns empty dict if file doesn't exist.
    """
    if not PROFILE_FILE.exists():
        return {}
    with open(PROFILE_FILE, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_company_urls() -> list[dict]:
    """Return cleaned company career portal entries."""
    if not COMPANY_URLS_FILE.exists():
        return []
    with open(COMPANY_URLS_FILE, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, list):
        raise ValueError(f"{COMPANY_URLS_FILE} must contain a list")
    for index, entry in enumerate(data):
        if (
            not isinstance(entry, dict)
            or not isinstance(entry.get("company"), str)
            or not entry["company"].strip()
            or not isinstance(entry.get("url"), str)
            or not entry["url"].startswith(("http://", "https://"))
        ):
            raise ValueError(
                f"{COMPANY_URLS_FILE} entry {index} must contain "
                "non-empty company and absolute http(s) url"
            )
    return data
