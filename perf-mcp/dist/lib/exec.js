/**
 * Safe command execution module
 * CRITICAL SAFETY: This is the ONLY way to execute external commands
 * All commands must be in the allowlist with validated arguments
 */
import { spawn } from 'node:child_process';
import { access, constants, readFile } from 'node:fs/promises';
import { ALLOWED_EXECUTABLES, ALLOWED_READ_PATHS, ErrorCode, ERROR_SUGGESTIONS, OUTPUT_LIMITS, TIMEOUTS, } from './constants.js';
/**
 * Validate that an argument is safe
 * Rejects any argument containing shell metacharacters
 */
function isArgSafe(arg) {
    // Reject shell metacharacters and control characters
    const unsafePattern = /[;&|`$(){}[\]<>\\!#*?~\n\r\t\x00-\x1f]/;
    return !unsafePattern.test(arg);
}
/**
 * Validate arguments against allowlist for a command
 */
function validateArgs(command, args) {
    for (const arg of args) {
        // Safety check: no shell metacharacters
        if (!isArgSafe(arg)) {
            return false;
        }
        // Check if it's an allowed flag/option
        if (arg.startsWith('-') || command.allowedArgs.includes(arg)) {
            // Check against allowlist
            const isAllowed = command.allowedArgs.some((allowed) => arg === allowed || arg.startsWith(allowed + '='));
            if (!isAllowed && !command.allowsNumericArgs) {
                return false;
            }
            continue;
        }
        // Allow numeric arguments if permitted (for intervals, counts, PIDs)
        if (command.allowsNumericArgs && /^\d+$/.test(arg)) {
            continue;
        }
        // Allow simple identifiers (device names, CPU specs like "ALL")
        if (/^[a-zA-Z0-9_-]+$/.test(arg)) {
            continue;
        }
        // Allow file paths for specific commands (will be validated separately)
        if (arg.startsWith('/') && !arg.includes('..')) {
            continue;
        }
        return false;
    }
    return true;
}
/**
 * Execute an allowed command safely
 * This is the ONLY entry point for running external programs
 */
export async function safeExec(commandName, args, options = {}) {
    const command = ALLOWED_EXECUTABLES[commandName];
    // Check if command is in allowlist
    if (!command) {
        const error = {
            code: ErrorCode.PERMISSION_DENIED,
            message: `Command '${commandName}' is not in the allowed list`,
            suggestion: 'Only allowlisted commands can be executed',
        };
        return {
            success: false,
            ...error,
            recoverable: false,
            stdout: '',
            stderr: '',
            error,
        };
    }
    // Validate arguments
    if (!validateArgs(command, args)) {
        const error = {
            code: ErrorCode.INVALID_PARAMS,
            message: `Invalid arguments for '${commandName}'`,
            suggestion: 'Arguments contain disallowed characters or options',
        };
        return {
            success: false,
            ...error,
            recoverable: false,
            stdout: '',
            stderr: '',
            error,
        };
    }
    // Check if executable exists
    try {
        await access(command.path, constants.X_OK);
    }
    catch {
        const error = {
            code: ErrorCode.TOOL_NOT_FOUND,
            message: `Executable not found: ${command.path}`,
            suggestion: ERROR_SUGGESTIONS[ErrorCode.TOOL_NOT_FOUND],
        };
        return {
            success: false,
            ...error,
            recoverable: false,
            stdout: '',
            stderr: '',
            error,
        };
    }
    const timeout = options.timeout ?? TIMEOUTS.DEFAULT;
    const maxOutput = options.maxOutput ?? OUTPUT_LIMITS.DEFAULT;
    const startTime = Date.now();
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let truncated = false;
        let timedOut = false;
        // Spawn process with NO SHELL
        const proc = spawn(command.path, args, {
            cwd: options.cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout,
            // No shell - this is critical for safety
            shell: false,
        });
        const timeoutId = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGKILL');
        }, timeout);
        proc.stdout.on('data', (data) => {
            if (stdout.length < maxOutput) {
                stdout += data.toString();
                if (stdout.length > maxOutput) {
                    stdout = stdout.slice(0, maxOutput);
                    truncated = true;
                }
            }
            else {
                truncated = true;
            }
        });
        proc.stderr.on('data', (data) => {
            stderr += data.toString().slice(0, 4096); // Limit stderr
        });
        proc.on('close', (exitCode) => {
            clearTimeout(timeoutId);
            const durationMs = Date.now() - startTime;
            if (timedOut) {
                const error = {
                    code: ErrorCode.TIMEOUT,
                    message: `Command timed out after ${timeout}ms`,
                    suggestion: ERROR_SUGGESTIONS[ErrorCode.TIMEOUT],
                };
                resolve({
                    success: false,
                    ...error,
                    recoverable: true,
                    stdout: '',
                    stderr: '',
                    error,
                });
                return;
            }
            const success = exitCode === 0;
            resolve({
                success,
                stdout,
                stderr,
                exitCode,
                truncated,
                durationMs,
                error: success ? undefined : {
                    code: ErrorCode.EXECUTION_FAILED,
                    message: stderr || `Command exited with code ${exitCode}`,
                },
            });
        });
        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            const error = {
                code: ErrorCode.EXECUTION_FAILED,
                message: `Failed to execute: ${err.message}`,
                suggestion: ERROR_SUGGESTIONS[ErrorCode.EXECUTION_FAILED],
            };
            resolve({
                success: false,
                ...error,
                recoverable: false,
                stdout: '',
                stderr: '',
                error,
            });
        });
    });
}
/**
 * Check if a path is allowed for reading
 */
function isPathAllowed(path) {
    // Normalize path and prevent traversal
    if (path.includes('..') || !path.startsWith('/')) {
        return false;
    }
    // Check exact matches
    if (ALLOWED_READ_PATHS.procfs.includes(path) || ALLOWED_READ_PATHS.sysfs.includes(path)) {
        return true;
    }
    // Check patterns
    for (const pattern of ALLOWED_READ_PATHS.procfsPatterns) {
        if (pattern.test(path)) {
            return true;
        }
    }
    for (const pattern of ALLOWED_READ_PATHS.sysfsPatterns) {
        if (pattern.test(path)) {
            return true;
        }
    }
    return false;
}
/**
 * Safely read a file from allowed paths
 */
export async function safeReadFile(path, options = {}) {
    // Validate path is allowed
    if (!isPathAllowed(path)) {
        const error = {
            code: ErrorCode.PERMISSION_DENIED,
            message: `Path '${path}' is not in the allowed list`,
            suggestion: 'Only specific procfs/sysfs paths can be read',
        };
        return {
            success: false,
            ...error,
            recoverable: false,
            stdout: '',
            stderr: '',
            error,
        };
    }
    const maxSize = options.maxSize ?? OUTPUT_LIMITS.DEFAULT;
    try {
        // Check file exists and is readable
        await access(path, constants.R_OK);
        // Read with size limit
        const content = await readFile(path, { encoding: 'utf-8' });
        const truncatedContent = content.slice(0, maxSize);
        return {
            success: true,
            content: truncatedContent,
        };
    }
    catch (caughtErr) {
        const nodeError = caughtErr;
        if (nodeError.code === 'ENOENT') {
            const err = {
                code: ErrorCode.FILE_NOT_FOUND,
                message: `File not found: ${path}`,
                suggestion: 'File may not exist on this system',
            };
            return {
                success: false,
                ...err,
                recoverable: false,
                stdout: '',
                stderr: '',
                error: err,
            };
        }
        if (nodeError.code === 'EACCES') {
            const err = {
                code: ErrorCode.PERMISSION_DENIED,
                message: `Permission denied reading: ${path}`,
                suggestion: 'Run with appropriate permissions',
            };
            return {
                success: false,
                ...err,
                recoverable: false,
                stdout: '',
                stderr: '',
                error: err,
            };
        }
        const err = {
            code: ErrorCode.EXECUTION_FAILED,
            message: `Failed to read file: ${nodeError.message}`,
            suggestion: 'Check file accessibility',
        };
        return {
            success: false,
            ...err,
            recoverable: false,
            stdout: '',
            stderr: '',
            error: err,
        };
    }
}
/**
 * Check if a command is available on the system
 */
export async function isCommandAvailable(commandName) {
    const command = ALLOWED_EXECUTABLES[commandName];
    if (!command) {
        return false;
    }
    try {
        await access(command.path, constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Type guard to check if result is an error
 */
export function isExecError(result) {
    return 'code' in result && !('stdout' in result);
}
//# sourceMappingURL=exec.js.map