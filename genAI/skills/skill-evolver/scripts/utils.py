#!/usr/bin/env python3
"""Utility functions for skill evolution"""

import yaml
from typing import Tuple, List


def validate_skill(content: str) -> Tuple[bool, List[str]]:
    """Validate skill markdown structure with comprehensive checks"""
    errors = []

    if not content.startswith('---'):
        return False, ["Missing YAML frontmatter"]

    parts = content.split('---', 2)
    if len(parts) < 3:
        return False, ["Malformed frontmatter"]

    try:
        meta = yaml.safe_load(parts[1])
        if not isinstance(meta, dict):
            errors.append("Frontmatter not a dict")
        if 'name' not in meta:
            errors.append("Missing 'name'")
        elif not isinstance(meta['name'], str) or not meta['name'].strip():
            errors.append("Invalid 'name' (must be non-empty string)")
        if 'description' not in meta:
            errors.append("Missing 'description'")
        elif not isinstance(meta['description'], str) or not meta['description'].strip():
            errors.append("Invalid 'description' (must be non-empty string)")
    except yaml.YAMLError as e:
        return False, [f"Invalid YAML: {e}"]

    body = parts[2].strip()
    if len(body) < 100:
        errors.append("Body too short (< 100 chars)")
    if '# ' not in body:
        errors.append("No headers in body")
    
    # Additional quality checks
    if len(body) < 500:
        errors.append("Body lacks substance (< 500 chars)")
    if body.count('##') < 2:
        errors.append("Insufficient structure (< 2 subsections)")

    return len(errors) == 0, errors


def parse_criteria_safe(criteria_str: str) -> dict:
    """Safely parse criteria string into weighted dict"""
    criteria = {}
    for item in criteria_str.split(','):
        item = item.strip()
        if ':' not in item:
            continue
        k, v = item.split(':', 1)
        try:
            criteria[k.strip()] = int(v.strip())
        except ValueError:
            continue
    return criteria if criteria else {"correctness": 30, "clarity": 25, "usability": 25, "efficiency": 20}


def calculate_metrics(variants: List) -> dict:
    """Calculate evolution metrics for reporting"""
    valid_count = sum(1 for v in variants if hasattr(v, 'is_valid') and v.is_valid())
    avg_length = sum(len(v.content) for v in variants if hasattr(v, 'content')) / max(len(variants), 1)
    
    return {
        "total_variants": len(variants),
        "valid_variants": valid_count,
        "validity_rate": valid_count / max(len(variants), 1),
        "avg_length": int(avg_length)
    }


if __name__ == "__main__":
    # Self-test
    test = """---
name: test
description: Test skill
---

# Test

## Overview

This is a test skill with enough content to pass validation checks.
"""
    valid, errs = validate_skill(test)
    print(f"Valid: {valid}")
    if errs:
        for e in errs:
            print(f"  - {e}")
