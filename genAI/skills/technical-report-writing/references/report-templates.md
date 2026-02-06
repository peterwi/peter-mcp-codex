# Report Templates

Complete templates for technical reports. Each template follows BLUF (Bottom Line Up Front) structure.

---

## Infrastructure Investigation Report

Use for storage assessments, technology evaluations, platform comparisons, or capacity planning studies. Modelled on the storage.md investigation report style.

```markdown
# [Topic]: [Investigation Type]

Table of Contents
Executive Summary ............................................................. 2
Introduction .................................................................... 3
  Aims of this Report ......................................................... 3
  Out of Scope ................................................................ 3
Overview of [Domain] .......................................................... 4
Use Cases ..................................................................... 5
  [Use Case 1] ................................................................ 5
  [Use Case 2] ................................................................ 7
Technology Assessment ......................................................... 9
  [Technology A] .............................................................. 9
  [Technology B] ............................................................. 12
Performance Benchmarks ....................................................... 15
Next Steps ................................................................... 18
Appendix A: [Supporting Detail] .............................................. 20
Appendix B: [Vendor Interviews] .............................................. 22

---

## Executive Summary

[3-5 sentences identifying the key forces driving this investigation, main findings,
and strategic recommendation. Lead with conclusions.]

[Technology/approach] exemplifies [trend]. It has demonstrated [key finding].

However, [balanced concern]. The [recommendation] should be adopted in
[specific context], while working in close partnership with [stakeholders] to
address [barriers].

[Topic] alone does not solve all challenges. Other potential bottlenecks identified:

  o  [Bottleneck 1]
  o  [Bottleneck 2]
  o  [Bottleneck 3]

---

## Introduction

[2-3 paragraphs on market/domain context and forces driving change]

### Aims of this Report

This report falls into several broad components:

1. Reviews current and anticipated requirements for [use cases]
2. Examines [technology/solution] candidates through [method: benchmarks, interviews, etc.]
3. Makes suggestions on next steps and areas deserving further exploration

The report concentrates findings and recommendations in the body, with detailed
supporting information in appendices.

### Out of Scope

This report does not aim to:

- [Explicit exclusion 1]
- [Explicit exclusion 2]

---

## Overview of [Domain]

[Context section explaining the landscape, comparisons, taxonomy]

### [Comparison Dimension]

[Analysis of different approaches, trade-offs, or market segments]

---

## Use Cases

### [Use Case Name]

Notes from discovery meeting with [Name] from [Team] can be found in Appendix A.

[1-2 paragraph description of the use case, data flows, current state]

#### Observations

Observation 1

[Detailed observation with specific evidence. Include implications.]

Observation 2

[Next observation. Use sub-bullets for related points:]

  o  [Sub-point A]
  o  [Sub-point B]
  o  [Sub-point C]

#### Proposals

[Brief context paragraph if needed]

Proposal 1

[Specific, actionable proposal with rationale and expected benefit.
Include concrete parameters where possible.]

Proposal 2

[Next proposal with clear scope and justification.]

---

## Technology Assessment

### [Technology Name]

[1-2 paragraph overview of the technology/vendor]

Observation N

[Key technical observation about this technology]

#### [Organisation] Use Case

[How this technology maps to specific use cases within the organisation]

#### Advantages

[Bullet list of strengths, each with brief explanation]

- [Advantage 1 with context]
- [Advantage 2 with context]

#### Concerns

Observation N+1

[Significant concern framed as numbered observation]

Some examples of areas requiring improvement include:

1. [Concern with specific detail]
2. [Concern with specific detail]
3. [Concern with specific detail]

#### General Observations

Proposal N

[Recommendation specific to this technology, with context and caveats]

#### Open Questions

1. [Unresolved question requiring follow-up]
2. [Unresolved question requiring follow-up]

---

## Performance Benchmarks

### Test Objectives

[What the benchmarks aim to measure and why]

### [Test Category]

[Description of test setup and methodology]

Further technical details of the configuration can be found in Appendix C.

### Results

[Present data with specific numbers]

The test clients achieved an aggregate of approx [X] IOPs for [workload type].

[Figure caption: Description of what the chart shows]

[Analysis paragraph explaining the results]

Observation N

[Key finding from benchmarks, formatted as numbered observation]

---

## Next Steps

### Trends in [Domain]

[Analysis of market/technology direction]

### Proposals for Follow-on Evaluations

#### [Proposal Title]

[Description of proposed follow-on work with scope and rationale]

#### [Proposal Title]

[Next proposal with clear deliverables]

---

## Appendix A: [Use Case Interviews]

### [Interview Subject]

Case study interview on YYYY-MM-DD

  o  [Attendee 1] - [Role]
  o  [Attendee 2] - [Role]

#### Context

1. [Numbered context point]
2. [Numbered context point]

#### [Aspect 1]

[Detailed notes]

#### [Aspect 2]

[Detailed notes]

---

## Appendix B: [Vendor Interviews]

### [Vendor Name]

#### Company Overview

[Background on vendor]

#### Implementation Details

[Technical details from vendor discussion]

---

## Appendix C: [Technical Configuration]

### [Configuration Category]

[Detailed technical specifications, hardware configs, software versions]
```

