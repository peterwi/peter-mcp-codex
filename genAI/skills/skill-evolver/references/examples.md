# Usage Examples

## Basic Evolution

```bash
# Create new skill
python3 scripts/evolve_loop.py \
  --intent "Create a skill for writing Python unit tests with pytest" \
  --generations 3

# Result: evolution_workspace/final/evolved_skill.md
```

## Optimize Existing Skill

```bash
# Improve existing skill
python3 scripts/evolve_loop.py \
  --base-skill ../pdf-editor/SKILL.md \
  --intent "Optimize for clarity and add examples" \
  --generations 2 \
  --output-dir ./pdf-optimized
```

## Temperature Control

```bash
# High diversity (exploration)
--temperature 1.3 --generations 3

# Low diversity (refinement)
--temperature 0.7 --generations 2
```

## Manual Selection

```bash
# Expansion only
python3 scripts/evolve_loop.py \
  --intent "..." \
  --generations 3 \
  --no-judge

# Manual review
ls evolution_workspace/gen_3_expand/

# Run judge separately
python3 scripts/judge.py \
  --generation-dir ./evolution_workspace/gen_3_expand \
  --test-case "User wants to..." \
  --keep-top 1
```

## Custom Evaluation

```bash
# Security-focused judging
python3 scripts/judge.py \
  --generation-dir ./workspace/gen_3 \
  --test-case "Security review scenario" \
  --criteria "security:40,correctness:30,clarity:30" \
  --judges 5
```

## Output Structure

```
evolution_workspace/
├── gen_0_seed/
│   ├── skill_000.md (original)
│   ├── skill_000_meta.json
│   └── metrics.json (NEW: validity_rate, avg_length)
├── gen_1_expand/
│   ├── skill_000.md
│   ├── skill_001.md (2 variants)
│   ├── skill_*_meta.json
│   └── metrics.json
├── gen_2_expand/
│   ├── skill_000-003.md (4 variants)
│   ├── skill_*_meta.json
│   └── metrics.json
├── gen_3_expand/
│   ├── skill_000-007.md (8 variants)
│   ├── skill_*_meta.json
│   └── metrics.json
├── selection_rounds/
│   ├── round_1.json (8→4)
│   ├── round_2.json (4→2)
│   └── round_3.json (2→1)
└── final/
    └── evolved_skill.md (winner)
```

## Metrics Example

```json
{
  "total_variants": 8,
  "valid_variants": 7,
  "validity_rate": 0.875,
  "avg_length": 1432
}
```
