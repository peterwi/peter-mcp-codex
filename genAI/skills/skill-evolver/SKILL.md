---
name: skill-evolver
description: Evolve skills through genetic algorithms. Use when creating new skills from scratch or optimizing existing ones. Takes user intent and autonomously generates, mutates, and selects optimal skill variations through expansion (1→2→4→8→16) and contraction (16→8→4→2→1) cycles.
---

# Skill Evolver

Autonomously creates and optimizes skills using genetic algorithms.

## Quick Start

```bash
# Create new skill from intent
python3 scripts/evolve_loop.py \
  --intent "Create a skill that writes Python unit tests" \
  --generations 3

# Optimize existing skill
python3 scripts/evolve_loop.py \
  --base-skill ../existing-skill/SKILL.md \
  --intent "Optimize for clarity and examples" \
  --generations 2

# Check metrics after evolution
cat evolution_workspace/gen_3_expand/metrics.json
```

## How It Works

**Expansion (1→2→4→8):** Mutate each variant to create 2 offspring
- Tone variation (formal ↔ casual)
- Structure reorganization (workflow/task/reference-based)
- Example enhancement (add concrete use cases)
- Constraint tuning (specificity adjustments)

**Contraction (8→4→2→1):** Judge evaluation and selection
- Multi-judge voting (default: 3 judges)
- Weighted criteria (correctness 30%, clarity 25%, usability 25%, efficiency 20%)
- Keep top 50% each round

## Scripts

### evolve_loop.py

Main evolution engine.

**Key Parameters:**
- `--intent`: Skill objective (required)
- `--generations`: Expansion stages (default: 3)
- `--temperature`: Mutation randomness (default: 1.0)
- `--base-skill`: Existing skill to optimize
- `--no-judge`: Skip selection phase

### judge.py

Evaluation system.

**Key Parameters:**
- `--generation-dir`: Variants to evaluate
- `--test-case`: Evaluation scenario
- `--keep-top`: Number of winners (default: half)
- `--judges`: Number of evaluators (default: 3)
- `--criteria`: Custom weights (e.g., "correctness:40,clarity:30,usability:30")

## Usage Patterns

**Exploration (high diversity):**
```bash
--temperature 1.3 --generations 3
```

**Refinement (focused improvement):**
```bash
--temperature 0.7 --generations 2
```

**Quick iteration:**
```bash
--generations 2 --no-judge  # Manual selection
```

**Custom evaluation:**
```bash
# For security-focused skills
python3 scripts/judge.py --criteria "security:40,correctness:30,clarity:30"
```

## Output Structure

```
evolution_workspace/
├── gen_0_seed/skill_000.md
├── gen_1_expand/skill_000.md, skill_001.md
├── gen_2_expand/skill_000-003.md
├── selection_rounds/round_*.json
└── final/evolved_skill.md
```

## Best Practices

1. **Clear intent**: Specific objectives produce better results
2. **Right generations**: 2-3 for optimization, 3-4 for new skills
3. **Review intermediates**: Check gen_2 before full evolution
4. **Custom criteria**: Match judging to domain needs
5. **Temperature tuning**: High for exploration, low for refinement
6. **Monitor metrics**: Check metrics.json in each generation for quality trends
7. **Retry resilience**: LLM failures auto-retry with exponential backoff

## Dependencies

- Python 3.8+
- PyYAML: `pip install pyyaml`
- An LLM CLI tool (e.g. codex, claude, or similar)

## Advanced

**Custom mutations:** See `references/mutation_strategies.md`

**Real examples:** See `references/examples.md`

**Troubleshooting:**
- Low diversity → increase temperature
- Validation failures → decrease temperature, check metrics.json validity_rate
- Judge disagreement → increase number of judges
- LLM timeouts → retries automatic with exponential backoff (max 3 attempts)
- Format errors → improved validation catches frontmatter and structure issues

## Recent Improvements

**v2.0 (2025-11):**
- Fixed format string bug in mutation prompts (evolve_loop.py:79)
- Added retry logic with exponential backoff for LLM calls
- Safe criteria parsing with error handling (judge.py:164)
- Comprehensive validation using utils.py
- Automatic metrics tracking (validity_rate, avg_length) per generation
- Enhanced error reporting with debug logging
