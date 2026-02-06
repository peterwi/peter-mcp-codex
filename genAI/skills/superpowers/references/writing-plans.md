# Writing Plans Reference

Detailed guidance for creating implementation plans.

## Overview

Break work into bite-sized tasks that could be executed by an enthusiastic junior engineer with no project context. Plans should be detailed enough that following them mechanically produces correct results.

## Plan Principles

### Task Size
- 2-5 minutes of focused work per task
- If larger, break it down further
- One logical change per task

### Task Independence
- Tasks should be completable in isolation where possible
- Explicitly note dependencies when they exist
- Order tasks to minimise blocking

### Completeness
- Include exact file paths
- Include complete code (not pseudocode)
- Include verification commands
- Include commit messages

## Plan Structure

```markdown
# Implementation Plan: [Feature Name]

**Design:** [Link to design document]
**Branch:** [Branch name]
**Date:** YYYY-MM-DD

## Prerequisites
- [Any setup required]
- [Dependencies to install]

## Tasks

### Task 1: [Brief descriptive title]

**Files:** `path/to/file.py`

**Changes:**
- Create function `process_data()` that:
  - Takes `data: list[dict]` parameter
  - Validates input is not empty
  - Returns processed `Result` object

**Code:**
```python
def process_data(data: list[dict]) -> Result:
    if not data:
        raise ValueError("Data cannot be empty")
    # ... rest of implementation
```

**Verification:**
```bash
pytest tests/test_processor.py::test_process_data -v
```

**Commit:** "Add process_data function for data transformation"

---

### Task 2: [Next task...]
```

## Task Template

```markdown
### Task N: [Title]

**Files:** `path/to/file.ext` [, `other/file.ext`]

**Changes:**
- [Specific change 1]
- [Specific change 2]

**Code:** (if applicable)
```language
[Complete, copy-pasteable code]
```

**Verification:**
```bash
[Command to verify task is complete]
```

**Commit:** "[Conventional commit message]"

**Dependencies:** Task M (if applicable)
```

## Good Task Examples

### Good: Specific and Complete
```markdown
### Task 3: Add input validation to UserService.create()

**Files:** `src/services/user_service.py`

**Changes:**
- Add validation for email format using regex
- Raise `ValidationError` for invalid input
- Add test for invalid email case

**Code:**
```python
import re

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

def create(self, email: str, name: str) -> User:
    if not re.match(EMAIL_REGEX, email):
        raise ValidationError(f"Invalid email format: {email}")
    # ... existing code
```

**Verification:**
```bash
pytest tests/test_user_service.py -k "test_create" -v
```

**Commit:** "Add email validation to UserService.create()"
```

### Bad: Vague and Incomplete
```markdown
### Task 3: Add validation

**Changes:**
- Validate user input

**Verification:** Run tests
```

## Verification Commands

Always include runnable verification:

```bash
# Unit tests
pytest tests/test_module.py -v

# Specific test
pytest tests/test_module.py::TestClass::test_method -v

# Type checking
mypy src/module.py

# Linting
ruff check src/module.py

# Integration test
./scripts/test-integration.sh

# Manual verification
curl -X POST localhost:8000/api/endpoint -d '{"key": "value"}'
```

## Commit Message Convention

Use conventional commits:

```
feat: Add new feature
fix: Fix bug in X
refactor: Restructure Y without changing behaviour
test: Add tests for Z
docs: Update documentation
chore: Maintenance task
```

## Plan Review Checklist

Before finalising:

- [ ] Each task is 2-5 minutes of work
- [ ] All file paths are exact
- [ ] Code is complete (not pseudocode)
- [ ] Verification commands are runnable
- [ ] Tasks can be executed in order
- [ ] Dependencies are noted
- [ ] Commit messages are meaningful
- [ ] No task does "multiple things"
- [ ] Edge cases are separate tasks
- [ ] Tests come before or with implementation (TDD)
