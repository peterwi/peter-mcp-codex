#!/usr/bin/env python3
"""
Evolutionary Skill Optimizer - Genetic algorithm for skill evolution

Usage:
    evolve_loop.py --intent "Create a skill for..." [options]
"""

import asyncio
import argparse
import json
import logging
from pathlib import Path
from typing import List, Optional
import tempfile

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


class SkillVariant:
    """Single skill variant"""
    def __init__(self, content: str, generation: int, variant_id: int, lineage: List[int]):
        self.content = content
        self.generation = generation
        self.variant_id = variant_id
        self.lineage = lineage
        self.score: Optional[float] = None

    def is_valid(self) -> bool:
        """Check markdown validity using comprehensive utils validation"""
        from utils import validate_skill
        valid, errors = validate_skill(self.content)
        if not valid:
            logger.debug(f"Variant {self.variant_id} validation errors: {errors}")
        return valid


async def call_llm(prompt: str, temperature: float = 1.0, cli: str = "claude", max_retries: int = 3) -> Optional[str]:
    """Call LLM CLI with prompt and retry logic"""
    for attempt in range(max_retries):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(prompt)
            prompt_file = f.name

        try:
            cmd = ["claude", "--temperature", str(temperature), "--file", prompt_file] if cli == "claude" \
                  else ["qune", "--temp", str(temperature), "--input", prompt_file]

            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout, stderr = await proc.communicate()

            Path(prompt_file).unlink(missing_ok=True)
            
            if proc.returncode == 0:
                return stdout.decode('utf-8').strip()
            else:
                logger.warning(f"LLM call attempt {attempt+1}/{max_retries} failed (rc={proc.returncode})")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
        except Exception as e:
            logger.error(f"LLM call attempt {attempt+1}/{max_retries} exception: {e}")
            Path(prompt_file).unlink(missing_ok=True)
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
    
    return None


MUTATIONS = {
    "tone": "Rewrite with {style} tone. SKILL:\n{skill}\n\nOutput ONLY mutated SKILL.md with frontmatter.",
    "structure": "Reorganize using {approach} structure. SKILL:\n{skill}\n\nOutput ONLY restructured SKILL.md.",
    "examples": "Add {num} concrete examples. SKILL:\n{skill}\n\nOutput ONLY enhanced SKILL.md.",
    "optimize": "Optimize for {focus}. Remove redundancy. SKILL:\n{skill}\n\nOutput ONLY optimized SKILL.md."
}

MUTATION_PARAMS = {
    "tone": ["casual", "formal", "tutorial", "technical"],
    "structure": ["workflow-based", "task-based", "reference-based"],
    "examples": ["2", "3", "4"],
    "optimize": ["clarity", "conciseness", "examples"]
}


async def mutate(parent: SkillVariant, mut_type: str, config: dict, var_id: int) -> Optional[SkillVariant]:
    """Apply mutation to parent"""
    import random
    param_val = random.choice(MUTATION_PARAMS[mut_type])

    # Fix: Use keyword arguments matching the template placeholders
    kwargs = {'skill': parent.content}
    if mut_type == "tone":
        kwargs['style'] = param_val
    elif mut_type == "structure":
        kwargs['approach'] = param_val
    elif mut_type == "examples":
        kwargs['num'] = param_val
    elif mut_type == "optimize":
        kwargs['focus'] = param_val
    
    prompt = MUTATIONS[mut_type].format(**kwargs)

    content = await call_llm(prompt, config['temperature'], config['cli'])
    if not content:
        return None

    variant = SkillVariant(content, parent.generation + 1, var_id, parent.lineage + [parent.variant_id])
    return variant if variant.is_valid() else None


async def expand_generation(parents: List[SkillVariant], config: dict, gen: int) -> List[SkillVariant]:
    """Expand population through mutation"""
    logger.info(f"Gen {gen}: Expanding {len(parents)} → {len(parents)*2}")

    import random
    tasks = []
    var_id = 0

    for parent in parents:
        for _ in range(2):  # 2 offspring per parent
            mut_type = random.choice(list(MUTATIONS.keys()))
            tasks.append(mutate(parent, mut_type, config, var_id))
            var_id += 1

    offspring = await asyncio.gather(*tasks)
    valid = [o for o in offspring if o and o.is_valid()]
    logger.info(f"Gen {gen}: Created {len(valid)} valid variants")
    return valid


