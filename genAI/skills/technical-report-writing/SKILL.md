---
name: technical-report-writing
description: >
  Produce clear, structured, evidence-based technical reports for infrastructure and platform work.
  Use when writing incident reports, RCA/postmortems, performance benchmarks, security findings,
  or change proposals. Outputs follow "bottom line up front" style with exec summary first.
---

# Technical Report Writing

## Overview

This skill guides production of structured technical reports that communicate findings clearly to both technical and non-technical audiences. All reports follow the "Bottom Line Up Front" (BLUF) principle: lead with conclusions, then provide supporting evidence.

---

## When to Use This Skill

Trigger this skill when the user asks for:

- *"Write an incident report for the outage"*
- *"Create an RCA for the storage failure"*
- *"Document performance test results"*
- *"Write up security findings from the audit"*
- *"Draft a change proposal for the migration"*
- *"Help me write a postmortem"*

---

## Report Workflow

### Step 1: Gather Inputs

Collect before writing:
- **Raw notes/observations** - What happened, what was seen
- **Logs/metrics** - Evidence from monitoring, dashboards, CLI output
- **Timeline** - Sequence of events with timestamps
- **Scope** - What systems/services were affected
- **Audience** - Who will read this (execs, engineers, customers)

### Step 2: Select Template

Choose the appropriate template from [Report Templates](./references/report-templates.md):

| Template | Use Case |
|----------|----------|
| Infrastructure Investigation | Storage assessment, technology evaluation, platform comparison |
| Incident Report | Service disruption, outage, degradation |
| RCA/Postmortem | Root cause analysis after resolution |
| Performance Benchmark | Load tests, capacity planning, comparisons |
| Security Finding | Vulnerability, audit result, risk assessment |
| Change Proposal | Infrastructure change, migration, upgrade |

### Step 3: Draft with BLUF Structure

Every report follows this structure:

1. **Executive Summary** (2-4 sentences) - Bottom line: what, impact, outcome
2. **Key Facts** - Bullet points of critical information
3. **Timeline** - Chronological events with timestamps
4. **Analysis/Details** - Technical deep-dive
5. **Evidence** - Links to logs, metrics, screenshots
6. **Recommendations/Next Steps** - Actionable items with owners

### Step 4: Apply Quality Checklist

Before finalising, verify:

- [ ] **BLUF applied** - Conclusion comes first, not last
- [ ] **Evidence linked** - All claims have supporting data
- [ ] **Assumptions stated** - What was assumed vs confirmed
- [ ] **Risks identified** - Residual risks or unknowns
- [ ] **Next steps actionable** - Clear owners and deadlines
- [ ] **Audience appropriate** - Technical depth matches readers
- [ ] **No jargon unexplained** - Acronyms defined on first use

---

## Output Format

Reports are delivered in **Markdown** with:
- Clear heading hierarchy (H1 title, H2 sections, H3 subsections)
- Tables for structured data (timelines, comparisons)
- Code blocks for commands, logs, config snippets
- Bullet points for lists (avoid prose for factual items)

---

## Example Prompts

**Incident Report:**
```
Write an incident report for the Kubernetes cluster outage on 2024-01-15.
Timeline: 14:32 alerts fired, 14:45 identified as OOM on node-3, 15:10 resolved.
Impact: 3 services degraded for 38 minutes. Cause: memory leak in app v2.3.1.
```

**RCA/Postmortem:**
```
Create an RCA for the VAST storage latency spike. Include: timeline of events,
contributing factors (network saturation + GC pause), and 5 whys analysis.
```

**Performance Report:**
```
Document the load test results for the new API gateway. We tested 1000, 5000,
and 10000 concurrent users. Include p50/p95/p99 latencies and throughput.
```

---

## Style Profile: storage.md

This skill produces reports in the style of `storage.md` - a comprehensive infrastructure investigation report. Key style elements:

### Voice and Tone

- **Direct and factual** - State findings clearly, avoid hedging ("might", "seems", "possibly")
- **Professional third-person** - "The system exhibits..." not "I think..."
- **Balanced assessment** - Present both Advantages and Concerns for each option
- **Acknowledge unknowns** - Use "Open Questions" sections rather than hiding gaps

### Section Order (Investigation Reports)

1. Table of Contents
2. Executive Summary (BLUF)
3. Introduction + Aims + Out of Scope
4. Context/Overview
5. Use Cases (each with: Context → Observations → Proposals)
6. Technology Assessments (each with: Use Case → Advantages → Concerns → General Observations)
7. Performance Benchmarks
8. Next Steps / Follow-on Proposals
9. Appendices

### Formatting Conventions

| Element | Convention |
|---------|------------|
| Observations | Numbered: "Observation 1", "Observation 2" |
| Proposals | Numbered: "Proposal 1", "Proposal 2" |
| Sub-bullets | Indented with `o` for subordinate points |
| Emphasis | **Bold** for key terms |
| Code/commands | Fenced code blocks |
| References | Footnote-style with URLs |
| Figures | Caption below: "Switch port utilisation for..." |

### Evidence Conventions

- **Specific numbers** - "22 GB/s read bandwidth", "2.5M IOPs", not "high throughput"
- **Benchmark configs** - Document test setup (hardware, software versions, parameters)
- **Chart references** - Describe what the chart shows in caption
- **External sources** - URL footnotes for vendor claims, specifications
- **Comparison baseline** - Always state what you're comparing against

### Recommendations Format

```markdown
Proposal 7

Upgrade the 7 Windows File Servers with higher-rate NICs than the current
dual-10G configuration. Dual-25G, dual-40G or dual-50G NICs would provide
immediate improvement (particularly if balanced with the raw bandwidth of
the attached storage).
```

**Characteristics:**
- Numbered for cross-reference
- Specific action with concrete parameters
- Rationale included
- Quantified where possible

### Open Questions Format

When unknowns exist, list them explicitly:

```markdown
Open Questions

1. Follow-up needed on the state of the Kaminario block storage driver for
   OpenStack.
2. Single client scale-up performance (although reference to scale-up and
   scale-out).
3. What is the scale of Kaminario's UK presence?
```

---

## Reference Documentation

- [Report Templates](./references/report-templates.md) - Full templates for each report type
- [Style Guide](./references/report-templates.md#writing-style-guide) - Detailed formatting rules
- [Quality Checklist](./references/report-templates.md#quality-checklist) - Review criteria

