/**
 * Unit tests for parsers
 */

import { describe, it, expect } from 'vitest';
import {
  parseProcStat,
  parseProcLoadavg,
  parseProcMeminfo,
  parseProcVmstat,
  parseProcNetDev,
  parseProcNetSnmp,
  parseProcPressure,
  parseProcCpuinfo,
} from '../../src/parse/procfs.js';
import { parseIostat } from '../../src/parse/iostat.js';
import { parseSsSummary } from '../../src/parse/ss.js';
import { parsePerfReport, parsePerfSchedLatency } from '../../src/parse/perf.js';
import {
  parseCgroupCpuStat,
  parseCgroupCpuMax,
  parseCgroupMemoryCurrent,
  parseCgroupMemoryMax,
} from '../../src/parse/cgroup.js';

describe('procfs parsers', () => {
  describe('parseProcStat', () => {
    it('should parse CPU statistics', () => {
      const content = `cpu  1000 100 500 8000 200 50 50 100 0 0
cpu0 500 50 250 4000 100 25 25 50 0 0
intr 123456 0 0 0 0 0 0 0 0 0 0 0
ctxt 789012
btime 1704067200
processes 12345
procs_running 5
procs_blocked 2`;

      const result = parseProcStat(content);

      expect(result.cpu.user).toBeCloseTo(10, 0); // 1000/10000 * 100
      expect(result.cpu.system).toBeCloseTo(5, 0);
      expect(result.cpu.idle).toBeCloseTo(80, 0);
      expect(result.contextSwitches).toBe(789012);
      expect(result.interrupts).toBe(123456);
      expect(result.processesRunning).toBe(5);
      expect(result.runQueue).toBe(7); // running + blocked
    });
  });

  describe('parseProcLoadavg', () => {
    it('should parse load averages', () => {
      const content = '1.23 2.34 3.45 5/234 12345\n';

      const result = parseProcLoadavg(content);

      expect(result.loadAvg).toEqual([1.23, 2.34, 3.45]);
      expect(result.runQueue).toBe(5);
      expect(result.totalProcesses).toBe(234);
    });
  });

  describe('parseProcMeminfo', () => {
    it('should parse memory info', () => {
      const content = `MemTotal:       16384000 kB
MemFree:         1024000 kB
MemAvailable:    8192000 kB
Buffers:          512000 kB
Cached:          4096000 kB
SwapTotal:       8192000 kB
SwapFree:        6144000 kB`;

      const result = parseProcMeminfo(content);

      expect(result.total_bytes).toBe(16384000 * 1024);
      expect(result.available_bytes).toBe(8192000 * 1024);
      expect(result.buffers_bytes).toBe(512000 * 1024);
      expect(result.swap_total_bytes).toBe(8192000 * 1024);
      expect(result.swap_used_bytes).toBe(2048000 * 1024); // 8192000 - 6144000
    });
  });

  describe('parseProcNetDev', () => {
    it('should parse network device statistics', () => {
      const content = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
  eth0: 1234567   12345   10    5    0     0          0         0 2345678   23456   20   10    0     0       0          0
    lo:    5000     100    0    0    0     0          0         0    5000     100    0    0    0     0       0          0`;

      const result = parseProcNetDev(content);

      expect(result).toHaveLength(1); // lo is filtered out
      expect(result[0].name).toBe('eth0');
      expect(result[0].rx_bytes).toBe(1234567);
      expect(result[0].rx_packets).toBe(12345);
      expect(result[0].rx_errors).toBe(10);
      expect(result[0].rx_dropped).toBe(5);
      expect(result[0].tx_bytes).toBe(2345678);
    });
  });

  describe('parseProcPressure', () => {
    it('should parse PSI metrics', () => {
      const content = `some avg10=1.23 avg60=2.34 avg300=3.45 total=123456
full avg10=0.12 avg60=0.23 avg300=0.34 total=12345`;

      const result = parseProcPressure(content);

      expect(result.some_avg10).toBe(1.23);
      expect(result.some_avg60).toBe(2.34);
      expect(result.some_avg300).toBe(3.45);
      expect(result.full_avg10).toBe(0.12);
      expect(result.full_avg60).toBe(0.23);
    });
  });

  describe('parseProcCpuinfo', () => {
    it('should parse CPU info', () => {
      const content = `processor	: 0
model name	: Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz
cpu cores	: 8
physical id	: 0
core id	: 0

processor	: 1
model name	: Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz
cpu cores	: 8
physical id	: 0
core id	: 1`;

      const result = parseProcCpuinfo(content);

      expect(result.model).toContain('i7-9700K');
      expect(result.cores).toBe(8);
      expect(result.threads).toBe(2);
    });
  });
});

describe('iostat parser', () => {
  describe('parseIostat', () => {
    it('should parse iostat -xz output', () => {
      const content = `Linux 6.5.0 (myhost) 	01/12/2025 	_x86_64_	(16 CPU)

Device            r/s     rkB/s   rrqm/s  %rrqm r_await rareq-sz     w/s     wkB/s   wrqm/s  %wrqm w_await wareq-sz     d/s     dkB/s   drqm/s  %drqm d_await dareq-sz     f/s f_await  aqu-sz  %util
sda              1.23    45.67     0.12   8.89    1.23    37.09    2.34    89.01     0.45  16.12    2.34    38.05    0.00     0.00     0.00   0.00    0.00     0.00    0.00    0.00    0.01  45.67
nvme0n1         10.00   500.00     1.00   9.09    0.50    50.00   20.00  1000.00     2.00   9.09    0.30    50.00    0.00     0.00     0.00   0.00    0.00     0.00    0.00    0.00    0.05  12.34`;

      const result = parseIostat(content);

      expect(result).toHaveLength(2);

      const sda = result.find((d) => d.name === 'sda');
      expect(sda).toBeDefined();
      expect(sda!.reads_per_sec).toBeCloseTo(1.23, 2);
      expect(sda!.writes_per_sec).toBeCloseTo(2.34, 2);
      expect(sda!.utilization).toBeCloseTo(45.67, 2);

      const nvme = result.find((d) => d.name === 'nvme0n1');
      expect(nvme).toBeDefined();
      expect(nvme!.utilization).toBeCloseTo(12.34, 2);
    });
  });
});

describe('ss parser', () => {
  describe('parseSsSummary', () => {
    it('should parse ss -s output', () => {
      const content = `Total: 234
TCP:   123 (estab 89, closed 12, orphaned 0, timewait 10)

Transport Total     IP        IPv6
RAW	  0         0         0
UDP	  45        40        5
TCP	  123       100       23
INET	  168       140       28
FRAG	  0         0         0`;

      const result = parseSsSummary(content);

      expect(result.tcp_total).toBe(123);
      expect(result.tcp_established).toBe(89);
      expect(result.tcp_time_wait).toBe(10);
      expect(result.udp_total).toBe(45);
    });
  });
});

describe('perf parser', () => {
  describe('parsePerfReport', () => {
    it('should parse perf report --stdio output', () => {
      const content = `# Overhead  Command  Shared Object      Symbol
# ........  .......  .................  ..............................
#
    25.50%  myapp    myapp              [.] processRequest
    12.34%  myapp    libc.so.6          [.] malloc
     8.00%  myapp    [kernel.kallsyms]  [k] copy_user_enhanced_fast_string
     5.00%  myapp    myapp              [.] serialize`;

      const result = parsePerfReport(content);

      expect(result).toHaveLength(4);
      expect(result[0].symbol).toBe('processRequest');
      expect(result[0].percent).toBeCloseTo(25.5, 1);
      expect(result[1].symbol).toBe('malloc');
      expect(result[2].module).toBe('[kernel.kallsyms]');
    });
  });
});

describe('cgroup parser', () => {
  describe('parseCgroupCpuStat', () => {
    it('should parse cpu.stat', () => {
      const content = `usage_usec 1234567890
user_usec 1000000000
system_usec 234567890
nr_periods 12345
nr_throttled 678
throttled_usec 9012345`;

      const result = parseCgroupCpuStat(content);

      expect(result.usage_usec).toBe(1234567890);
      expect(result.user_usec).toBe(1000000000);
      expect(result.nr_throttled).toBe(678);
      expect(result.throttled_usec).toBe(9012345);
    });
  });

  describe('parseCgroupCpuMax', () => {
    it('should parse cpu.max with limit', () => {
      const content = '200000 100000';
      const result = parseCgroupCpuMax(content);

      expect(result.quotaUsec).toBe(200000);
      expect(result.periodUsec).toBe(100000);
      expect(result.limitCores).toBe(2);
    });

    it('should parse cpu.max without limit', () => {
      const content = 'max 100000';
      const result = parseCgroupCpuMax(content);

      expect(result.quotaUsec).toBe(-1);
      expect(result.limitCores).toBeNull();
    });
  });

  describe('parseCgroupMemoryCurrent', () => {
    it('should parse memory.current', () => {
      expect(parseCgroupMemoryCurrent('1234567890')).toBe(1234567890);
      expect(parseCgroupMemoryCurrent('1234567890\n')).toBe(1234567890);
    });
  });

  describe('parseCgroupMemoryMax', () => {
    it('should parse memory.max with limit', () => {
      expect(parseCgroupMemoryMax('8589934592')).toBe(8589934592);
    });

    it('should parse memory.max without limit', () => {
      expect(parseCgroupMemoryMax('max')).toBe(-1);
    });
  });
});
