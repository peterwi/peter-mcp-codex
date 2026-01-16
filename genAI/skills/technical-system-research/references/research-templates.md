# Research Templates and Patterns

## Analysis Document Template

Use this structure when creating comprehensive technical analysis documents:

```markdown
# [System Name]: Comprehensive Technical Analysis

## Overview
- What is this system?
- What problem does it solve?
- Why does it exist?
- Key facts and statistics

## Architecture & System Flow
- System diagram/architecture
- Component interactions
- Data flow diagram
- External dependencies

## Implementation Details
- Core components with file:line references
- Key algorithms or business logic
- Threading model or concurrency patterns
- Communication protocols
- Configuration

## Design Patterns & Principles
- Why was it designed this way?
- Key architectural decisions
- Trade-offs and alternatives
- Design patterns used

## Testing & Validation
- Test infrastructure
- Automated testing approach
- Test coverage
- Validation procedures

## Configuration
- Configuration parameters
- Environment variables
- Deployment-specific settings
- Customization points

## Operational Characteristics
- Performance metrics (latency, throughput, timeouts)
- Scaling characteristics
- Resource requirements
- Monitoring and observability

## Threat Model & Mitigations
- What can go wrong?
- How is each threat mitigated?
- Failure modes and recovery
- Security considerations

## Related Systems
- Dependent systems
- System dependencies
- Integration points
- Relationships to other components

## Code Quality Observations
- Strengths of implementation
- Areas for improvement
- Maintainability considerations
- Technical debt

## Summary
- Key findings
- Strategic insights
- Recommendations
```

---

## Confluence Query Examples

### Searching for Architecture Documents
```
type = page AND text ~ "architecture" AND space = <SPACE_KEY>
```

### Finding Incident Reports
```
type = page AND text ~ "incident" AND labels = post-mortem
```

### Searching System Documentation
```
type = page AND title ~ "[system-name]" AND created >= -6m
```

### Finding Design Documents
```
type = page AND (text ~ "RFC" OR text ~ "design decision" OR text ~ "ADR")
```

---

## Code Analysis Checklist

### Entry Point Analysis
- [ ] Identify main entry point (Program.cs, main.py, etc.)
- [ ] Document command-line arguments and environment variables
- [ ] Trace initialization sequence
- [ ] Identify configuration loading
- [ ] Document dependency injection or service initialization

### Core Logic Analysis
- [ ] Find primary business logic classes/functions
- [ ] Identify core algorithms
- [ ] Document data structures
- [ ] Trace execution paths for critical operations
- [ ] Identify state management

### Concurrency Analysis
- [ ] Identify shared state
- [ ] Find synchronization mechanisms (locks, mutexes, etc.)
- [ ] Document thread creation and lifecycle
- [ ] Identify potential race conditions
- [ ] Document async/await or task-based patterns

### Error Handling Analysis
- [ ] Document exception handling strategy
- [ ] Identify fallback mechanisms
- [ ] Document error recovery procedures
- [ ] Find timeout mechanisms
- [ ] Identify circuit breaker patterns

### Testing Analysis
- [ ] Locate unit tests
- [ ] Examine test patterns and scenarios
- [ ] Identify test mocks or fixtures
- [ ] Document integration tests
- [ ] Find test infrastructure or test utilities

---

## Comparative Analysis Structure

When comparing two systems, use this framework:

### 1. Trigger Mechanism
- What causes System A to act?
- What causes System B to act?
- Are triggers proactive or reactive?
- How similar are the triggers?

### 2. Detection Layer
- At what layer does System A operate? (network, application, hardware)
- At what layer does System B operate?
- What are the implications of each layer?

### 3. Response Time
- How quickly does System A detect and respond?
- How quickly does System B detect and respond?
- What are acceptable latencies for each?

### 4. Scope of Impact
- What gets affected by System A? (single component, service, global)
- What gets affected by System B?
- Are they complementary or competing?

### 5. Recovery Mechanism
- How is normal operation restored in System A?
- How is normal operation restored in System B?
- Is recovery automatic or manual?

### 6. Testing & Validation
- How is System A validated?
- How is System B validated?
- What are the test scenarios?

### 7. Design Trade-offs
- Simplicity vs. Coverage: Which is emphasized?
- Speed vs. Accuracy: Detection vs. false positive rate?
- Centralized vs. Distributed control?

---

## Repository Structure Analysis Pattern

When examining a cloned repository:

```
<repo>/
├── README.md              → Overview and setup
├── src/ or lib/           → Source code
│   ├── Program.cs/main()  → Entry point (START HERE)
│   ├── Core logic         → Main business logic
│   └── [Subsystems]       → Components
├── tests/                 → Test files (examine for usage patterns)
├── docs/                  → Architecture and design docs
├── config/                → Configuration files
└── scripts/               → Build/deploy scripts
```

**Analysis order**:
1. README - understand purpose
2. Program.cs/main() - understand initialization
3. Directory structure - understand organization
4. Core logic files - understand business logic
5. Tests - understand usage patterns
6. Config files - understand customization

---

## Documentation Hierarchy

When gathering documentation, organize by detail level:

### Level 1: Executive Summary
- 1-2 pages
- What, why, high-level how
- Suitable for non-technical stakeholders

### Level 2: Architecture Overview
- 5-10 pages
- System boundaries, key components
- Data flow diagrams
- Integration points

### Level 3: Implementation Details
- 20-50 pages
- Code-level details
- Design patterns and algorithms
- Concurrency and error handling

### Level 4: Operational Reference
- 10-20 pages
- Configuration and deployment
- Monitoring and troubleshooting
- Performance characteristics

### Level 5: Strategic Insights
- 5-10 pages
- Design decisions and trade-offs
- Threat models and mitigations
- Relationship to other systems
