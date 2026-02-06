# Brainstorming Reference

Detailed guidance for the brainstorming phase of development.

## Overview

Transform rough ideas into fully-formed designs through natural collaborative dialogue. The goal is to understand what you're building BEFORE writing any code.

## Process Flow

```
Understand idea → Explore approaches → Present design → Document → Handoff
```

## Phase 1: Understanding the Idea

### Start with Context
- Check out current project state (files, docs, recent commits)
- Understand existing patterns and conventions
- Note any constraints or dependencies

### Ask Questions One at a Time
- Focus on understanding: purpose, constraints, success criteria
- Prefer multiple choice when possible
- Break complex topics into multiple questions
- Never ask more than one question per message

### Good question examples:
```
"What problem does this solve for users?"

"Which approach do you prefer?
A) Simple inline validation (faster to implement)
B) Separate validation layer (more flexible)
C) Both, with config flag"

"What happens if the API is unavailable?"
```

### Bad question patterns:
```
"What should this do and how should it work and what edge cases matter?"
(Too many questions at once)

"Tell me everything about the requirements"
(Too open-ended)
```

## Phase 2: Exploring Approaches

### Always Propose Options
- Present 2-3 different approaches
- Include trade-offs for each
- Lead with your recommendation

### Format:
```markdown
I'd recommend **Option A** because [reason].

**Option A: [Name]**
- Pros: [benefits]
- Cons: [drawbacks]
- Best when: [use case]

**Option B: [Name]**
- Pros: [benefits]
- Cons: [drawbacks]
- Best when: [use case]

What do you think?
```

## Phase 3: Presenting the Design

### Break Into Sections
- 200-300 words per section
- Ask for validation after each section
- Cover: architecture, components, data flow, error handling, testing

### Section Template:
```markdown
## [Section Name]

[200-300 words of content]

---

Does this look right so far? Any concerns or changes?
```

### Areas to Cover:
1. **Architecture Overview** - High-level structure
2. **Core Components** - Main building blocks
3. **Data Flow** - How data moves through the system
4. **Error Handling** - Failure modes and recovery
5. **Testing Strategy** - How to verify correctness
6. **Edge Cases** - Boundary conditions

## Phase 4: Documentation

### Save the Design
Write validated design to: `docs/plans/YYYY-MM-DD-<topic>-design.md`

### Document Structure:
```markdown
# [Feature Name] Design

## Overview
[Brief summary]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Architecture
[Architecture decisions]

## Components
[Component details]

## Testing
[Testing approach]

## Open Questions
[Any remaining uncertainties]
```

## YAGNI Checklist

Before finalising, ruthlessly eliminate:
- Features "we might need later"
- Abstractions without current use cases
- Configuration options nobody asked for
- Performance optimisations without evidence of need
- Error handling for impossible scenarios

## Handoff to Implementation

After design approval:
1. Ask: "Ready to set up for implementation?"
2. Create isolated workspace (git worktree or branch)
3. Run project setup and verify clean test baseline
4. Proceed to writing-plans phase
