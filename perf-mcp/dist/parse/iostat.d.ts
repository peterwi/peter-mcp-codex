/**
 * Parser for iostat command output
 */
import type { IoDeviceStats } from '../lib/schemas.js';
/**
 * Parse iostat -xz output
 * Example format:
 * Device            r/s     rkB/s   rrqm/s  %rrqm r_await rareq-sz     w/s     wkB/s   wrqm/s  %wrqm w_await wareq-sz     d/s     dkB/s   drqm/s  %drqm d_await dareq-sz     f/s f_await  aqu-sz  %util
 * sda              1.23    45.67     0.12   8.89    1.23    37.09    2.34    89.01     0.45  16.12    2.34    38.05    0.00     0.00     0.00   0.00    0.00     0.00    0.00    0.00    0.01   0.23
 */
export declare function parseIostat(output: string): IoDeviceStats[];
/**
 * Parse iostat -c output for CPU stats (simpler format)
 * Example:
 * avg-cpu:  %user   %nice %system %iowait  %steal   %idle
 *            1.23    0.00    0.45    0.12    0.00   98.20
 */
export declare function parseIostatCpu(output: string): {
    user: number;
    system: number;
    iowait: number;
    idle: number;
} | null;
//# sourceMappingURL=iostat.d.ts.map