---

## Incident Report

Use for service disruptions, outages, or degradation events.

```markdown
# Incident Report: [Brief Title]

**Incident ID:** INC-YYYY-NNNN
**Date:** YYYY-MM-DD
**Severity:** P1/P2/P3/P4
**Status:** Resolved | Monitoring | Ongoing
**Author:** [Name]
**Last Updated:** YYYY-MM-DD HH:MM UTC

---

## Executive Summary

[2-4 sentences: What happened, duration, impact, current status]

**Impact:** [Number] users/services affected for [duration]
**Root Cause:** [One sentence summary]
**Resolution:** [One sentence summary]

---

## Key Facts

- **Detection Time:** HH:MM UTC
- **Resolution Time:** HH:MM UTC
- **Total Duration:** X hours Y minutes
- **Services Affected:** [list]
- **Users Impacted:** [number or percentage]
- **Data Loss:** Yes/No (if yes, describe)

---

## Timeline

| Time (UTC) | Event |
|------------|-------|
| HH:MM | Initial alert fired / First symptom observed |
| HH:MM | On-call engaged |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Service restored |
| HH:MM | Incident closed |

---

## Technical Details

### Symptoms
- [What was observed]
- [Error messages, metrics anomalies]

### Root Cause
[Detailed explanation of what caused the incident]

### Resolution
[Steps taken to resolve]

---

## Evidence

- [Link to dashboard/metrics]
- [Link to logs]
- [Relevant CLI output or screenshots]

---

## Action Items

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Preventive action] | [Name] | YYYY-MM-DD | Open |
| [Detection improvement] | [Name] | YYYY-MM-DD | Open |
```

---

## RCA / Postmortem

Use for detailed root cause analysis after incident resolution.

