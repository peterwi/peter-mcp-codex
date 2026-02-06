# Subagent-Driven Development Reference

Execute implementation plans using fresh subagents per task with two-stage review.

## Overview

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration.

## When to Use

- Have an implementation plan with independent tasks
- Want to stay in current session (vs parallel sessions)
- Need autonomous execution with quality gates

## Process Flow

```
Read plan → Extract tasks to TodoWrite → For each task:
  │
  ├─▶ Dispatch implementer subagent
  │     └─▶ Answer questions if asked
  │     └─▶ Implementer completes + self-reviews
  │
  ├─▶ Dispatch spec reviewer subagent
  │     └─▶ If issues: implementer fixes → re-review
  │
  ├─▶ Dispatch code quality reviewer subagent
  │     └─▶ If issues: implementer fixes → re-review
  │
  └─▶ Mark task complete

Final code review → Finishing phase
```

## Subagent Prompts

### Implementer Prompt Template

```markdown
You are implementing a specific task from an implementation plan.

## Context
[Project background, what we're building, relevant architecture]

## Your Task
[Full task text copied from plan, including:
- Files to modify
- Changes to make
- Code snippets
- Verification commands
- Commit message]

## Instructions
1. If anything is unclear, ASK before starting
2. Follow TDD: write failing test first, then implementation
3. Run verification commands before reporting done
4. Self-review checklist:
   - [ ] Tests pass
   - [ ] Code matches task spec exactly
   - [ ] No unrelated changes
   - [ ] Committed with specified message

Report completion with summary of what was done.
```

### Spec Reviewer Prompt Template

```markdown
You are reviewing implementation for SPEC COMPLIANCE only.

## The Task Specification
[Full task text from plan]

## Your Job
Verify the implementation matches the spec EXACTLY:
- Does it do everything requested?
- Does it do ONLY what was requested (no extras)?
- Does the code match any provided snippets?

## Output
If compliant: "APPROVED - Spec compliant"
If issues:
- List what's missing from spec
- List what was added beyond spec
- Do NOT comment on code quality (that's a separate review)
```

### Code Quality Reviewer Prompt Template

```markdown
You are reviewing for CODE QUALITY (spec compliance already verified).

## Review Criteria
- Clean, readable code
- Appropriate test coverage
- No obvious bugs
- Follows project conventions
- No security issues

## Output Format
**Strengths:**
- [What was done well]

**Issues (Critical):** [Blocks approval]
- [Issue and how to fix]

**Issues (Important):** [Should fix]
- [Issue and how to fix]

**Issues (Minor):** [Nice to fix]
- [Issue]

**Verdict:** APPROVED / NEEDS_CHANGES
```

## Controller Responsibilities

### Before Starting
1. Read plan file ONCE at the beginning
2. Extract ALL tasks with full text
3. Note shared context needed by all tasks
4. Create TodoWrite with all tasks

### Per Task
1. Get task text (already extracted)
2. Dispatch implementer with:
   - Full task text
   - Project context
   - Any relevant decisions from previous tasks
3. Answer clarifying questions if asked
4. After completion, dispatch spec reviewer
5. If spec issues: implementer fixes, reviewer re-reviews
6. After spec approval, dispatch quality reviewer
7. If quality issues: implementer fixes, reviewer re-reviews
8. Mark task complete in TodoWrite

### After All Tasks
1. Dispatch final code reviewer for entire implementation
2. Address any cross-cutting issues
3. Proceed to finishing phase

## Review Loops

Reviews are LOOPS, not one-shot:

```
Implementer completes
        │
        ▼
Spec reviewer checks
        │
    ┌───┴───┐
    │issues?│
    └───┬───┘
   yes  │  no
    │   │   │
    ▼   │   ▼
Fix it  │  Quality reviewer
    │   │       │
    └───┘   ┌───┴───┐
            │issues?│
            └───┬───┘
           yes  │  no
            │   │   │
            ▼   │   ▼
         Fix it │  DONE
            │   │
            └───┘
```

## Red Flags

### Never:
- Skip either review stage
- Proceed with unfixed issues
- Run implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text)
- Skip scene-setting context
- Ignore subagent questions
- Accept "close enough" on spec compliance
- Skip re-review after fixes
- Start quality review before spec approval

### If Subagent Asks Questions:
- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

### If Subagent Fails:
- Dispatch fix subagent with specific instructions
- Don't try to fix manually (context pollution)

## Example Session

```
Controller: I'm using Subagent-Driven Development.

[Read plan: docs/plans/2024-01-15-user-auth.md]
[Extract 5 tasks with full text]
[Create TodoWrite with all tasks]

Task 1: Add password hashing utility

[Dispatch implementer with task text + context]

Implementer: "Should I use bcrypt or argon2?"

Controller: "Use argon2, it's already in requirements.txt"

Implementer: "Implementing..."
[Later]
Implementer: Done. Added argon2 hasher, 3 tests passing, committed.

[Dispatch spec reviewer]
Spec reviewer: APPROVED - matches spec exactly

[Dispatch quality reviewer]
Quality reviewer:
- Strengths: Good test coverage
- Issues (Minor): Consider adding docstring
- Verdict: APPROVED

[Mark Task 1 complete]

Task 2: Add user registration endpoint
...
```

## Advantages Over Manual Execution

- Fresh context per task (no confusion from earlier work)
- Subagents follow TDD naturally
- Parallel-safe (subagents don't interfere)
- Questions surfaced before work begins
- Two-stage review catches both spec drift and quality issues
- Review loops ensure fixes actually work
