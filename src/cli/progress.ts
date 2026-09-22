import type {
  RunOptions,
  RunProgressEvent,
  RunResult,
} from '../engine/run-evaluation.js';
import type {TrialRecord} from '../types/index.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const ANSI_DIM = '\u001b[2m';
const ANSI_RESET = '\u001b[0m';

function padded(value: string, width: number): string {
  return value.padEnd(width);
}

export function formatSpinnerLine(
  frame: string,
  label: string,
  seconds: string,
  color: boolean,
): string {
  if (!color) return `${frame} Running ${label} · ${seconds}s`;
  return `${frame} Running ${label} ${ANSI_DIM}· ${seconds}s${ANSI_RESET}`;
}

export function formatTrialHeader(caseWidth: number): string {
  return [
    padded('case', caseWidth),
    padded('repeat', 6),
    padded('status', 6),
    padded('solved', 6),
    padded('clean', 5),
    padded('terminal', 9),
    padded('elapsed_ms', 10),
    'total_tokens',
  ].join('  ');
}

export function formatTrialRow(trial: TrialRecord, caseWidth: number): string {
  return [
    padded(trial.caseId, caseWidth),
    padded(String(trial.repeat), 6),
    padded(trial.status, 6),
    padded(String(trial.solved), 6),
    padded(String(trial.clean), 5),
    padded(trial.terminalStatus, 9),
    padded(String(trial.elapsedMs), 10),
    String(trial.usage?.totalTokens ?? '-'),
  ].join('  ');
}

export class ProgressDisplay {
  private caseWidth = 'case'.length;
  private frame = 0;
  private timer: NodeJS.Timeout | undefined;
  private activeStarted = 0;
  private activeLabel = '';

  constructor(private readonly options: Pick<RunOptions, 'agent' | 'model'>) {}

  handle(event: RunProgressEvent): void {
    if (event.kind === 'run-start') {
      this.caseWidth = Math.max('case'.length, ...event.caseIds.map((id) => id.length));
      const model = this.options.model ?? 'default';
      process.stdout.write([
        'Agent Eval Harness',
        '',
        `  agent    ${this.options.agent}`,
        `  model    ${model}`,
        `  tier     ${event.tier ?? 'all'}`,
        `  module   ${event.module ?? 'all'}`,
        `  cases    ${event.caseIds.length}`,
        `  trials   ${event.total}`,
        '',
        formatTrialHeader(this.caseWidth),
      ].join('\n') + '\n');
      return;
    }

    if (event.kind === 'trial-start') {
      const label = `${event.caseId} (repeat ${event.repeat})`;
      if (process.stdout.isTTY) {
        this.startSpinner(label);
      } else {
        process.stdout.write(`running ${event.completed + 1}/${event.total}  ${label}\n`);
      }
      return;
    }

    this.stopSpinner();
    process.stdout.write(`${formatTrialRow(event.trial, this.caseWidth)}\n`);
  }

  finish(result: RunResult): void {
    this.stopSpinner();
    process.stdout.write('\n');
    process.stdout.write(
      `report   ${result.report.terminalStatus}   ` +
      `passes ${result.report.aggregate.passes.count}/${result.report.aggregate.passes.of}   ` +
      `errors ${result.report.aggregate.errors}\n`,
    );
    for (const tier of result.report.aggregate.byTier) {
      process.stdout.write(
        `tier     ${tier.tier}   passes ${tier.passes.count}/${tier.passes.of}\n`,
      );
    }
    process.stdout.write(
      `selection tier ${result.report.selection.tier ?? 'all'}   ` +
      `module ${result.report.selection.module ?? 'all'}   ` +
      `verdict ${result.report.selectionVerdict}\n`,
    );
    process.stdout.write(`result   ${result.resultPath}\n`);
  }

  stop(): void {
    this.stopSpinner();
  }

  private startSpinner(label: string): void {
    this.stopSpinner();
    this.activeLabel = label;
    this.activeStarted = Date.now();
    this.frame = 0;
    this.drawSpinner();
    this.timer = setInterval(() => this.drawSpinner(), 80);
    this.timer.unref();
  }

  private drawSpinner(): void {
    const frame = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length]!;
    const seconds = ((Date.now() - this.activeStarted) / 1_000).toFixed(1);
    const color = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
    process.stdout.write(`\r\u001b[2K${formatSpinnerLine(frame, this.activeLabel, seconds, color)}`);
    this.frame += 1;
  }

  private stopSpinner(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.activeLabel !== '' && process.stdout.isTTY) {
      process.stdout.write('\r\u001b[2K');
    }
    this.activeLabel = '';
  }
}