```markdown
# Root Cause Analysis: [Incident Title]

**Incident ID:** INC-YYYY-NNNN
**RCA Date:** YYYY-MM-DD
**Author:** [Name]
**Reviewers:** [Names]

---

## Executive Summary

[3-5 sentences: What failed, why it failed, business impact, key learnings]

**Bottom Line:** [One sentence stating the root cause]

---

## Impact Summary

| Metric | Value |
|--------|-------|
| Duration | X hours Y minutes |
| Users Affected | [number] |
| Revenue Impact | $X (if applicable) |
| SLA Breach | Yes/No |

---

## Timeline

[Same format as Incident Report]

---

## Root Cause Analysis

### 5 Whys Analysis

1. **Why did [symptom] occur?**
   → [Answer]

2. **Why did [answer 1] happen?**
   → [Answer]

3. **Why did [answer 2] happen?**
   → [Answer]

4. **Why did [answer 3] happen?**
   → [Answer]

5. **Why did [answer 4] happen?**
   → [Root Cause]

### Contributing Factors

- **Factor 1:** [Description]
- **Factor 2:** [Description]
- **Factor 3:** [Description]

### What Went Well

- [Positive observation]
- [Effective response action]

### What Went Poorly

- [Issue with detection]
- [Issue with response]
- [Gap in tooling/process]

---

## Corrective Actions

### Immediate (0-7 days)

| Action | Owner | Status |
|--------|-------|--------|
| [Action] | [Name] | Done/In Progress |

### Short-term (7-30 days)

| Action | Owner | Status |
|--------|-------|--------|
| [Action] | [Name] | Planned |

### Long-term (30+ days)

| Action | Owner | Status |
|--------|-------|--------|
| [Architectural change] | [Team] | Backlog |

---

## Lessons Learned

1. [Key takeaway]
2. [Key takeaway]
3. [Key takeaway]

---

## Appendix

- [Link to incident Slack thread]
- [Link to related tickets]
- [Raw logs or metrics]
```

---

## Performance Benchmark Report

Use for load tests, capacity planning, or performance comparisons.

```markdown
# Performance Benchmark Report: [System/Component]

**Date:** YYYY-MM-DD
**Author:** [Name]
**Environment:** Production / Staging / Lab
**Version Tested:** [version]

---

## Executive Summary

[2-4 sentences: What was tested, key findings, recommendation]

**Bottom Line:** [System] handles [X] requests/sec with p99 latency of [Y]ms under [conditions].

---

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Test Duration | X minutes |
| Concurrent Users | [range] |
| Request Rate | X req/sec |
| Test Tool | [k6, wrk, locust, etc.] |
| Target Endpoint | [URL/service] |

### Infrastructure

- **Nodes:** [count] x [instance type]
- **CPU:** [cores]
- **Memory:** [GB]
- **Storage:** [type, IOPS]
- **Network:** [bandwidth]

---

## Results Summary

| Load Level | Throughput | p50 | p95 | p99 | Error Rate |
|------------|------------|-----|-----|-----|------------|
| 1000 users | X req/s | Xms | Xms | Xms | X% |
| 5000 users | X req/s | Xms | Xms | Xms | X% |
| 10000 users | X req/s | Xms | Xms | Xms | X% |

---

## Detailed Analysis

### Throughput

[Analysis of throughput trends, saturation points]

### Latency Distribution

[Analysis of latency percentiles, outliers]

### Resource Utilisation

| Resource | Idle | 50% Load | 100% Load |
|----------|------|----------|-----------|
| CPU | X% | X% | X% |
| Memory | X GB | X GB | X GB |
| Disk I/O | X MB/s | X MB/s | X MB/s |
| Network | X Mbps | X Mbps | X Mbps |

### Bottleneck Identification

- **Primary bottleneck:** [resource or component]
- **Secondary bottleneck:** [resource or component]

---

## Comparison (if applicable)

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| Throughput | X | Y | +/-Z% |
| p99 Latency | Xms | Yms | +/-Z% |

---

## Recommendations

1. **[Action]** - [Expected improvement]
2. **[Action]** - [Expected improvement]

---

## Evidence

- [Link to test results/dashboard]
- [Link to raw data]
- [Test script/configuration]
```

---

## Security Finding

Use for vulnerability reports, audit findings, or risk assessments.

