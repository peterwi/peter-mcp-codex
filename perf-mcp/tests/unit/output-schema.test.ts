/**
 * Unit tests for standardized output schema
 */

import { describe, it, expect } from 'vitest';
import {
  createFinding,
  createEvidence,
  generateSummary,
  type Finding,
  type Evidence,
} from '../../src/lib/output-schema.js';

describe('output schema utilities', () => {
  describe('createFinding', () => {
    it('should create a valid finding with required fields', () => {
      const finding = createFinding(
        'test_issue',
        'warning',
        'Test Issue',
        'This is a test issue description',
        'cpu'
      );

      expect(finding.id).toBe('test_issue');
      expect(finding.severity).toBe('warning');
      expect(finding.title).toBe('Test Issue');
      expect(finding.description).toBe('This is a test issue description');
      expect(finding.category).toBe('cpu');
      expect(finding.confidence).toBe(80); // Default confidence
    });

    it('should accept optional parameters', () => {
      const finding = createFinding(
        'test_issue',
        'critical',
        'Critical Issue',
        'Description',
        'memory',
        {
          confidence: 95,
          metrics: { value: 100 },
          suggestion: 'Try this fix',
        }
      );

      expect(finding.confidence).toBe(95);
      expect(finding.metrics).toEqual({ value: 100 });
      expect(finding.suggestion).toBe('Try this fix');
    });

    it('should handle all severity levels', () => {
      const severities = ['critical', 'warning', 'info', 'ok'] as const;

      for (const severity of severities) {
        const finding = createFinding('id', severity, 'title', 'desc', 'category');
        expect(finding.severity).toBe(severity);
      }
    });
  });

  describe('createEvidence', () => {
    it('should create evidence with source and type', () => {
      const evidence = createEvidence('perf_snapshot', 'metric', {
        cpu_usage: 85,
        memory_pct: 60,
      });

      expect(evidence.source).toBe('perf_snapshot');
      expect(evidence.type).toBe('metric');
      expect(evidence.data).toEqual({ cpu_usage: 85, memory_pct: 60 });
      expect(evidence.timestamp).toBeDefined();
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const evidence = createEvidence('test', 'observation', {});
      const after = Date.now();

      const evidenceTime = new Date(evidence.timestamp).getTime();
      expect(evidenceTime).toBeGreaterThanOrEqual(before);
      expect(evidenceTime).toBeLessThanOrEqual(after);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary from findings', () => {
      const findings: Finding[] = [
        createFinding('issue1', 'critical', 'Critical Issue', 'Desc 1', 'cpu'),
        createFinding('issue2', 'warning', 'Warning Issue', 'Desc 2', 'memory'),
        createFinding('issue3', 'info', 'Info Item', 'Desc 3', 'io'),
      ];

      const summary = generateSummary(findings);

      expect(summary).toContain('1 critical');
      expect(summary).toContain('1 warning');
      expect(summary).toContain('1 info');
    });

    it('should handle empty findings', () => {
      const summary = generateSummary([]);

      expect(summary).toBe('No significant issues detected.');
    });

    it('should prioritize critical issues in summary', () => {
      const findings: Finding[] = [
        createFinding('issue1', 'critical', 'Critical', 'Desc', 'cpu'),
        createFinding('issue2', 'info', 'Info', 'Desc', 'cpu'),
      ];

      const summary = generateSummary(findings);

      // Critical should be mentioned first
      const criticalPos = summary.indexOf('critical');
      const infoPos = summary.indexOf('info');
      expect(criticalPos).toBeLessThan(infoPos);
    });
  });
});

describe('finding categories', () => {
  it('should support standard categories', () => {
    const categories = ['cpu', 'memory', 'io', 'network', 'system'];

    for (const category of categories) {
      const finding = createFinding('id', 'info', 'title', 'desc', category);
      expect(finding.category).toBe(category);
    }
  });
});
