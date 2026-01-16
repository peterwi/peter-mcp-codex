---
name: balanced-coupling-analysis
description: >
  Analyze and assess software architecture coupling using Vlad Khononov’s Balanced Coupling model:
  Integration Strength, Distance, and Volatility. Use when evaluating system design,
  component boundaries, change impact, technical debt, or trade-offs between infrastructure
  and application dependencies.
---

# Balanced Coupling Analysis

This skill guides Claude to analyze system coupling **intentionally and systematically** using the Balanced Coupling model.  
Always explicitly reason about three dimensions:

1. **Integration Strength** — how much knowledge components share  
2. **Distance** — technical and organizational proximity between components  
3. **Volatility** — how often components change (often via Domain-Driven Design subdomains)

Use the `Pain = Strength × Distance × Volatility` heuristic to explain why a design may be costly to evolve, and suggest how to rebalance coupling for maintainability.

---

## When to Use This Skill

Trigger this skill when the user asks things like:

- *“How tightly coupled is my service to this database?”*
- *“Should we split these modules or merge them?”*
- *“Assess the design trade-offs between infrastructure and application layers.”*
- *“What are the risks if we change component A?”*

Focus on design trade-offs, not just abstract statements like “loose coupling is better.”

---

## Instructions For Claude

### Step 1 — Identify Components

- List the **components** under analysis.
- Clarify which component depends on which.

### Step 2 — Assess Integration Strength

Classify coupling using one of:

- **Implementation coupling** — depends on private internals
- **Functional coupling** — shared business behavior
- **Model coupling** — shared domain models or data structures
- **Contract coupling** — explicit contract, minimal shared knowledge

State what knowledge is shared and why.

### Step 3 — Assess Distance

Evaluate how far apart components are:

- In code (local module vs. distributed service)
- Runtime/deployment
- Organizational/teams
- Lifecycle independence

Describe how these increase coordination or change cost.

### Step 4 — Assess Volatility

Estimate how often each component must change:

- **Core subdomain** → high volatility
- **Supporting/Generic** → low volatility

Use business context, not incidental metrics.

### Step 5 — Reason About Pain

Explain how the combination of:

- Integration Strength
- Distance
- Volatility

affects:

- Maintenance cost
- Risk of cascading changes
- Coordination overhead

Frame risk as **trade-offs**, not absolutes.

### Step 6 — Suggest Rebalancing Options

For each concern identified, propose targeted improvements:

1. **Remove accidental coupling**
2. **Reduce integration strength**
3. If strength & volatility are high → **reduce distance**
4. Prefer **explicit contracts** over shared internals or models

Link each suggestion to the dimension it improves.

---

## Output Style

- Analytical and practical
- Name dimensions explicitly
- Tie trade-offs to real design decisions
- Avoid generic rules without dimension context

---

## Example Prompts That Activate This Skill

- “Evaluate the coupling between my service and external API.”
- “Explain the trade-offs of splitting this service into two.”
- “Assess infrastructure vs application dependencies in my architecture.”
- “Where is my system brittle due to coupling?”

---

## Example Outputs

**Sample response structure:**

1. Components under analysis  
2. What integration strength is present and why  
3. What distance exists and how it affects evolution  
4. Volatility estimates from business context  
5. Pain analysis using Strength, Distance, Volatility  
6. Concrete suggestions to rebalance coupling