```markdown
# Security Finding: [Brief Title]

**Finding ID:** SEC-YYYY-NNNN
**Date:** YYYY-MM-DD
**Severity:** Critical / High / Medium / Low / Informational
**Status:** Open | Remediated | Accepted Risk
**Author:** [Name]

---

## Executive Summary

[2-3 sentences: What was found, potential impact, recommended action]

**Risk Level:** [Critical/High/Medium/Low]
**CVSS Score:** [X.X] (if applicable)

---

## Finding Details

### Description

[Clear description of the vulnerability or security issue]

### Affected Systems

- [System/service 1]
- [System/service 2]

### Attack Vector

[How could this be exploited]

### Potential Impact

- **Confidentiality:** [Impact description]
- **Integrity:** [Impact description]
- **Availability:** [Impact description]

---

## Evidence

### Proof of Concept

```
[Commands, requests, or steps to reproduce]
```

### Screenshots/Output

[Relevant evidence]

---

## Risk Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| Likelihood | High/Medium/Low | [Justification] |
| Impact | High/Medium/Low | [Justification] |
| Exploitability | Easy/Moderate/Difficult | [Justification] |

---

## Recommendations

### Immediate (0-7 days)

1. [Mitigation step]

### Short-term (7-30 days)

1. [Remediation step]

### Long-term

1. [Preventive control]

---

## References

- [CVE link if applicable]
- [CWE reference]
- [OWASP reference]
```

---

## Change Proposal

Use for infrastructure changes, migrations, or upgrades.

```markdown
# Change Proposal: [Brief Title]

**Change ID:** CHG-YYYY-NNNN
**Date:** YYYY-MM-DD
**Author:** [Name]
**Status:** Draft | Under Review | Approved | Implemented

---

## Executive Summary

[3-5 sentences: What change is proposed, why it's needed, expected outcome]

**Bottom Line:** [One sentence stating the proposal and benefit]

---

## Problem Statement

[What problem does this change solve? What's the current pain?]

---

## Proposed Solution

### Overview

[High-level description of the change]

### Technical Details

[Detailed technical approach]

### Architecture Changes

[Before/after diagrams or descriptions]

---

## Scope

### In Scope

- [Item]
- [Item]

### Out of Scope

- [Item]
- [Item]

### Affected Systems

| System | Change Type | Risk |
|--------|-------------|------|
| [System] | [Add/Modify/Remove] | [High/Medium/Low] |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | High/Medium/Low | High/Medium/Low | [Mitigation] |
| [Risk 2] | High/Medium/Low | High/Medium/Low | [Mitigation] |

---

## Rollback Plan

[Steps to revert if the change causes issues]

---

## Implementation Plan

| Phase | Actions | Duration | Owner |
|-------|---------|----------|-------|
| Preparation | [Actions] | X days | [Name] |
| Execution | [Actions] | X hours | [Name] |
| Validation | [Actions] | X hours | [Name] |

### Maintenance Window

- **Proposed Date:** YYYY-MM-DD
- **Duration:** X hours
- **Expected Downtime:** Y minutes / None

---

## Success Criteria

- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
- [ ] [Measurable outcome 3]

---

## Approvals Required

| Role | Name | Status |
|------|------|--------|
| Technical Lead | [Name] | Pending |
| Security | [Name] | Pending |
| Operations | [Name] | Pending |
```

---

## Quality Checklist

Apply this checklist to any report before finalising:

### Content Quality

- [ ] **BLUF applied** - Executive summary states conclusion first
- [ ] **Audience appropriate** - Technical depth matches readers
- [ ] **Complete** - All template sections filled or marked N/A
- [ ] **Accurate** - Facts verified, no speculation presented as fact

### Evidence & Justification

- [ ] **Evidence linked** - All claims have supporting data
- [ ] **Sources cited** - Links to logs, metrics, tickets
- [ ] **Assumptions stated** - Clearly marked what was assumed
- [ ] **Uncertainties noted** - Gaps in knowledge acknowledged

### Clarity & Readability

- [ ] **Jargon defined** - Acronyms expanded on first use
- [ ] **Structure logical** - Information flows naturally
- [ ] **Tables used** - Structured data in tables, not prose
- [ ] **Formatting consistent** - Headings, bullets, code blocks

### Actionability

- [ ] **Next steps clear** - Specific actions identified
- [ ] **Owners assigned** - Each action has an owner
- [ ] **Deadlines set** - Timeframes specified where relevant
- [ ] **Risks identified** - Residual risks or unknowns documented

