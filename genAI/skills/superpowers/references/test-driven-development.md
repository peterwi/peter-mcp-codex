# Test-Driven Development Reference

Disciplined RED-GREEN-REFACTOR cycle for all implementation work.

## The Cycle

```
   ┌────────────────────────────────────────┐
   │                                        │
   │    RED: Write failing test             │
   │         Run test, watch it FAIL        │
   │                   │                    │
   │                   ▼                    │
   │    GREEN: Write minimal code           │
   │           Run test, watch it PASS      │
   │                   │                    │
   │                   ▼                    │
   │    REFACTOR: Clean up code             │
   │              Tests still pass          │
   │                   │                    │
   │                   ▼                    │
   │    COMMIT: Save working increment      │
   │                   │                    │
   └───────────────────┴────────────────────┘
                       │
                       ▼
              Next test cycle
```

## The Rules

### Rule 1: No Production Code Without a Failing Test
Write the test FIRST. If you catch yourself writing implementation code, STOP. Delete it. Write the test.

### Rule 2: One Test at a Time
Don't write multiple tests then implement. Write ONE test, make it pass, repeat.

### Rule 3: Minimal Code to Pass
Resist the urge to add "obvious" improvements. Write the absolute minimum code that makes the test pass. Trust the process - future tests will drive additional code.

### Rule 4: Tests Must Actually Fail First
Run the test before writing implementation. If it passes, your test is wrong (testing the wrong thing or the feature already exists).

### Rule 5: Refactor Only When Green
Never refactor while tests are failing. Get to green first, then clean up.

## RED Phase

### Write a Test That:
- Tests ONE specific behaviour
- Has a descriptive name explaining what it tests
- Is independent of other tests
- Fails for the right reason

### Test Structure (AAA Pattern):
```python
def test_user_can_register_with_valid_email():
    # Arrange - Set up test data
    email = "user@example.com"
    password = "secure123"

    # Act - Perform the action
    result = user_service.register(email, password)

    # Assert - Verify the outcome
    assert result.success is True
    assert result.user.email == email
```

### Run and Verify Failure:
```bash
pytest tests/test_user.py::test_user_can_register_with_valid_email -v
```

Expected: Test FAILS (feature doesn't exist yet)

If test passes: Your test is wrong. Fix the test.

## GREEN Phase

### Write Minimal Implementation:
- Just enough to make the test pass
- Don't add error handling "for later"
- Don't add features the test doesn't require
- Hard-code values if that's all the test needs

### Example Progression:
```python
# Test: assert calculate_total([10, 20]) == 30

# GREEN attempt 1 (minimal):
def calculate_total(items):
    return 30  # Hard-coded!

# This passes. Next test will force real implementation:
# Test: assert calculate_total([5, 5, 5]) == 15

# GREEN attempt 2:
def calculate_total(items):
    return sum(items)  # Now we need real logic
```

### Run and Verify Success:
```bash
pytest tests/test_calc.py -v
```

Expected: Test PASSES

## REFACTOR Phase

### Only When Green
All tests must pass before refactoring. Never refactor with failing tests.

### Refactoring Checklist:
- [ ] Remove duplication (DRY)
- [ ] Improve naming
- [ ] Extract helper functions
- [ ] Simplify complex conditionals
- [ ] Add type hints

### After Each Change:
```bash
pytest tests/ -v
```

Tests must still pass. If they fail, undo refactoring.

## COMMIT Phase

Commit after each successful RED-GREEN-REFACTOR cycle:

```bash
git add -A
git commit -m "Add user registration with valid email"
```

Small, frequent commits make debugging easier.

## Common Anti-Patterns

### Testing Mock Behaviour
```python
# BAD: Tests that the mock was called, not that code works
mock_db.save.assert_called_once()

# GOOD: Tests actual behaviour
assert user_service.get(user_id).email == expected_email
```

### Test-Only Methods
```python
# BAD: Adding methods just for tests
class User:
    def _test_get_internal_state(self):  # Don't do this
        return self._internal

# GOOD: Test through public interface
```

### Multiple Assertions Per Test
```python
# BAD: Testing multiple things
def test_user():
    assert user.name == "Alice"
    assert user.email == "alice@test.com"
    assert user.is_active is True
    assert len(user.roles) == 2

# GOOD: Focused tests
def test_user_has_expected_name():
    assert user.name == "Alice"

def test_new_user_is_active():
    assert user.is_active is True
```

### Incomplete Mocks
```python
# BAD: Mock that hides structural assumptions
mock_api.get.return_value = {"data": "value"}

# GOOD: Use real objects or complete fakes
fake_api = FakeApiClient(responses={"endpoint": {"data": "value"}})
```

## TDD Flow Chart

```
Start implementing feature
        │
        ▼
Write test for smallest unit of behaviour
        │
        ▼
Run test ──────────────────┐
        │                  │
    Passes?                │
   yes │  no               │
    │  │                   │
    │  └──▶ Good! (RED)    │
    │          │           │
    │          ▼           │
    │   Write minimal code │
    │          │           │
    │          ▼           │
    │      Run test ◀──────┘
    │          │
    │      Passes?
    │     yes │  no
    │      │  │
    │      │  └──▶ Fix code, try again
    │      │
    │      ▼
    │   Refactor?
    │  yes │  no
    │   │  │
    │   │  └──▶ Commit
    │   │          │
    │   ▼          │
    │ Refactor     │
    │   │          │
    │   ▼          │
    │ Run tests    │
    │   │          │
    │ Pass?        │
    │ yes│ no      │
    │  │ │         │
    │  │ └▶ Undo   │
    │  │           │
    │  └──▶ Commit │
    │          │   │
    └──────────┴───┘
              │
              ▼
        More behaviour?
       yes │      no
        │  │       │
        │  │       ▼
        │  │    DONE
        │  │
        └──┴──▶ Next test
```

## Quick Commands

```bash
# Run single test
pytest tests/test_file.py::test_name -v

# Run tests matching pattern
pytest -k "test_user" -v

# Run with coverage
pytest --cov=src --cov-report=term-missing

# Run tests and stop on first failure
pytest -x -v

# Watch mode (with pytest-watch)
ptw tests/
```
