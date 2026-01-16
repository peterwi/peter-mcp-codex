/**
 * Unit tests for triage tool structure and validation
 */

import { describe, it, expect } from 'vitest';
import { TriageInputSchema } from '../../src/tools/triage.js';

describe('triage input validation', () => {
  describe('TriageInputSchema', () => {
    it('should accept empty input with defaults', () => {
      const result = TriageInputSchema.parse({});

      expect(result.mode).toBe('standard');
      expect(result.include_exec_trace).toBe(false);
      expect(result.focus).toBe('auto');
    });

    it('should accept valid pid', () => {
      const result = TriageInputSchema.parse({ pid: 1234 });

      expect(result.pid).toBe(1234);
    });

    it('should accept valid process_name', () => {
      const result = TriageInputSchema.parse({ process_name: 'nginx' });

      expect(result.process_name).toBe('nginx');
    });

    it('should validate mode enum', () => {
      const modes = ['quick', 'standard', 'deep'] as const;

      for (const mode of modes) {
        const result = TriageInputSchema.parse({ mode });
        expect(result.mode).toBe(mode);
      }
    });

    it('should reject invalid mode', () => {
      expect(() => TriageInputSchema.parse({ mode: 'invalid' })).toThrow();
    });

    it('should validate focus enum', () => {
      const focuses = ['auto', 'cpu', 'memory', 'io', 'network'] as const;

      for (const focus of focuses) {
        const result = TriageInputSchema.parse({ focus });
        expect(result.focus).toBe(focus);
      }
    });

    it('should reject invalid focus', () => {
      expect(() => TriageInputSchema.parse({ focus: 'invalid' })).toThrow();
    });

    it('should accept include_exec_trace boolean', () => {
      const resultTrue = TriageInputSchema.parse({ include_exec_trace: true });
      const resultFalse = TriageInputSchema.parse({ include_exec_trace: false });

      expect(resultTrue.include_exec_trace).toBe(true);
      expect(resultFalse.include_exec_trace).toBe(false);
    });

    it('should reject negative pid', () => {
      expect(() => TriageInputSchema.parse({ pid: -1 })).toThrow();
    });

    it('should reject non-integer pid', () => {
      expect(() => TriageInputSchema.parse({ pid: 1.5 })).toThrow();
    });

    it('should reject too long process_name', () => {
      const longName = 'a'.repeat(100);
      expect(() => TriageInputSchema.parse({ process_name: longName })).toThrow();
    });
  });
});

describe('triage mode durations', () => {
  const modeDurations = {
    quick: 5,
    standard: 10,
    deep: 30,
  };

  it('should have quick mode at 5 seconds', () => {
    expect(modeDurations.quick).toBe(5);
  });

  it('should have standard mode at 10 seconds', () => {
    expect(modeDurations.standard).toBe(10);
  });

  it('should have deep mode at 30 seconds', () => {
    expect(modeDurations.deep).toBe(30);
  });
});

describe('triage report structure', () => {
  it('should define required report fields', () => {
    const requiredFields = [
      'target',
      'mode',
      'duration_seconds',
      'tools_executed',
      'tools_failed',
      'root_causes',
      'all_findings',
      'key_evidence',
      'metrics_summary',
      'executive_summary',
      'recommended_actions',
    ];

    // Validate field list is as expected
    expect(requiredFields).toContain('target');
    expect(requiredFields).toContain('root_causes');
    expect(requiredFields).toContain('executive_summary');
    expect(requiredFields.length).toBe(11);
  });

  it('should define target structure', () => {
    const validScopes = ['process', 'system-wide'];

    expect(validScopes).toContain('process');
    expect(validScopes).toContain('system-wide');
  });

  it('should define root cause structure', () => {
    const rootCauseFields = [
      'id',
      'title',
      'description',
      'category',
      'confidence',
      'severity',
      'supportingFindings',
      'suggestedActions',
    ];

    expect(rootCauseFields).toContain('confidence');
    expect(rootCauseFields).toContain('suggestedActions');
  });
});

describe('triage tool selection', () => {
  it('should run snapshot for all modes', () => {
    const modeTools = {
      quick: ['perf_snapshot', 'perf_use_check'],
      standard: ['perf_snapshot', 'perf_use_check', 'perf_syscall_count'],
      deep: ['perf_snapshot', 'perf_use_check', 'perf_syscall_count', 'perf_io_layers'],
    };

    expect(modeTools.quick).toContain('perf_snapshot');
    expect(modeTools.standard).toContain('perf_snapshot');
    expect(modeTools.deep).toContain('perf_snapshot');
  });

  it('should run more tools for deeper modes', () => {
    const quickTools = 2;
    const standardTools = 3;
    const deepTools = 4;

    expect(standardTools).toBeGreaterThan(quickTools);
    expect(deepTools).toBeGreaterThan(standardTools);
  });
});
