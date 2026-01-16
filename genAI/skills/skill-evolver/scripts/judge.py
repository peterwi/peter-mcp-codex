#!/usr/bin/env python3
"""
Skill Evaluation System - Multi-judge voting for variant selection

Usage:
    judge.py --generation-dir ./gen_4 --test-case "scenario" --keep-top 8
"""

import asyncio
import argparse
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional
import tempfile

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


JUDGE_PROMPT = """Evaluate this skill against the test scenario.

TEST: {test_case}

SKILL:
{skill}

Score 0-100 on each criterion, then provide brief feedback.

Output JSON only:
{{
  "correctness": <0-100>,
  "clarity": <0-100>,
  "usability": <0-100>,
  "efficiency": <0-100>,
  "feedback": "brief explanation"
}}
"""


async def call_judge(skill: str, test_case: str) -> Optional[Dict]:
    """Single judge evaluation"""
    prompt = JUDGE_PROMPT.format(test_case=test_case, skill=skill)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(prompt)
        prompt_file = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--temperature", "0.3", "--file", prompt_file,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await proc.communicate()
        Path(prompt_file).unlink(missing_ok=True)

        if proc.returncode != 0:
            return None

        response = stdout.decode('utf-8').strip()
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            response = response.split("```")[1].split("```")[0].strip()

        return json.loads(response)
    except Exception as e:
        logger.error(f"Judge call failed: {e}")
        return None


async def evaluate_skill(skill_path: Path, test_case: str, num_judges: int, criteria: Dict) -> Dict:
    """Evaluate single skill with multiple judges"""
    skill = skill_path.read_text()
    tasks = [call_judge(skill, test_case) for _ in range(num_judges)]
    results = await asyncio.gather(*tasks)

    valid = [r for r in results if r]
    if not valid:
        return {"skill": skill_path.name, "score": 0, "feedback": ["No valid evaluations"]}

    # Average across judges and apply weights
    avg_scores = {k: sum(r.get(k, 0) for r in valid) / len(valid)
                  for k in ["correctness", "clarity", "usability", "efficiency"]}

    total_weight = sum(criteria.values())
    weighted_score = sum(avg_scores[k] * criteria.get(k, 0) for k in avg_scores) / total_weight

    return {
        "skill": skill_path.name,
        "score": weighted_score,
        "judge_scores": valid,
        "feedback": [r.get("feedback", "") for r in valid]
    }


async def evaluate_generation(gen_dir: Path, test_case: str, num_judges: int, criteria: Dict) -> List[Dict]:
    """Evaluate all skills in generation"""
    skills = sorted(gen_dir.glob("skill_*.md"))
    logger.info(f"Evaluating {len(skills)} skills with {num_judges} judges")

    tasks = [evaluate_skill(s, test_case, num_judges, criteria) for s in skills]
    results = await asyncio.gather(*tasks)

    results.sort(key=lambda x: x["score"], reverse=True)
    return results


def select_winners(results: List[Dict], keep_top: int) -> List[Dict]:
    """Select top N skills"""
    winners = results[:keep_top]
    logger.info(f"Selected {len(winners)} winners:")
    for i, w in enumerate(winners, 1):
        logger.info(f"  #{i}: {w['skill']} (score: {w['score']:.1f})")
    return winners


async def run_selection(gen_dir: Path, test_case: str, keep_top: int, output_file: Optional[Path] = None):
    """Main selection function (called from evolve_loop.py)"""
    criteria = {"correctness": 30, "clarity": 25, "usability": 25, "efficiency": 20}
    results = await evaluate_generation(gen_dir, test_case, num_judges=3, criteria=criteria)
    winners = select_winners(results, keep_top)

    if output_file:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(json.dumps({"results": results, "winners": [w["skill"] for w in winners]}, indent=2))

    # Load winner variants
    from evolve_loop import SkillVariant

    winner_variants = []
    for w in winners:
        skill_path = gen_dir / w["skill"]
        meta_path = skill_path.with_name(skill_path.stem + "_meta.json")

        content = skill_path.read_text()
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            variant = SkillVariant(content, meta["generation"], meta["variant_id"], meta["lineage"])
        else:
            variant = SkillVariant(content, 0, 0, [])

        variant.score = w["score"]
        winner_variants.append(variant)

    return winner_variants


def main():
    parser = argparse.ArgumentParser(description="Evaluate and select skill variants")
    parser.add_argument("--generation-dir", required=True, help="Directory with skill variants")
    parser.add_argument("--test-case", required=True, help="Test scenario")
    parser.add_argument("--judges", type=int, default=3, help="Number of judges (default: 3)")
    parser.add_argument("--keep-top", type=int, help="Number of winners (default: half)")
    parser.add_argument("--criteria", default="correctness:30,clarity:25,usability:25,efficiency:20",
                       help="Evaluation criteria weights")
    parser.add_argument("--output-file", help="Output JSON file")

    args = parser.parse_args()

    gen_dir = Path(args.generation_dir)
    num_skills = len(list(gen_dir.glob("skill_*.md")))
    keep_top = args.keep_top or max(1, num_skills // 2)

    # Fix: Safe parsing of criteria with error handling
    try:
        criteria = {}
        for item in args.criteria.split(','):
            if ':' not in item:
                logger.error(f"Invalid criteria format: {item}")
                continue
            k, v = item.split(':', 1)
            criteria[k.strip()] = int(v.strip())
    except ValueError as e:
        logger.error(f"Failed to parse criteria: {e}")
        return

    results = asyncio.run(evaluate_generation(gen_dir, args.test_case, args.judges, criteria))
    winners = select_winners(results, keep_top)

    if args.output_file:
        Path(args.output_file).write_text(json.dumps({
            "test_case": args.test_case,
            "criteria": criteria,
            "results": results,
            "winners": [w["skill"] for w in winners]
        }, indent=2))


if __name__ == "__main__":
    main()
