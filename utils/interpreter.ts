// utils/interpreter.ts
import { parse } from 'acorn';
import { VisualizerState, WebTask } from '../types/visualizer';

type AnyNode = Record<string, any>;

const STATEMENT_TYPES = new Set([
  'ExpressionStatement',
  'VariableDeclaration',
  'IfStatement',
  'ForStatement',
  'WhileStatement',
  'ReturnStatement'
]);

export class DynamicInterpreter {
  private rawCode: string;

  constructor(code: string) {
    this.rawCode = code;
  }

  public async generateAllSteps(): Promise<VisualizerState[]> {
    const steps: VisualizerState[] = [];
    const currentLogs: string[] = [];
    const callStack: string[] = [];
    const microtaskQueue: string[] = [];
    const macrotaskQueue: string[] = [];
    const webAPIs: WebTask[] = [];

    const snap = (line = 0) => {
      steps.push({
        callStack: [...callStack],
        webAPIs: [...webAPIs],
        microtaskQueue: [...microtaskQueue],
        macrotaskQueue: [...macrotaskQueue],
        consoleLogs: [...currentLogs],
        currentLine: line
      });
    };

    // Clean up log messaging for custom tracking simulation outputs
    const recordCustomLog = (msg: string) => {
      const cleanMsg = msg.replace('[LOG]: ', '');
      if (cleanMsg.includes('Final Generated Output Sequence') || cleanMsg.startsWith('\n')) return;
      
      callStack.push(`log("${cleanMsg}")`);
      currentLogs.push(cleanMsg);
      snap(0);
      callStack.pop();
      snap(0);
    };

    // AST Instrumentation: Automatically inject custom visualization trackers into runtime methods
    const instrumentCode = (source: string): string => {
      let ast: AnyNode;
      try {
        ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true }) as AnyNode;
      } catch (error) {
        currentLogs.push(`Syntax Error: ${String(error)}`);
        return source;
      }

      const inserts: Array<{ pos: number; text: string }> = [];
      const visit = (node: AnyNode) => {
        if (!node || typeof node !== 'object') return;
        
        if (STATEMENT_TYPES.has(node.type) && node.loc && typeof node.start === 'number') {
          inserts.push({ pos: node.start, text: `__snap(${node.loc.start.line});\n` });
        }

        // Catch custom methods in your EventLoopSimulation script dynamically!
        if (node.type === 'CallExpression') {
          const propName = node.callee?.property?.name || node.callee?.name || '';
          const firstArg = node.arguments[0];
          
          if (propName === 'queueMacrotask') {
            inserts.push({ pos: node.start, text: `__registerMacro();\n` });
          } else if (propName === 'queueMicrotask' || propName === 'then') {
            inserts.push({ pos: node.start, text: `__registerMicro();\n` });
          }
        }

        Object.keys(node).forEach((key) => {
          const child = node[key];
          if (Array.isArray(child)) child.forEach(visit);
          else if (child && typeof child.type === 'string') visit(child);
        });
      };

      visit(ast);
      inserts.sort((a, b) => b.pos - a.pos);
      return inserts.reduce((acc, insert) => acc.slice(0, insert.pos) + insert.text + acc.slice(insert.pos), source);
    };

    const originalConsoleLog = console.log;
    console.log = (message: any) => {
      recordCustomLog(String(message));
    };

    // The execution sandbox environment configuration context map
    const sandbox: Record<string, any> = {
      __snap: (line: number) => snap(line),
      __registerMacro: () => {
        webAPIs.push({ id: Math.random().toString(), name: 'setTimeout task', timer: 0 });
        macrotaskQueue.push('cb_timeout');
        snap(0);
      },
      __registerMicro: () => {
        microtaskQueue.push('cb_microtask');
        snap(0);
      },
      console: {
        log: (msg: any) => recordCustomLog(String(msg))
      },
      setTimeout: (cb: Function, delay = 0) => {
        webAPIs.push({ id: Math.random().toString(), name: `setTimeout (${delay}ms)`, timer: delay });
        macrotaskQueue.push('cb_timeout');
        snap(0);
        return window.setTimeout(() => {
          const idx = macrotaskQueue.indexOf('cb_timeout');
          if (idx !== -1) macrotaskQueue.splice(idx, 1);
          callStack.push('cb_timeout()');
          snap(0);
          cb();
          callStack.pop();
          snap(0);
        }, delay);
      },
      queueMicrotask: (cb: Function) => {
        microtaskQueue.push('queueMicrotask');
        snap(0);
        window.queueMicrotask(() => {
          const idx = microtaskQueue.indexOf('queueMicrotask');
          if (idx !== -1) microtaskQueue.splice(idx, 1);
          callStack.push('microtask()');
          snap(0);
          cb();
          callStack.pop();
          snap(0);
        });
      }
    };

    const instrumentedSource = instrumentCode(this.rawCode);
    const runner = new Function('sandbox', `with (sandbox) { ${instrumentedSource} }`);

    callStack.push('main');
    snap(1);

    try {
      runner(sandbox);
    } catch (error) {
      currentLogs.push(`Runtime Error: ${String(error)}`);
    }

    // Flush remaining simulation elements sequentially to present clean final layout transitions
    if (macrotaskQueue.length > 0 || microtaskQueue.length > 0) {
      while (microtaskQueue.length > 0) {
        microtaskQueue.shift();
        snap(0);
      }
      while (macrotaskQueue.length > 0) {
        macrotaskQueue.shift();
        webAPIs.shift();
        snap(0);
      }
    }

    if (callStack.includes('main')) {
      callStack.pop();
    }
    snap(0);

    console.log = originalConsoleLog;
    return steps;
  }
}