def save_generation(variants: List[SkillVariant], gen_dir: Path):
    """Save generation to disk with metrics report"""
    from utils import calculate_metrics
    
    gen_dir.mkdir(parents=True, exist_ok=True)
    for i, v in enumerate(variants):
        (gen_dir / f"skill_{i:03d}.md").write_text(v.content)
        (gen_dir / f"skill_{i:03d}_meta.json").write_text(
            json.dumps({"variant_id": v.variant_id, "generation": v.generation,
                       "lineage": v.lineage, "score": v.score}, indent=2))
    
    # Save generation metrics
    metrics = calculate_metrics(variants)
    (gen_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    logger.info(f"Metrics: {metrics['valid_variants']}/{metrics['total_variants']} valid, "
                f"avg length: {metrics['avg_length']}")


def create_seed(intent: str, base_content: Optional[str] = None) -> SkillVariant:
    """Generate seed skill"""
    if base_content:
        return SkillVariant(base_content, 0, 0, [])

    name = intent.lower().replace(' ', '-')[:40]
    content = f"""---
name: {name}
description: {intent}
---

# {intent.title()}

## Overview

{intent}

## Usage

To be evolved through genetic algorithm.
"""
    return SkillVariant(content, 0, 0, [])


async def run_evolution(config: dict):
    """Main evolution loop"""
    logger.info(f"Starting evolution: {config['intent']}")
    out_dir = Path(config['output_dir'])
    out_dir.mkdir(parents=True, exist_ok=True)

    # Seed
    base = Path(config['base_skill']).read_text() if config['base_skill'] else None
    seed = create_seed(config['intent'], base)

    if not seed.is_valid():
        logger.error("Invalid seed")
        return

    save_generation([seed], out_dir / "gen_0_seed")
    population = [seed]

    # Expansion
    for gen in range(1, config['generations'] + 1):
        population = await expand_generation(population, config, gen)
        save_generation(population, out_dir / f"gen_{gen}_expand")

        if not population:
            logger.error("Population died")
            return

    # Selection
    if not config['no_judge']:
        from judge import run_selection

        selection_dir = out_dir / "selection_rounds"
        round_num = 1

        while len(population) > 1:
            logger.info(f"Selection round {round_num}: {len(population)} → {len(population)//2}")

            temp_dir = selection_dir / f"round_{round_num}_input"
            save_generation(population, temp_dir)

            population = await run_selection(
                temp_dir, config['intent'], len(population)//2,
                selection_dir / f"round_{round_num}.json")
            round_num += 1

        # Winner
        final_dir = out_dir / "final"
        final_dir.mkdir(exist_ok=True)
        (final_dir / "evolved_skill.md").write_text(population[0].content)
        logger.info(f"Winner: {final_dir}/evolved_skill.md (score: {population[0].score})")
    else:
        logger.info(f"Expansion complete: {len(population)} variants")


def main():
    parser = argparse.ArgumentParser(description="Evolve skills through genetic algorithms")
    parser.add_argument("--intent", required=True, help="Skill objective")
    parser.add_argument("--generations", type=int, default=3, help="Expansion stages (default: 3)")
    parser.add_argument("--temperature", type=float, default=1.0, help="Mutation randomness (default: 1.0)")
    parser.add_argument("--output-dir", default="./evolution_workspace", help="Output directory")
    parser.add_argument("--base-skill", help="Existing skill to optimize")
    parser.add_argument("--no-judge", action="store_true", help="Skip selection phase")
    parser.add_argument("--cli", default="claude", choices=["claude", "qune"], help="LLM CLI tool")

    args = parser.parse_args()

    config = {
        'intent': args.intent,
        'generations': args.generations,
        'temperature': args.temperature,
        'output_dir': args.output_dir,
        'base_skill': args.base_skill,
        'no_judge': args.no_judge,
        'cli': args.cli
    }

    asyncio.run(run_evolution(config))


if __name__ == "__main__":
    main()
