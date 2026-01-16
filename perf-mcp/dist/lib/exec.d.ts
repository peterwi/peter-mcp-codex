/**
 * Safe command execution module
 * CRITICAL SAFETY: This is the ONLY way to execute external commands
 * All commands must be in the allowlist with validated arguments
 */
import { ErrorCode } from './constants.js';
export interface ExecResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    truncated: boolean;
    durationMs: number;
    error?: {
        code: ErrorCode;
        message: string;
        suggestion?: string;
    };
}
export interface ExecError {
    success: false;
    code: ErrorCode;
    message: string;
    suggestion: string;
    recoverable: boolean;
    stdout: '';
    stderr: '';
    error: {
        code: ErrorCode;
        message: string;
        suggestion?: string;
    };
}
/**
 * Execute an allowed command safely
 * This is the ONLY entry point for running external programs
 */
export declare function safeExec(commandName: string, args: string[], options?: {
    timeout?: number;
    maxOutput?: number;
    cwd?: string;
}): Promise<ExecResult | ExecError>;
/**
 * Safely read a file from allowed paths
 */
export declare function safeReadFile(path: string, options?: {
    maxSize?: number;
}): Promise<{
    success: true;
    content: string;
} | ExecError>;
/**
 * Check if a command is available on the system
 */
export declare function isCommandAvailable(commandName: string): Promise<boolean>;
/**
 * Type guard to check if result is an error
 */
export declare function isExecError(result: ExecResult | ExecError): result is ExecError;
//# sourceMappingURL=exec.d.ts.map