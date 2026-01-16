/**
 * Integration smoke tests
 * These tests run actual tools and verify basic functionality
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { detectCapabilities, clearCapabilityCache } from '../../src/lib/detect.js';
import { perfInfo } from '../../src/tools/info.js';
import { perfSnapshot } from '../../src/tools/snapshot.js';
import { perfUseCheck } from '../../src/tools/use-check.js';
import { perfNetHealth } from '../../src/tools/net-health.js';

// Skip tests if not on Linux
const isLinux = process.platform === 'linux';
const describeLinux = isLinux ? describe : describe.skip;

describeLinux('smoke tests', () => {
  beforeAll(async () => {
    // Clear capability cache to ensure fresh detection
    clearCapabilityCache();
    await detectCapabilities();
  });

  describe('perf_info', () => {
    it('should return system information', async () => {
      const result = await perfInfo();

      expect(result.success).toBe(true);
      expect(result.tool).toBe('perf_info');
      expect(result.data).toBeDefined();

      if (result.data) {
        expect(result.data.system.hostname).toBeTruthy();
        expect(result.data.system.kernel).toBeTruthy();
        expect(result.data.cpu.cores).toBeGreaterThan(0);
        expect(result.data.cpu.threads).toBeGreaterThan(0);
        expect(result.data.memory.total_bytes).toBeGreaterThan(0);
      }
    });

    it('should detect capabilities', async () => {
      const result = await perfInfo();

      expect(result.success).toBe(true);
      expect(result.data?.capabilities).toBeDefined();
      expect(typeof result.data?.capabilities.perf_available).toBe('boolean');
      expect(typeof result.data?.capabilities.psi_enabled).toBe('boolean');
    });
  });

  describe('perf_snapshot', () => {
    it('should return system metrics', async () => {
      const result = await perfSnapshot();

      expect(result.success).toBe(true);
      expect(result.tool).toBe('perf_snapshot');
      expect(result.data).toBeDefined();

      if (result.data) {
        // CPU metrics
        expect(result.data.cpu.load_avg).toHaveLength(3);
        expect(result.data.cpu.utilization.idle).toBeGreaterThanOrEqual(0);
        expect(result.data.cpu.utilization.idle).toBeLessThanOrEqual(100);

        // Memory metrics
        expect(result.data.memory.total_bytes).toBeGreaterThan(0);
        expect(result.data.memory.available_bytes).toBeGreaterThanOrEqual(0);

        // Network metrics
        expect(Array.isArray(result.data.network.interfaces)).toBe(true);
      }
    });

    it('should include PSI if available', async () => {
      const caps = await detectCapabilities();
      const result = await perfSnapshot({ include_psi: true });

      expect(result.success).toBe(true);

      if (caps.hasPsi && result.data) {
        expect(result.data.pressure).toBeDefined();
        expect(result.data.pressure?.cpu).toBeDefined();
        expect(result.data.pressure?.memory).toBeDefined();
        expect(result.data.pressure?.io).toBeDefined();
      }
    });
  });

  describe('perf_use_check', () => {
    it('should perform USE method analysis', async () => {
      const result = await perfUseCheck();

      expect(result.success).toBe(true);
      expect(result.tool).toBe('perf_use_check');
      expect(result.data).toBeDefined();

      if (result.data) {
        // Summary
        expect(['healthy', 'warning', 'critical']).toContain(result.data.summary.status);
        expect(Array.isArray(result.data.summary.top_suspicions)).toBe(true);

        // Resources
        expect(result.data.resources.cpu).toBeDefined();
        expect(result.data.resources.memory).toBeDefined();
        expect(result.data.resources.disk).toBeDefined();
        expect(result.data.resources.network).toBeDefined();

        // Each resource should have USE metrics
        const checkResource = (resource: typeof result.data.resources.cpu) => {
          expect(['ok', 'warning', 'critical']).toContain(resource.utilization.status);
          expect(['ok', 'warning', 'critical']).toContain(resource.saturation.status);
          expect(['ok', 'warning', 'critical']).toContain(resource.errors.status);
        };

        checkResource(result.data.resources.cpu);
        checkResource(result.data.resources.memory);
        checkResource(result.data.resources.disk);
        checkResource(result.data.resources.network);
      }
    });
  });

  describe('perf_net_health', () => {
    it('should return network health metrics', async () => {
      const result = await perfNetHealth();

      expect(result.success).toBe(true);
      expect(result.tool).toBe('perf_net_health');
      expect(result.data).toBeDefined();

      if (result.data) {
        expect(Array.isArray(result.data.interfaces)).toBe(true);
        expect(result.data.tcp).toBeDefined();
        expect(typeof result.data.tcp.retransmit_rate).toBe('number');
        expect(result.data.socket_summary).toBeDefined();
        expect(Array.isArray(result.data.issues)).toBe(true);
      }
    });
  });
});

describeLinux('capability detection', () => {
  it('should detect kernel version', async () => {
    const caps = await detectCapabilities();

    expect(caps.kernelVersion).toBeTruthy();
    expect(caps.kernelMajor).toBeGreaterThanOrEqual(4);
  });

  it('should detect cgroup version', async () => {
    const caps = await detectCapabilities();

    expect([1, 2]).toContain(caps.cgroupVersion);
  });

  it('should detect CPU count', async () => {
    const caps = await detectCapabilities();

    expect(caps.cpuCount).toBeGreaterThan(0);
  });

  it('should detect virtualization', async () => {
    const caps = await detectCapabilities();

    expect([
      'none',
      'kvm',
      'xen',
      'vmware',
      'hyperv',
      'docker',
      'lxc',
      'podman',
      'unknown',
    ]).toContain(caps.virtualization);
  });
});

describeLinux('error handling', () => {
  it('should handle invalid PID gracefully', async () => {
    const { perfCgroupSummary } = await import('../../src/tools/cgroup-summary.js');

    // Use a PID that almost certainly doesn't exist
    const result = await perfCgroupSummary({ pid: 999999999 });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBeTruthy();
  });
});
