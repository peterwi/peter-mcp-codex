/**
 * Parsers for BCC (BPF Compiler Collection) tool outputs
 * These tools provide deep eBPF-based analysis
 */
export function parseOffcputime(output) {
    const lines = output.trim().split('\n').filter((l) => l.trim());
    const entries = [];
    let totalBlockedUs = 0;
    // Function aggregation
    const functionTotals = new Map();
    for (const line of lines) {
        // Skip headers and empty lines
        if (!line || line.startsWith('#') || line.startsWith('Tracing'))
            continue;
        // Format: stack;stack;func count
        const lastSpaceIdx = line.lastIndexOf(' ');
        if (lastSpaceIdx === -1)
            continue;
        const stackStr = line.substring(0, lastSpaceIdx).trim();
        const countStr = line.substring(lastSpaceIdx + 1).trim();
        const count = parseInt(countStr, 10);
        if (isNaN(count) || !stackStr)
            continue;
        const stack = stackStr.split(';').filter((s) => s);
        const func = stack[stack.length - 1] || 'unknown';
        entries.push({
            stack,
            function: func,
            totalUs: count,
        });
        totalBlockedUs += count;
        functionTotals.set(func, (functionTotals.get(func) || 0) + count);
    }
    // Sort by total blocked time
    const topFunctions = Array.from(functionTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([func, totalUs]) => ({
        function: func,
        totalUs,
        percent: totalBlockedUs > 0 ? (totalUs / totalBlockedUs) * 100 : 0,
    }));
    return { entries, totalBlockedUs, topFunctions };
}
export function parseBiolatency(output) {
    const lines = output.trim().split('\n');
    const buckets = [];
    let unit = 'usecs';
    let totalOps = 0;
    let weightedSum = 0;
    let currentDevice = null;
    const perDevice = {};
    for (const line of lines) {
        // Detect unit from header
        if (line.includes('usecs'))
            unit = 'usecs';
        else if (line.includes('msecs'))
            unit = 'msecs';
        else if (line.includes('nsecs'))
            unit = 'nsecs';
        // Detect device header (for -D flag output)
        const deviceMatch = line.match(/^disk\s*=\s*'?(\w+)'?/i);
        if (deviceMatch) {
            currentDevice = deviceMatch[1];
            if (!perDevice[currentDevice]) {
                perDevice[currentDevice] = [];
            }
            continue;
        }
        // Parse histogram bucket
        // Format: "   8 -> 15         : 45       |********"
        const bucketMatch = line.match(/^\s*(\d+)\s*->\s*(\d+)\s*:\s*(\d+)/);
        if (bucketMatch) {
            const rangeStart = parseInt(bucketMatch[1], 10);
            const rangeEnd = parseInt(bucketMatch[2], 10);
            const count = parseInt(bucketMatch[3], 10);
            const bucket = { rangeStart, rangeEnd, count, unit };
            buckets.push(bucket);
            if (currentDevice) {
                perDevice[currentDevice].push(bucket);
            }
            totalOps += count;
            // Use midpoint for weighted average
            weightedSum += ((rangeStart + rangeEnd) / 2) * count;
        }
    }
    // Calculate percentiles
    const avgLatencyUs = totalOps > 0 ? weightedSum / totalOps : 0;
    let p50Us = 0;
    let p99Us = 0;
    let maxLatencyUs = 0;
    if (buckets.length > 0) {
        const p50Target = totalOps * 0.5;
        const p99Target = totalOps * 0.99;
        let cumulative = 0;
        for (const bucket of buckets) {
            cumulative += bucket.count;
            const midpoint = (bucket.rangeStart + bucket.rangeEnd) / 2;
            if (p50Us === 0 && cumulative >= p50Target) {
                p50Us = midpoint;
            }
            if (p99Us === 0 && cumulative >= p99Target) {
                p99Us = midpoint;
            }
            if (bucket.count > 0) {
                maxLatencyUs = bucket.rangeEnd;
            }
        }
    }
    // Convert to microseconds if needed
    const multiplier = unit === 'msecs' ? 1000 : unit === 'nsecs' ? 0.001 : 1;
    return {
        buckets,
        totalOps,
        avgLatencyUs: avgLatencyUs * multiplier,
        p50Us: p50Us * multiplier,
        p99Us: p99Us * multiplier,
        maxLatencyUs: maxLatencyUs * multiplier,
        perDevice: Object.keys(perDevice).length > 0 ? perDevice : undefined,
    };
}
export function parseRunqlat(output) {
    // Reuse biolatency parser as format is identical
    const result = parseBiolatency(output);
    return {
        buckets: result.buckets,
        totalWakeups: result.totalOps,
        avgLatencyUs: result.avgLatencyUs,
        p50Us: result.p50Us,
        p99Us: result.p99Us,
        maxLatencyUs: result.maxLatencyUs,
    };
}
export function parseTcpLife(output) {
    const lines = output.trim().split('\n');
    const connections = [];
    let totalTxKb = 0;
    let totalRxKb = 0;
    let totalDurationMs = 0;
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('PID') || line.startsWith('Tracing') || !line.trim())
            continue;
        // Parse: PID COMM LADDR LPORT RADDR RPORT TX_KB RX_KB MS
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9)
            continue;
        const pid = parseInt(parts[0], 10);
        const comm = parts[1];
        const localAddr = parts[2];
        const localPort = parseInt(parts[3], 10);
        const remoteAddr = parts[4];
        const remotePort = parseInt(parts[5], 10);
        const txKb = parseFloat(parts[6]);
        const rxKb = parseFloat(parts[7]);
        const durationMs = parseFloat(parts[8]);
        if (isNaN(pid) || isNaN(localPort))
            continue;
        const entry = {
            pid,
            comm,
            localAddr,
            localPort,
            remoteAddr,
            remotePort,
            txKb,
            rxKb,
            durationMs,
        };
        connections.push(entry);
        totalTxKb += txKb;
        totalRxKb += rxKb;
        totalDurationMs += durationMs;
    }
    const avgDurationMs = connections.length > 0 ? totalDurationMs / connections.length : 0;
    // Top connections by duration
    const topByDuration = [...connections]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 10);
    // Top connections by traffic
    const topByTraffic = [...connections]
        .sort((a, b) => (b.txKb + b.rxKb) - (a.txKb + a.rxKb))
        .slice(0, 10);
    return {
        connections,
        totalConnections: connections.length,
        totalTxKb,
        totalRxKb,
        avgDurationMs,
        topByDuration,
        topByTraffic,
    };
}
export function parseTcpConnect(output) {
    const lines = output.trim().split('\n');
    const connections = [];
    const byPort = {};
    const byComm = {};
    let totalLatencyUs = 0;
    let latencyCount = 0;
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('PID') || line.startsWith('Tracing') || !line.trim())
            continue;
        // Parse: PID COMM IP SADDR DADDR DPORT [LAT(ms)]
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6)
            continue;
        const pid = parseInt(parts[0], 10);
        const comm = parts[1];
        const ipVersion = parseInt(parts[2], 10);
        const sourceAddr = parts[3];
        const destAddr = parts[4];
        const destPort = parseInt(parts[5], 10);
        if (isNaN(pid) || isNaN(destPort))
            continue;
        const entry = {
            pid,
            comm,
            ipVersion,
            sourceAddr,
            destAddr,
            destPort,
        };
        // Optional latency field
        if (parts.length >= 7) {
            const latencyMs = parseFloat(parts[6]);
            if (!isNaN(latencyMs)) {
                entry.latencyUs = latencyMs * 1000;
                totalLatencyUs += entry.latencyUs;
                latencyCount++;
            }
        }
        connections.push(entry);
        byPort[destPort] = (byPort[destPort] || 0) + 1;
        byComm[comm] = (byComm[comm] || 0) + 1;
    }
    return {
        connections,
        totalAttempts: connections.length,
        byPort,
        byComm,
        avgLatencyUs: latencyCount > 0 ? totalLatencyUs / latencyCount : undefined,
    };
}
export function parseExecsnoop(output) {
    const lines = output.trim().split('\n');
    const executions = [];
    const byComm = {};
    let failedExecs = 0;
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('TIME') || line.startsWith('PCOMM') || line.startsWith('Tracing') || !line.trim())
            continue;
        // Parse: TIME PCOMM PID PPID RET ARGS
        // Time is optional depending on flags
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5)
            continue;
        let idx = 0;
        let timestamp;
        // Check if first field looks like a timestamp
        if (parts[0].includes(':') || parts[0].match(/^\d+\.\d+$/)) {
            timestamp = parts[idx++];
        }
        const parentComm = parts[idx++];
        const pid = parseInt(parts[idx++], 10);
        const ppid = parseInt(parts[idx++], 10);
        const returnCode = parseInt(parts[idx++], 10);
        const args = parts.slice(idx).join(' ');
        if (isNaN(pid))
            continue;
        const entry = {
            timestamp,
            parentComm,
            pid,
            ppid,
            returnCode,
            args,
        };
        executions.push(entry);
        // Extract command name from args
        const cmdMatch = args.match(/^(\S+)/);
        const cmd = cmdMatch ? cmdMatch[1].split('/').pop() || 'unknown' : 'unknown';
        byComm[cmd] = (byComm[cmd] || 0) + 1;
        if (returnCode !== 0) {
            failedExecs++;
        }
    }
    return {
        executions,
        totalExecs: executions.length,
        byComm,
        failedExecs,
    };
}
export function parseSyscount(output) {
    const lines = output.trim().split('\n');
    const syscalls = [];
    let totalCalls = 0;
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('SYSCALL') || line.startsWith('Tracing') || line.startsWith('Detaching') || !line.trim())
            continue;
        // Parse: SYSCALL COUNT [ERRORS]
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2)
            continue;
        const syscall = parts[0];
        const count = parseInt(parts[1], 10);
        if (isNaN(count))
            continue;
        const entry = { syscall, count };
        if (parts.length >= 3) {
            const errors = parseInt(parts[2], 10);
            if (!isNaN(errors)) {
                entry.errors = errors;
            }
        }
        syscalls.push(entry);
        totalCalls += count;
    }
    // Already sorted by count in descending order typically
    const topSyscalls = syscalls.slice(0, 20);
    return {
        syscalls,
        totalCalls,
        topSyscalls,
    };
}
export function parseSyscountWithLatency(output) {
    const lines = output.trim().split('\n');
    const syscalls = [];
    let totalCalls = 0;
    let totalTimeUs = 0;
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('SYSCALL') || line.startsWith('Tracing') || line.startsWith('Detaching') || !line.trim())
            continue;
        // Parse: SYSCALL COUNT TIME
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3)
            continue;
        const syscall = parts[0];
        const count = parseInt(parts[1], 10);
        const time = parseInt(parts[2], 10);
        if (isNaN(count) || isNaN(time))
            continue;
        const entry = {
            syscall,
            count,
            totalTimeUs: time,
            avgTimeUs: count > 0 ? time / count : 0,
        };
        syscalls.push(entry);
        totalCalls += count;
        totalTimeUs += time;
    }
    const topByCount = [...syscalls].sort((a, b) => b.count - a.count).slice(0, 20);
    const topByTime = [...syscalls].sort((a, b) => b.totalTimeUs - a.totalTimeUs).slice(0, 20);
    return {
        syscalls,
        totalCalls,
        totalTimeUs,
        topByCount,
        topByTime,
    };
}
export function parseGethostlatency(output) {
    const lines = output.trim().split('\n');
    const lookups = [];
    const latencies = [];
    const hostStats = {};
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('TIME') || line.startsWith('Tracing') || !line.trim())
            continue;
        // Parse: TIME PID COMM LATms HOST
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5)
            continue;
        const timestamp = parts[0];
        const pid = parseInt(parts[1], 10);
        const comm = parts[2];
        const latencyMs = parseFloat(parts[3]);
        const host = parts.slice(4).join(' '); // Host might have spaces
        if (isNaN(pid) || isNaN(latencyMs))
            continue;
        lookups.push({ timestamp, pid, comm, latencyMs, host });
        latencies.push(latencyMs);
        if (!hostStats[host]) {
            hostStats[host] = { count: 0, totalMs: 0 };
        }
        hostStats[host].count++;
        hostStats[host].totalMs += latencyMs;
    }
    // Calculate percentiles
    latencies.sort((a, b) => a - b);
    const p50Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;
    const maxLatencyMs = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
    const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const byHost = {};
    for (const [host, stats] of Object.entries(hostStats)) {
        byHost[host] = {
            count: stats.count,
            avgLatencyMs: stats.count > 0 ? stats.totalMs / stats.count : 0,
        };
    }
    return {
        lookups,
        totalLookups: lookups.length,
        avgLatencyMs,
        p50Ms,
        p95Ms,
        p99Ms,
        maxLatencyMs,
        byHost,
    };
}
export function parseFilelife(output) {
    const lines = output.trim().split('\n');
    const files = [];
    const byProcess = {};
    let shortLivedCount = 0;
    let totalAge = 0;
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('TIME') || line.startsWith('Tracing') || !line.trim())
            continue;
        // Parse: TIME PID COMM AGE(s) FILE
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5)
            continue;
        const timestamp = parts[0];
        const pid = parseInt(parts[1], 10);
        const comm = parts[2];
        const ageSeconds = parseFloat(parts[3]);
        const filename = parts.slice(4).join(' ');
        if (isNaN(pid) || isNaN(ageSeconds))
            continue;
        files.push({ timestamp, pid, comm, ageSeconds, filename });
        totalAge += ageSeconds;
        if (ageSeconds < 1) {
            shortLivedCount++;
        }
        byProcess[comm] = (byProcess[comm] || 0) + 1;
    }
    return {
        files,
        totalFiles: files.length,
        avgAgeSeconds: files.length > 0 ? totalAge / files.length : 0,
        shortLivedCount,
        byProcess,
    };
}
export function parseFileslower(output) {
    const lines = output.trim().split('\n');
    const operations = [];
    const latencies = [];
    const byFile = {};
    const byProcess = {};
    let readOps = 0;
    let writeOps = 0;
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('TIME') || line.startsWith('Tracing') || !line.trim())
            continue;
        // Parse: TIME(s) COMM PID D BYTES LAT(ms) FILENAME
        const parts = line.trim().split(/\s+/);
        if (parts.length < 7)
            continue;
        const timeSeconds = parseFloat(parts[0]);
        const comm = parts[1];
        const pid = parseInt(parts[2], 10);
        const direction = parts[3];
        const bytes = parseInt(parts[4], 10);
        const latencyMs = parseFloat(parts[5]);
        const filename = parts.slice(6).join(' ');
        if (isNaN(pid) || isNaN(latencyMs))
            continue;
        operations.push({ timeSeconds, comm, pid, direction, bytes, latencyMs, filename });
        latencies.push(latencyMs);
        if (direction === 'R')
            readOps++;
        else
            writeOps++;
        // Aggregate by file
        if (!byFile[filename]) {
            byFile[filename] = { count: 0, totalMs: 0 };
        }
        byFile[filename].count++;
        byFile[filename].totalMs += latencyMs;
        // Aggregate by process
        if (!byProcess[comm]) {
            byProcess[comm] = { count: 0, totalMs: 0 };
        }
        byProcess[comm].count++;
        byProcess[comm].totalMs += latencyMs;
    }
    // Calculate stats
    latencies.sort((a, b) => a - b);
    const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p95LatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const maxLatencyMs = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
    // Convert aggregates
    const byFileResult = {};
    for (const [file, stats] of Object.entries(byFile)) {
        byFileResult[file] = {
            count: stats.count,
            avgLatencyMs: stats.count > 0 ? stats.totalMs / stats.count : 0,
        };
    }
    const byProcessResult = {};
    for (const [proc, stats] of Object.entries(byProcess)) {
        byProcessResult[proc] = {
            count: stats.count,
            avgLatencyMs: stats.count > 0 ? stats.totalMs / stats.count : 0,
        };
    }
    return {
        operations,
        totalOps: operations.length,
        avgLatencyMs,
        p95LatencyMs,
        maxLatencyMs,
        byFile: byFileResult,
        byProcess: byProcessResult,
        readOps,
        writeOps,
    };
}
export function parseOpensnoop(output) {
    const lines = output.trim().split('\n');
    const opens = [];
    const byProcess = {};
    const byPath = {};
    let failedOpens = 0;
    for (const line of lines) {
        // Skip header and tracing messages
        if (line.startsWith('PID') || line.startsWith('TIME') || line.startsWith('Tracing') || !line.trim())
            continue;
        // Parse: [TIME] PID COMM FD ERR PATH
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5)
            continue;
        let idx = 0;
        let timestamp;
        // Check if first field is timestamp
        if (parts[0].includes(':') || parts[0].match(/^\d+\.\d+$/)) {
            timestamp = parts[idx++];
        }
        const pid = parseInt(parts[idx++], 10);
        const comm = parts[idx++];
        const fd = parseInt(parts[idx++], 10);
        const err = parseInt(parts[idx++], 10);
        const path = parts.slice(idx).join(' ');
        if (isNaN(pid))
            continue;
        opens.push({ timestamp, pid, comm, fd, err, path });
        if (err !== 0 || fd < 0) {
            failedOpens++;
        }
        byProcess[comm] = (byProcess[comm] || 0) + 1;
        byPath[path] = (byPath[path] || 0) + 1;
    }
    return {
        opens,
        totalOpens: opens.length,
        failedOpens,
        byProcess,
        byPath,
    };
}
export function parseBpftraceLinearHistogram(output) {
    const lines = output.trim().split('\n');
    const buckets = [];
    let unit = 'usecs';
    let totalOps = 0;
    let weightedSum = 0;
    for (const line of lines) {
        // Detect unit from variable name
        if (line.includes('@usecs') || line.includes('@us'))
            unit = 'usecs';
        else if (line.includes('@msecs') || line.includes('@ms'))
            unit = 'msecs';
        else if (line.includes('@nsecs') || line.includes('@ns'))
            unit = 'nsecs';
        // Parse linear histogram bucket
        // Format: "[start, end)   count |bars|" or "[start, end]   count |bars|"
        const bucketMatch = line.match(/^\s*\[(\d+),\s*(\d+)[)\]]\s+(\d+)\s*\|/);
        if (bucketMatch) {
            const rangeStart = parseInt(bucketMatch[1], 10);
            const rangeEnd = parseInt(bucketMatch[2], 10);
            const count = parseInt(bucketMatch[3], 10);
            buckets.push({ rangeStart, rangeEnd, count });
            totalOps += count;
            // Use midpoint for weighted average
            weightedSum += ((rangeStart + rangeEnd) / 2) * count;
        }
    }
    // Calculate percentiles
    const avgValueUs = totalOps > 0 ? weightedSum / totalOps : 0;
    let p50Us = 0;
    let p99Us = 0;
    let maxValueUs = 0;
    if (buckets.length > 0) {
        const p50Target = totalOps * 0.5;
        const p99Target = totalOps * 0.99;
        let cumulative = 0;
        for (const bucket of buckets) {
            cumulative += bucket.count;
            const midpoint = (bucket.rangeStart + bucket.rangeEnd) / 2;
            if (p50Us === 0 && cumulative >= p50Target) {
                p50Us = midpoint;
            }
            if (p99Us === 0 && cumulative >= p99Target) {
                p99Us = midpoint;
            }
            if (bucket.count > 0) {
                maxValueUs = bucket.rangeEnd;
            }
        }
    }
    // Convert to microseconds if needed
    const multiplier = unit === 'msecs' ? 1000 : unit === 'nsecs' ? 0.001 : 1;
    return {
        buckets,
        totalOps,
        avgValueUs: avgValueUs * multiplier,
        p50Us: p50Us * multiplier,
        p99Us: p99Us * multiplier,
        maxValueUs: maxValueUs * multiplier,
        unit,
    };
}
export function parseVfsstat(output) {
    const lines = output.trim().split('\n');
    const entries = [];
    const totals = { reads: 0, writes: 0, fsyncs: 0, opens: 0, creates: 0, unlinks: 0, mkdirs: 0, rmdirs: 0 };
    for (const line of lines) {
        // Skip header
        if (line.includes('READ/s') || line.startsWith('TIME') || !line.trim())
            continue;
        // Parse: TIME READ/s WRITE/s FSYNC/s OPEN/s CREATE/s UNLINK/s MKDIR/s RMDIR/s
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9)
            continue;
        const timestamp = parts[0];
        const reads = parseInt(parts[1], 10);
        const writes = parseInt(parts[2], 10);
        const fsyncs = parseInt(parts[3], 10);
        const opens = parseInt(parts[4], 10);
        const creates = parseInt(parts[5], 10);
        const unlinks = parseInt(parts[6], 10);
        const mkdirs = parseInt(parts[7], 10);
        const rmdirs = parseInt(parts[8], 10);
        if (isNaN(reads))
            continue;
        entries.push({ timestamp, reads, writes, fsyncs, opens, creates, unlinks, mkdirs, rmdirs });
        totals.reads += reads;
        totals.writes += writes;
        totals.fsyncs += fsyncs;
        totals.opens += opens;
        totals.creates += creates;
        totals.unlinks += unlinks;
        totals.mkdirs += mkdirs;
        totals.rmdirs += rmdirs;
    }
    const count = entries.length || 1;
    const avgPerSecond = {
        reads: totals.reads / count,
        writes: totals.writes / count,
        fsyncs: totals.fsyncs / count,
        opens: totals.opens / count,
        creates: totals.creates / count,
        unlinks: totals.unlinks / count,
        mkdirs: totals.mkdirs / count,
        rmdirs: totals.rmdirs / count,
    };
    return { entries, totals, avgPerSecond };
}
//# sourceMappingURL=bcc.js.map