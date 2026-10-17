/** Log of the worker: one JSON line per record (stdout / stderr), like the server's pino logs. */
export interface WorkerLog {
  info: (message: string, details?: Record<string, unknown>) => void;
  warn: (message: string, details?: Record<string, unknown>) => void;
  error: (message: string, details?: Record<string, unknown>) => void;
}

const write =
  (level: 'info' | 'warn' | 'error') =>
  (message: string, details: Record<string, unknown> = {}): void => {
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg: message,
      ...details,
    });
    if (level === 'info') process.stdout.write(`${line}\n`);
    else process.stderr.write(`${line}\n`);
  };

export const consoleLog: WorkerLog = {
  info: write('info'),
  warn: write('warn'),
  error: write('error'),
};
