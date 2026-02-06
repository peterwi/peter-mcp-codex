---
name: superpowers
description: Complete software development workflow - brainstorm designs, create implementation plans, execute with subagents, and finish branches. Use BEFORE writing any code for new features, modifications, or fixes.
---

# Superpowers Development Workflow

A systematic approach to software development that prevents wasted effort through upfront design, detailed planning, and disciplined execution.

## The Core Rule

**Check for applicable workflows BEFORE any response or action.** Even a 1% chance a workflow applies means you should use it.

Red flags (you're rationalising):
- "This is just a simple question" - Questions are tasks
- "Let me explore first" - Workflows tell you HOW to explore
- "This doesn't need a formal process" - If a workflow exists, use it
- "I'll just do this one thing first" - Check BEFORE doing anything

---

## Workflow Selection

```
User request received
        │
        ▼
┌─────────────────────────────┐
│ Building something new?     │──yes──▶ BRAINSTORMING
│ Adding feature/component?   │         (then PLANNING)
└─────────────────────────────┘
        │no
        ▼
┌─────────────────────────────┐
│ Have an approved plan?      │──yes──▶ EXECUTION
└─────────────────────────────┘
        │no
        ▼
┌─────────────────────────────┐
│ Debugging/fixing a bug?     │──yes──▶ SYSTEMATIC DEBUGGING
└─────────────────────────────┘
        │no
        ▼
┌─────────────────────────────┐
│ Implementation complete?    │──yes──▶ FINISHING
└─────────────────────────────┘
        │no
        ▼
    Standard response
```

---

## Phase 1: Brainstorming

**When:** Before ANY creative work - features, components, modifications.

**Process:**
1. Check project context first (files, docs, recent commits)
2. Ask questions ONE AT A TIME to understand intent
3. Prefer multiple choice questions when possible
4. Propose 2-3 approaches with trade-offs
5. Lead with your recommendation and explain why
6. Present design in 200-300 word sections, validating each
7. Write design to `docs/plans/YYYY-MM-DD-<topic>-design.md`

**Key principles:**
- One question per message
- YAGNI ruthlessly - remove unnecessary features
- Explore alternatives before settling
- Validate incrementally

**See:** [Brainstorming Reference](./references/brainstorming.md)

---

## Phase 2: Writing Plans

**When:** After design approval, before implementation.

**Process:**
1. Break work into bite-sized tasks (2-5 minutes each)
2. Each task includes:
   - Exact file paths to create/modify
   - Complete code snippets (not pseudocode)
   - Verification steps (test commands)
   - Commit message
3. Tasks must be independent where possible
4. Write plan to `docs/plans/YYYY-MM-DD-<feature>.md`

**Task format:**
```markdown
### Task N: [Brief title]
**Files:** `path/to/file.py`
**Changes:**
- Add function X that does Y
**Verification:** `pytest tests/test_file.py -v`
**Commit:** "Add function X for Y"
```

**See:** [Planning Reference](./references/writing-plans.md)

---

## Phase 3: Execution

**When:** Have an approved implementation plan.

### Option A: Subagent-Driven Development (Recommended)

Fresh subagent per task with two-stage review.

**Process:**
1. Read plan, extract all tasks to TodoWrite
2. For each task:
   - Dispatch implementer subagent with full task text
   - Answer any clarifying questions
   - After completion, dispatch spec reviewer subagent
   - If spec issues found → implementer fixes → re-review
   - After spec approval, dispatch code quality reviewer
   - If quality issues → implementer fixes → re-review
   - Mark task complete
3. Final code review of entire implementation
4. Proceed to Finishing phase

**See:** [Subagent Development Reference](./references/subagent-driven-development.md)

### Option B: Batch Execution

Execute in batches with human checkpoints.

**Process:**
1. Present batch of 3-5 tasks
2. Get approval to proceed
3. Execute tasks sequentially
4. Present results for review
5. Repeat until complete

---

## Phase 4: Test-Driven Development

**When:** During ANY implementation work.

**The cycle:**
```
RED    → Write failing test first
       → Run test, watch it FAIL
GREEN  → Write minimal code to pass
       → Run test, watch it PASS
REFACTOR → Clean up (no new functionality)
       → Tests still pass
COMMIT → Commit working increment
```

**Rules:**
- Never write production code without a failing test
- One test at a time
- Minimal code to pass (resist temptation to add more)
- If you wrote code before tests, DELETE IT and start over

**See:** [TDD Reference](./references/test-driven-development.md)

---

## Phase 5: Systematic Debugging

**When:** Fixing bugs, investigating failures.

**4-Phase process:**
1. **Reproduce** - Create minimal reproduction
2. **Isolate** - Binary search to locate root cause
3. **Understand** - Trace backwards through call stack
4. **Fix** - Apply minimal targeted fix

**Never:**
- Guess at fixes
- Make multiple changes at once
- Declare fixed without verification

**See:** [Debugging Reference](./references/systematic-debugging.md)

---

## Phase 6: Finishing a Branch

**When:** All tasks complete, tests passing.

**Process:**
1. Verify all tests pass
2. Run linting/formatting
3. Review changes against original design
4. Present options:
   - Merge to main
   - Create PR for review
   - Keep branch for more work
   - Discard changes
5. Clean up worktree if used

---

## Code Review Protocol

**Before requesting review:**
- All tests pass
- Code is linted/formatted
- Changes match the plan
- No unrelated changes included

**Review checklist:**
- Spec compliance (does it do what was requested?)
- Code quality (clean, maintainable, tested?)
- Security (no vulnerabilities introduced?)
- Performance (no obvious issues?)

---

## Quick Reference

| Phase | Trigger | Output |
|-------|---------|--------|
| Brainstorming | "Build X", "Add Y", "Create Z" | Design document |
| Planning | Approved design | Implementation plan |
| Execution | Approved plan | Working code |
| TDD | Any implementation | Tested code |
| Debugging | Bug reports, failures | Root cause fix |
| Finishing | Tasks complete | Merged/PR'd code |

## Integration

**Required tools:**
- TodoWrite for task tracking
- Git for version control
- Test runner for TDD cycle

**Complementary skills:**
- mcp-builder (for MCP server work)
- tool-development (for CLI tools)
- technical-report-writing (for documentation)
