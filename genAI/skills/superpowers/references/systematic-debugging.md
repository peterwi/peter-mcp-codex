# Systematic Debugging Reference

4-phase process for finding and fixing bugs.

## Overview

Debugging is a systematic process, not guesswork. Follow these phases in order.

## Phase 1: Reproduce

### Create Minimal Reproduction
Before fixing anything, reproduce the bug reliably.

**Steps:**
1. Document exact steps to trigger the bug
2. Note environment details (OS, versions, config)
3. Create minimal test case that fails
4. Verify reproduction is consistent

**Reproduction Checklist:**
- [ ] Can trigger bug on demand
- [ ] Removed unrelated code/config
- [ ] Documented exact steps
- [ ] Have failing test (if possible)

**Example:**
```bash
# Reproduction steps:
1. Start server: python -m app serve
2. Send request: curl -X POST localhost:8000/api/users -d '{"email": ""}'
3. Expected: 400 Bad Request with validation error
4. Actual: 500 Internal Server Error
```

### If Can't Reproduce
- Check environment differences
- Look for race conditions
- Check for state dependencies
- Add more logging and wait for recurrence

## Phase 2: Isolate

### Binary Search for Root Cause

Narrow down where the bug occurs using bisection.

**Code Bisection:**
```
Start of execution ──────────────────────── End/error
        │                                       │
        └─── Works here? ────┬──── Bug here? ───┘
                            │
                     Continue bisecting
```

**Git Bisection:**
```bash
git bisect start
git bisect bad HEAD              # Current commit is broken
git bisect good abc123           # Known good commit
# Git checks out middle commit
# Test and mark good/bad until found
git bisect reset
```

**Isolation Checklist:**
- [ ] Know which component is failing
- [ ] Know which function/method is failing
- [ ] Have narrowed to smallest code unit
- [ ] Can trigger with minimal setup

## Phase 3: Understand

### Trace Backwards Through Call Stack

Start at the error and work backwards to find root cause.

**Root Cause Tracing:**
```
Error occurs in function D
        │
        └─ Called by function C
                │
                └─ Called by function B
                        │
                        └─ Called by function A
                                │
                                └─ Root cause: Bad input from A
```

**Questions to Answer:**
1. What is the immediate cause of the error?
2. Why did that happen?
3. What's the underlying assumption that was violated?
4. Where should validation/checks have caught this?

**Debugging Commands:**
```python
# Add tracing
import traceback
traceback.print_stack()

# Add logging
import logging
logging.basicConfig(level=logging.DEBUG)
logger.debug(f"Variable state: {var}")

# Interactive debugging
import pdb; pdb.set_trace()  # or breakpoint() in Python 3.7+
```

### Understanding Checklist:
- [ ] Know exact line causing error
- [ ] Know why that line fails
- [ ] Know what correct behaviour should be
- [ ] Know root cause (not just symptom)

## Phase 4: Fix

### Apply Minimal Targeted Fix

Fix the root cause, not the symptom.

**Fix Principles:**
1. Change minimum code necessary
2. Add test that would have caught the bug
3. Verify fix doesn't break other things
4. Consider if similar bugs exist elsewhere

**Fix Workflow:**
```
1. Write failing test for the bug
2. Verify test fails for the right reason
3. Apply minimal fix
4. Verify test passes
5. Run full test suite
6. Commit with descriptive message
```

**Commit Message Format:**
```
fix: Prevent NullPointerException when user email is empty

Root cause: UserService.validate() didn't check for null email
before calling email.contains().

Added null check and corresponding test case.

Fixes #123
```

### Fix Checklist:
- [ ] Test written that reproduces bug
- [ ] Fix is minimal and targeted
- [ ] All existing tests still pass
- [ ] No regressions introduced
- [ ] Similar bugs checked for elsewhere

## Debugging Techniques

### Print Debugging
```python
print(f"DEBUG: {variable=}")  # Python 3.8+ f-string debugging
```

### Logging Levels
```python
logger.debug("Detailed trace info")
logger.info("Normal operation info")
logger.warning("Something unexpected but handled")
logger.error("Something failed")
```

### Conditional Breakpoints
```python
if condition_of_interest:
    breakpoint()
```

### State Inspection
```python
# Dump object state
import pprint
pprint.pprint(vars(obj))

# Check type
print(type(variable))

# Check call stack
import traceback
traceback.print_stack()
```

## Common Bug Patterns

### Null/None Handling
```python
# Bug: AttributeError on None
user.email.lower()

# Fix: Check for None
if user and user.email:
    user.email.lower()
```

### Off-by-One Errors
```python
# Bug: Index out of bounds
for i in range(len(items) + 1):  # +1 is wrong
    items[i]

# Fix: Correct range
for i in range(len(items)):
    items[i]
```

### Race Conditions
```python
# Bug: Check-then-act race
if file_exists(path):
    # Another process could delete here
    read_file(path)

# Fix: Try-except
try:
    read_file(path)
except FileNotFoundError:
    handle_missing()
```

### State Mutation
```python
# Bug: Mutating shared state
def process(items):
    items.sort()  # Mutates original list!
    return items

# Fix: Work on copy
def process(items):
    sorted_items = sorted(items)  # Returns new list
    return sorted_items
```

## Anti-Patterns to Avoid

### Shotgun Debugging
Making random changes hoping something works.
**Instead:** Follow the 4-phase process systematically.

### Fixing Symptoms
Adding try/except to hide errors.
**Instead:** Find and fix root cause.

### Multiple Changes at Once
Changing several things then testing.
**Instead:** One change at a time, verify each.

### Assuming You Know the Cause
"It must be X" without verification.
**Instead:** Prove with evidence before fixing.

### Declaring Victory Early
"It seems to work now."
**Instead:** Verify with test, run full suite.

## Quick Reference

| Phase | Goal | Output |
|-------|------|--------|
| Reproduce | Trigger bug reliably | Minimal reproduction steps |
| Isolate | Find where bug occurs | Specific function/line |
| Understand | Know why it happens | Root cause identified |
| Fix | Correct the root cause | Tested fix committed |