### Review

- [ ] **Proofread** - No typos or grammatical errors
- [ ] **Peer reviewed** - Another person has read it
- [ ] **Stakeholders identified** - Distribution list clear

---

## Writing Style Guide

### Tone

- Professional but accessible
- Direct and factual
- Avoid hedging language ("might", "possibly", "seems like")

### Structure

- Short paragraphs (2-4 sentences)
- Bullet points for lists of 3+ items
- Tables for comparative or structured data
- Code blocks for commands, logs, configs

### Timestamps

- Always include timezone (prefer UTC)
- Format: `YYYY-MM-DD HH:MM UTC` or `HH:MM UTC`
- Use 24-hour format

### Numbers

- Use specific numbers, not vague terms ("38 minutes" not "about half an hour")
- Include units ("15ms", "2.5GB", "1000 req/s")
- Round appropriately for audience (execs: "~40 minutes", engineers: "38m 42s")

---

## Before/After Example

### Input: Raw Notes

```
NVMe evaluation notes - 2024-01

Tested Intel P5800X vs Samsung PM1733 for QTG cache tier.
Lab setup: 3x Dell R750, dual 100G, RHEL 9.
Tests: 4K random read/write, 128K sequential.

Results rough:
- Intel: 1.5M IOPS read, 500K write, 7us latency
- Samsung: 1.2M IOPS read, 450K write, 9us latency
- Intel runs hot (85C under load)
- Samsung has better endurance rating

Issues found:
- Intel firmware 1.2.3 has bug with PCIe gen5, need 1.2.5
- Samsung needs kernel 6.2+ for full performance

Both work with SPDK. Intel has better Optane integration.
Samsung cheaper ($800 vs $1200 per drive).

Questions: thermal throttling impact? long-term endurance?
```

### Output: Investigation Report (storage.md style)

