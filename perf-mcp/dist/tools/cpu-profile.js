/**
 * perf_cpu_profile tool - On-CPU profiling
 */
import { hostname } from 'node:os';
import { getCachedCapabilities, detectCapabilities } from '../lib/detect.js';
import { safeExec, isExecError } from '../lib/exec.js';
import { TOOL_VERSION, ErrorCode, ERROR_SUGGESTIONS, TIMEOUTS } from '../lib/constants.js';
import { parsePerfReport, calculateKernelUserSplit } from '../parse/perf.js';
export async function perfCpuProfile(options = {}) {
    const startTime = Date.now();
    const warnings = [];
    const { duration_seconds = 5, sample_rate_hz = 99, pid, include_kernel = true, output_format: _output_format = 'summary', } = options;
    try {
        // Check capabilities
        let caps;
        try {
            caps = getCachedCapabilities();
        }
        catch {
            caps = await detectCapabilities();
        }
        if (!caps.hasPerf) {
            return {
                success: false,
                tool: 'perf_cpu_profile',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: hostname(),
                error: {
                    code: ErrorCode.TOOL_NOT_FOUND,
                    message: 'perf tool not installed',
                    recoverable: false,
                    suggestion: ERROR_SUGGESTIONS[ErrorCode.TOOL_NOT_FOUND],
                },
            };
        }
        if (!caps.canUsePerf) {
            return {
                success: false,
                tool: 'perf_cpu_profile',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: hostname(),
                error: {
                    code: ErrorCode.PERMISSION_DENIED,
                    message: `perf access restricted (paranoid=${caps.perfEventParanoid})`,
                    recoverable: false,
                    suggestion: ERROR_SUGGESTIONS[ErrorCode.PERMISSION_DENIED],
                },
            };
        }
        // Build perf record command
        const recordArgs = ['record', '-F', String(sample_rate_hz), '-g'];
        if (pid) {
            recordArgs.push('-p', String(pid));
        }
        else {
            recordArgs.push('-a'); // System-wide
        }
        if (!include_kernel) {
            recordArgs.push('--user-callchains');
        }
        recordArgs.push('--', 'sleep', String(duration_seconds));
        // Run perf record
        const recordTimeout = (duration_seconds + 10) * 1000;
        const recordResult = await safeExec('perf', recordArgs, { timeout: recordTimeout });
        if (isExecError(recordResult)) {
            return {
                success: false,
                tool: 'perf_cpu_profile',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: hostname(),
                error: {
                    code: recordResult.code,
                    message: recordResult.message,
                    recoverable: recordResult.recoverable,
                    suggestion: recordResult.suggestion,
                },
            };
        }
        if (!recordResult.success) {
            warnings.push(`perf record stderr: ${recordResult.stderr.slice(0, 200)}`);
        }
        // Run perf report
        const reportArgs = ['report', '--stdio', '--no-children', '-g', 'none'];
        const reportResult = await safeExec('perf', reportArgs, { timeout: TIMEOUTS.DEFAULT });
        if (isExecError(reportResult)) {
            return {
                success: false,
                tool: 'perf_cpu_profile',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: hostname(),
                error: {
                    code: reportResult.code,
                    message: reportResult.message,
                    recoverable: reportResult.recoverable,
                    suggestion: reportResult.suggestion,
                },
            };
        }
        // Parse the report
        const samples = parsePerfReport(reportResult.stdout);
        const { kernelPercent, userPercent } = calculateKernelUserSplit(samples);
        // Count total samples from report header
        const totalSamplesMatch = reportResult.stdout.match(/(\d+)\s+samples/);
        const totalSamples = totalSamplesMatch ? parseInt(totalSamplesMatch[1], 10) : samples.length;
        // Generate notes
        const notes = [];
        if (kernelPercent > 30) {
            notes.push(`High kernel time (${kernelPercent.toFixed(1)}%) - check syscall frequency`);
        }
        if (samples.some((s) => s.symbol.includes('malloc') || s.symbol.includes('free'))) {
            notes.push('Memory allocation functions detected - consider object pooling');
        }
        if (samples.some((s) => s.symbol.includes('spinlock') || s.symbol.includes('mutex'))) {
            notes.push('Lock contention detected - review synchronization');
        }
        const data = {
            total_samples: totalSamples,
            duration_seconds,
            sample_rate: sample_rate_hz,
            top_functions: samples.slice(0, 20), // Top 20
            kernel_percent: kernelPercent,
            user_percent: userPercent,
            notes,
        };
        return {
            success: true,
            tool: 'perf_cpu_profile',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: hostname(),
            data,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
    catch (err) {
        const error = err;
        return {
            success: false,
            tool: 'perf_cpu_profile',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: hostname(),
            error: {
                code: 'EXECUTION_FAILED',
                message: error.message,
                recoverable: true,
                suggestion: 'Check system permissions and perf availability',
            },
        };
    }
}
//# sourceMappingURL=cpu-profile.js.map