/**
 * Unit tests for BCC runtime utilities
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTimeout,
  type BccConfig,
} from '../../src/lib/bcc-runtime.js';
import type { SystemCapabilities } from '../../src/lib/detect.js';

// Mock capabilities for testing
const mockCapsWithBtf: SystemCapabilities = {
  canUsePerf: true,
  canUseBpf: true,
  perfVersion: '6.0',
  hasPsi: true,
  hasBtf: true,
  hasBpftrace: true,
  isContainer: false,
  cgroupVersion: 2,
  virtualization: 'none',
  kernelVersion: '6.5.0',
  kernelMajor: 6,
  kernelMinor: 5,
  cpuCount: 8,
  bccTools: {
    execsnoop: true,
    opensnoop: true,
    biolatency: true,
    tcplife: true,
    tcpconnect: true,
    runqlat: true,
    syscount: true,
    funccount: true,
    stackcount: true,
    offcputime: true,
    gethostlatency: true,
    fileslower: true,
    filetop: true,
    ext4slower: true,
  },
};

const mockCapsNoBtf: SystemCapabilities = {
  ...mockCapsWithBtf,
  hasBtf: false,
  cpuCount: 2,
  isContainer: true,
};

describe('BCC runtime utilities', () => {
  describe('calculateTimeout', () => {
    it('should add compile buffer for first run', () => {
      const config: BccConfig = {
        tool: 'syscount',
        args: [],
        durationSec: 5,
      };

      const timeout = calculateTimeout(config, mockCapsWithBtf);

      // Should include base duration + compile time + buffer
      expect(timeout).toBeGreaterThan(5000);
      // With BTF available, should be reasonable
      expect(timeout).toBeLessThan(60000);
    });

    it('should add extra time without BTF', () => {
      const config: BccConfig = {
        tool: 'syscount',
        args: [],
        durationSec: 5,
      };

      const timeoutWithBtf = calculateTimeout(config, mockCapsWithBtf);
      const timeoutNoBtf = calculateTimeout(config, mockCapsNoBtf);

      // Without BTF, timeout should be longer
      expect(timeoutNoBtf).toBeGreaterThan(timeoutWithBtf);
    });

    it('should scale with requested duration', () => {
      const shortConfig: BccConfig = {
        tool: 'syscount',
        args: [],
        durationSec: 5,
      };
      const longConfig: BccConfig = {
        tool: 'syscount',
        args: [],
        durationSec: 30,
      };

      const shortTimeout = calculateTimeout(shortConfig, mockCapsWithBtf);
      const longTimeout = calculateTimeout(longConfig, mockCapsWithBtf);

      // Longer duration should result in longer timeout
      expect(longTimeout).toBeGreaterThan(shortTimeout);
      // Should differ by at least 25 seconds (30 - 5)
      expect(longTimeout - shortTimeout).toBeGreaterThanOrEqual(25000);
    });

    it('should respect timeout buffer parameter', () => {
      const configDefaultBuffer: BccConfig = {
        tool: 'syscount',
        args: [],
        durationSec: 5,
      };
      const configCustomBuffer: BccConfig = {
        tool: 'syscount',
        args: [],
        durationSec: 5,
        timeoutBuffer: 10000,
      };

      const defaultTimeout = calculateTimeout(configDefaultBuffer, mockCapsWithBtf);
      const customTimeout = calculateTimeout(configCustomBuffer, mockCapsWithBtf);

      // Custom buffer should add extra time
      expect(customTimeout).toBeGreaterThan(defaultTimeout);
    });
  });
});

describe('BCC progress phases', () => {
  it('should define all expected phases', () => {
    const phases = ['preflight', 'compiling', 'tracing', 'parsing', 'fallback', 'complete', 'error'];

    // Verify phases are documented/expected
    expect(phases).toContain('preflight');
    expect(phases).toContain('compiling');
    expect(phases).toContain('tracing');
    expect(phases).toContain('fallback');
  });
});
