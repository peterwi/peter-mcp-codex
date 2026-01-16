---
name: technical-system-research
description: "Comprehensive investigation and analysis of complex technical systems combining documentation research, code analysis, and architecture understanding. Use when investigating infrastructure components, trading platforms, distributed systems, understanding architecture through code and documentation, creating technical analysis documents, comparing related systems, or gathering post-mortem or onboarding information."
---

# Technical System Research

## Overview

This skill enables systematic investigation of complex technical systems through a multi-phase approach: documenting high-level architecture, analyzing source code, identifying key components and their relationships, and synthesizing findings into comprehensive technical reports.

The skill combines documentation research (wikis, Confluence, READMEs), code exploration and analysis, and comparative system analysis to build deep understanding of how systems work.

## Research Workflow

### Phase 1: Discovery & Initial Research

**Goal**: Establish baseline understanding and identify key components

1. **Gather high-level information**
   - Search documentation (Confluence, wikis, architecture documents)
   - Identify system boundaries, key services, and data flows
   - Document the "what" and "why" before diving into "how"
   - Create initial architecture overview

2. **Identify information sources**
   - Locate relevant documentation pages
   - Identify repository URLs for code access
   - Find Jira tickets, incident reports, or related research
   - Note configuration files and deployment docs

3. **Map key questions**
   - What problem does this system solve?
   - What are the critical components?
   - What makes this system unique or complex?
   - What related systems interact with it?

**Deliverable**: High-level overview document with system architecture, key components, and initial understanding

---

### Phase 2: Code Analysis & Implementation Details

**Goal**: Understand implementation through source code examination

1. **Clone and explore repositories**
   - Clone relevant repositories to local analysis environment
   - Examine directory structure and module organization
   - Identify core components and their responsibilities
   - Note external dependencies and third-party libraries

2. **Analyze key files**
   - Focus on entry points (Program.cs, main.py, etc.)
   - Examine initialization and configuration logic
   - Study core business logic and data structures
   - Review error handling and edge cases
   - Read test files for usage patterns and scenarios

3. **Extract technical details**
   - Document threading models and concurrency patterns
   - Identify communication protocols and data formats
   - Note security mechanisms and authentication
   - Record performance characteristics and timeouts
   - Document error handling strategies

4. **Trace execution paths**
   - Follow critical workflows end-to-end
   - Document state transitions and decision points
   - Identify failure modes and recovery mechanisms

**Deliverable**: Code-level analysis document with implementation details, architecture patterns, and concrete code examples

---

### Phase 3: Component Relationships & Dependencies

**Goal**: Understand how this system connects to related systems

1. **Map internal dependencies**
   - How do components communicate?
   - What are the dependency hierarchies?
   - Where are the critical integration points?

2. **Identify external dependencies**
   - What external systems does this depend on?
   - What are the failure modes of dependencies?
   - How are failures handled?

3. **Document redundancy and failover**
   - What provides fault tolerance?
   - How does the system detect failures?
   - What are the recovery mechanisms?

**Deliverable**: Architecture diagram and dependency matrix showing relationships

---

### Phase 4: Synthesis & Comparative Analysis

**Goal**: Create comprehensive documentation and answer specific comparative questions

1. **Create enriched analysis document**
   - Combine findings from Phases 1-3
   - Add design pattern analysis
   - Document threat models and mitigations
   - Include operational characteristics

2. **Compare with related systems** (if relevant)
   - Identify similarities and differences
   - Document complementary vs. competing mechanisms
   - Analyze design trade-offs

3. **Identify gaps and unknowns**
   - Note areas lacking documentation
   - Highlight potential improvements
   - Document assumptions made during analysis

**Deliverable**: Comprehensive technical analysis covering architecture, implementation, operations, and strategic insights

---

## Key Techniques

### Documentation Analysis
- **Confluence/Wiki searches**: Use targeted queries to find relevant pages
- **Architecture documents**: Look for system design documents, RFC's, or architecture decision records
- **Incident reports**: Post-mortems reveal actual system behavior under failure
- **Deployment documentation**: Reveals operational constraints and requirements

### Code Analysis Patterns

**Entry Points**: Start with `Program.cs`, `main()`, `__main__`, or equivalents to understand initialization flow

**Configuration**: Identify how the system reads configuration (command-line args, environment variables, files)

**Core Logic**: Find the main business logic classes/functions - usually where the most complex reasoning lives

**State Management**: Look for locks, mutexes, concurrent collections - reveals what state is shared across threads

**Error Handling**: Exception handling reveals what can go wrong and how it's recovered

**Testing**: Unit tests show usage patterns and edge cases better than comments

### Comparative Analysis
When comparing systems, structure comparison as:
- **Trigger mechanism**: What causes the system to act?
- **Detection layer**: At what level (network, application, hardware) does it operate?
- **Response time**: How quickly does it detect and respond?
- **Scope**: What gets affected (single component, service, global)?
- **Recovery**: How is normal operation restored?
- **Testing**: How is the mechanism validated?

---

## Document Structure Template

Use this structure for comprehensive analysis documents:

1. **Overview**: What is this system and why does it exist?
2. **Architecture & System Flow**: High-level diagrams and data flow
3. **Implementation Details**: Core components and key code sections (with file:line references)
4. **Design Patterns & Principles**: Why was it designed this way?
5. **Testing & Validation**: How is correctness verified?
6. **Configuration**: What can be customized?
7. **Operational Characteristics**: Performance, deployment, monitoring
8. **Threat Model & Mitigations**: What can go wrong and how is it handled?
9. **Related Systems**: How does it connect to other components?
10. **Code Quality Observations**: Strengths and areas for improvement
11. **Summary**: Concise recap of key findings

---

## Tools & Resources

See `references/research-templates.md` for:
- Analysis document templates
- Confluence query examples
- Repository cloning patterns
- Code analysis checklist

---

## Research Checklist

- [ ] Gather high-level documentation (wikis, architecture docs)
- [ ] Identify and clone relevant repositories
- [ ] Analyze entry points and initialization flow
- [ ] Study core business logic and data structures
- [ ] Examine test files for usage patterns
- [ ] Trace critical execution paths
- [ ] Document component relationships
- [ ] Identify failure modes and recovery mechanisms
- [ ] Compare with related systems (if applicable)
- [ ] Create comprehensive analysis document
- [ ] Validate findings against actual code