```markdown
# NVMe Storage: Performance Evaluation for QTG Cache Tier

Table of Contents
Executive Summary ............................................................. 2
Introduction .................................................................. 3
  Aims of this Report ........................................................ 3
  Out of Scope ............................................................... 3
Technology Assessment ......................................................... 4
  Intel P5800X ............................................................... 4
  Samsung PM1733 ............................................................. 6
Performance Benchmarks ........................................................ 8
Next Steps ................................................................... 10
Appendix A: Test Configuration ............................................... 11

---

## Executive Summary

The NVMe storage market offers compelling options for high-performance cache tiers.
Two candidates have been evaluated for the QTG cache use case: Intel P5800X
(Optane-based) and Samsung PM1733 (TLC NAND).

Intel P5800X demonstrates superior latency characteristics (7us vs 9us) and higher
IOPS (1.5M read vs 1.2M read), making it the stronger candidate for latency-sensitive
workloads. However, thermal management and firmware maturity present operational
concerns.

Samsung PM1733 offers better price/performance ($800 vs $1200) and superior thermal
characteristics, making it suitable for capacity-oriented deployments where
sub-10us latency is acceptable.

The recommendation is to adopt Intel P5800X for the primary QTG cache tier, with
Samsung PM1733 for secondary/overflow capacity, subject to resolution of:

  o  Intel firmware upgrade to v1.2.5 addressing PCIe Gen5 compatibility
  o  Thermal management validation under sustained production load
  o  Kernel upgrade to 6.2+ for Samsung full performance enablement

---

## Introduction

High-performance NVMe storage has become critical for cache-tier workloads where
microsecond-level latency directly impacts application performance. The QTG cache
tier serves thousands of concurrent clients and requires both high IOPS and
consistent low latency.

### Aims of this Report

This report falls into several broad components:

1. Evaluates two NVMe candidates for the QTG cache tier use case
2. Provides benchmark data comparing performance characteristics
3. Makes recommendations on adoption strategy and follow-on work

### Out of Scope

This report does not aim to:

- Make final procurement recommendations (pending thermal validation)
- Evaluate enterprise features (encryption, namespaces)

---

## Technology Assessment

### Intel P5800X

Intel's P5800X is an Optane-based NVMe device targeting ultra-low-latency workloads.
The device leverages 3D XPoint memory technology for consistent performance.

Observation 1

The P5800X achieves 7us average read latency, approximately 22% lower than
NAND-based alternatives. This latency advantage is consistent across queue
depths and workload patterns.

#### QTG Use Case

The P5800X maps well to QTG cache requirements:

  o  High IOPS (1.5M read) supports thousands of concurrent client requests
  o  Low latency (7us) minimises impact on Calc Farm aggregate throughput
  o  Optane technology provides consistent performance without GC pauses

#### Advantages

- Superior latency (7us vs 9us for NAND alternatives)
- Higher IOPS ceiling (1.5M read, 500K write)
- Native SPDK integration for kernel-bypass operation
- Optane persistent memory integration path

#### Concerns

Observation 2

Thermal characteristics require attention. Under sustained load, the device
reaches 85C, approaching thermal throttling thresholds.

1. Firmware version 1.2.3 exhibits PCIe Gen5 compatibility issues. Upgrade to
   v1.2.5 is required before production deployment.

2. Higher per-unit cost ($1200 vs $800) impacts total deployment cost.

3. Thermal management in dense server configurations requires validation.

#### Open Questions

1. Impact of thermal throttling on sustained workload performance?
2. Long-term endurance under QTG write patterns?

---

### Samsung PM1733

Samsung PM1733 is a TLC NAND-based NVMe device offering strong price/performance.

Observation 3

The PM1733 achieves competitive performance (1.2M IOPS read, 9us latency)
at 33% lower cost than Optane alternatives.

#### QTG Use Case

Suitable for capacity-oriented cache tiers where sub-10us latency is acceptable.

#### Advantages

- Lower cost ($800 vs $1200 per unit)
- Better thermal characteristics (no throttling observed)
- Higher endurance rating for write-intensive workloads
- Mature firmware with broad compatibility

#### Concerns

1. Requires kernel 6.2+ for full performance enablement
2. 2us latency penalty versus Optane (9us vs 7us)

---

## Performance Benchmarks

### Test Configuration

Tests performed on 3x Dell R750 servers with dual 100G networking, RHEL 9.
Benchmark tool: storage microbenchmark tool (asynchronous I/O enabled).

Further technical details can be found in Appendix A.

### Results

| Device | 4K Rand Read | 4K Rand Write | Avg Latency |
|--------|--------------|---------------|-------------|
| Intel P5800X | 1.5M IOPS | 500K IOPS | 7us |
| Samsung PM1733 | 1.2M IOPS | 450K IOPS | 9us |

Observation 4

Intel P5800X delivers 25% higher read IOPS and 22% lower latency than
Samsung PM1733. The latency advantage is most significant for
latency-sensitive QTG cache workloads.

---

## Next Steps

### Proposals for Follow-on Evaluations

#### Thermal Validation

Deploy Intel P5800X in production-representative thermal environment and
measure performance under sustained load over 72-hour period.

#### Kernel Upgrade Assessment

Evaluate RHEL 9 kernel upgrade path to 6.2+ for Samsung PM1733 full
performance enablement.

---

## Appendix A: Test Configuration

### Server Hardware

- Dell R750, 2x Intel Xeon 8380 (40 cores each)
- 512GB DDR5 RAM
- Dual Mellanox ConnectX-6 100G NICs

### Software Configuration

- RHEL 9.1, kernel 5.14.0
- Benchmark tool version: 3.33
- Test parameters: iodepth=64, numjobs=8, runtime=300s
```

This example demonstrates:
- BLUF executive summary with clear recommendation
- Numbered observations for cross-reference
- Structured technology assessment (Use Case/Advantages/Concerns)
- Specific numbers throughout (1.5M IOPS, 7us, $1200)
- Open Questions section for unknowns
- Appendix reference for configuration details
