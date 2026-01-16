/**
 * Parser for iostat command output
 */
/**
 * Parse iostat -xz output
 * Example format:
 * Device            r/s     rkB/s   rrqm/s  %rrqm r_await rareq-sz     w/s     wkB/s   wrqm/s  %wrqm w_await wareq-sz     d/s     dkB/s   drqm/s  %drqm d_await dareq-sz     f/s f_await  aqu-sz  %util
 * sda              1.23    45.67     0.12   8.89    1.23    37.09    2.34    89.01     0.45  16.12    2.34    38.05    0.00     0.00     0.00   0.00    0.00     0.00    0.00    0.00    0.01   0.23
 */
export function parseIostat(output) {
    const devices = [];
    const lines = output.split('\n');
    let headerLine = -1;
    let headers = [];
    // Find the Device header line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('Device')) {
            headerLine = i;
            headers = line.split(/\s+/);
            break;
        }
    }
    if (headerLine < 0) {
        return devices;
    }
    // Parse device lines after header
    for (let i = headerLine + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('Device'))
            continue;
        const values = line.split(/\s+/);
        if (values.length < 2)
            continue;
        const deviceName = values[0];
        // Create a map of header to value
        const getValue = (name) => {
            const idx = headers.indexOf(name);
            if (idx >= 0 && idx < values.length) {
                return parseFloat(values[idx]) || 0;
            }
            return 0;
        };
        // Handle different iostat versions and column names
        const readsPerSec = getValue('r/s');
        const writesPerSec = getValue('w/s');
        // rkB/s and wkB/s for KB, convert to bytes
        const readKbPerSec = getValue('rkB/s') || getValue('rMB/s') * 1024;
        const writeKbPerSec = getValue('wkB/s') || getValue('wMB/s') * 1024;
        // Average queue size
        const avgQueue = getValue('aqu-sz') || getValue('avgqu-sz');
        // Utilization
        const util = getValue('%util');
        // Wait time (await includes both read and write)
        const rAwait = getValue('r_await');
        const wAwait = getValue('w_await');
        const avgWait = readsPerSec + writesPerSec > 0
            ? (rAwait * readsPerSec + wAwait * writesPerSec) / (readsPerSec + writesPerSec)
            : 0;
        devices.push({
            name: deviceName,
            reads_per_sec: readsPerSec,
            writes_per_sec: writesPerSec,
            read_bytes_per_sec: readKbPerSec * 1024,
            write_bytes_per_sec: writeKbPerSec * 1024,
            avg_queue_size: avgQueue,
            utilization: util,
            avg_wait_ms: avgWait,
        });
    }
    return devices;
}
/**
 * Parse iostat -c output for CPU stats (simpler format)
 * Example:
 * avg-cpu:  %user   %nice %system %iowait  %steal   %idle
 *            1.23    0.00    0.45    0.12    0.00   98.20
 */
export function parseIostatCpu(output) {
    const lines = output.split('\n');
    let headerFound = false;
    let headers = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('avg-cpu:')) {
            headers = trimmed.replace('avg-cpu:', '').trim().split(/\s+/);
            headerFound = true;
            continue;
        }
        if (headerFound && trimmed) {
            const values = trimmed.split(/\s+/);
            const getValue = (name) => {
                const idx = headers.indexOf(name);
                return idx >= 0 ? parseFloat(values[idx]) || 0 : 0;
            };
            return {
                user: getValue('%user'),
                system: getValue('%system'),
                iowait: getValue('%iowait'),
                idle: getValue('%idle'),
            };
        }
    }
    return null;
}
//# sourceMappingURL=iostat.js.map