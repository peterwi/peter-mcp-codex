# Mutation Strategies

## Mutation Types

### Tone Variation
Transform presentation style while preserving functionality.
- formal ↔ casual
- technical ↔ tutorial
- concise ↔ narrative

### Structure Reorganization
Change organizational pattern.
- workflow-based (sequential steps)
- task-based (grouped by functionality)
- reference-based (specifications/standards)

### Example Enhancement
Add concrete usage examples.
- basic/quick start
- intermediate scenarios
- advanced edge cases

### Optimization
Improve specific aspects.
- clarity (simplify language)
- conciseness (remove redundancy)
- examples (add concrete use cases)

## Strategy by Generation

**Early (Gen 1-2):** Maximize diversity
- Tone (50%), Structure (30%), Examples (20%)
- Temperature: High (0.9-1.2)

**Mid (Gen 3-4):** Refine directions
- Examples (40%), Optimize (30%), Structure (30%)
- Temperature: Medium (0.7-1.0)

**Late (Gen 5+):** Polish winners
- Optimize (60%), Examples (40%)
- Temperature: Low (0.5-0.8)

## Troubleshooting

**Problem:** Population converges too quickly
**Solution:** Increase temperature (1.2-1.5)

**Problem:** Mutations fail validation
**Solution:** Decrease temperature (0.7-0.9)

**Problem:** Low judge agreement
**Solution:** Increase number of judges (5-7)
