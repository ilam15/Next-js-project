// utils/interpreter.ts
import { parse } from 'acorn';
import { VisualizerState, WebTask } from '../types/visualizer';

type AnyNode = Record<string, any>;

const STATEMENT_TYPES = new Set([
  'ExpressionStatement',
  'VariableDeclaration',
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'ReturnStatement',
  'TryStatement',
  'ThrowStatement',
  'BreakStatement',
  'ContinueStatement'
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
    const microtaskQueue: Array<{ id: string; name: string; cb: Function; line?: number }> = [];
    const macrotaskQueue: Array<{ id: string; name: string; cb: Function; delay: number; apiId?: string; line?: number }> = [];
    const webAPIs: WebTask[] = [];

    const snap = (line = 0) => {
      steps.push({
        callStack: [...callStack],
        webAPIs: [...webAPIs],
        microtaskQueue: microtaskQueue.map(t => t.name),
        macrotaskQueue: macrotaskQueue.map(t => t.name),
        consoleLogs: [...currentLogs],
        currentLine: line
      });
    };

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

      const getFunctionName = (node: AnyNode, parent?: AnyNode): string => {
        if (node.type === 'FunctionDeclaration' && node.id) {
          return node.id.name;
        }
        if (parent) {
          if (parent.type === 'VariableDeclarator' && parent.id && parent.id.type === 'Identifier') {
            return parent.id.name;
          }
          if (parent.type === 'AssignmentExpression' && parent.left) {
            if (parent.left.type === 'Identifier') return parent.left.name;
            if (parent.left.type === 'MemberExpression' && parent.left.property.type === 'Identifier') {
              return parent.left.property.name;
            }
          }
          if (parent.type === 'Property' && parent.key && parent.key.type === 'Identifier') {
            return parent.key.name;
          }
          if (parent.type === 'CallExpression') {
            const calleeName = parent.callee.name || (parent.callee.property && parent.callee.property.name) || '';
            if (calleeName === 'setTimeout') return 'setTimeout callback';
            if (calleeName === 'setInterval') return 'setInterval callback';
            if (calleeName === 'then') return 'Promise.then callback';
            if (calleeName === 'catch') return 'Promise.catch callback';
            if (calleeName === 'queueMicrotask') return 'queueMicrotask callback';
          }
        }
        return 'anonymous function';
      };

      const visit = (node: AnyNode, parent?: AnyNode) => {
        if (!node || typeof node !== 'object') return;

        const isStatement = STATEMENT_TYPES.has(node.type);
        if (isStatement && node.loc && typeof node.start === 'number') {
          let skipSnap = false;
          if (parent) {
            if (parent.type === 'ForStatement' && (parent.init === node || parent.test === node || parent.update === node)) {
              skipSnap = true;
            }
            if ((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && parent.left === node) {
              skipSnap = true;
            }
          }

          if (!skipSnap) {
            const isNonBlockBody = parent && (
              (parent.type === 'IfStatement' && (parent.consequent === node || parent.alternate === node)) ||
              (parent.type === 'ForStatement' && parent.body === node) ||
              (parent.type === 'ForInStatement' && parent.body === node) ||
              (parent.type === 'ForOfStatement' && parent.body === node) ||
              (parent.type === 'WhileStatement' && parent.body === node) ||
              (parent.type === 'DoWhileStatement' && parent.body === node)
            );

            if (isNonBlockBody && node.type !== 'BlockStatement') {
              inserts.push({ pos: node.start, text: `{ __snap(${node.loc.start.line}); ` });
              inserts.push({ pos: node.end, text: ` }` });
            } else {
              inserts.push({ pos: node.start, text: `__snap(${node.loc.start.line});\n` });
            }
          }
        }

        // Catch custom methods in EventLoopSimulation class: queueMacrotask, queueMicrotask
        if (node.type === 'CallExpression') {
          const firstArg = node.arguments[0];
          
          if (firstArg && (firstArg.type === 'ArrowFunctionExpression' || firstArg.type === 'FunctionExpression' || firstArg.type === 'Identifier')) {
            if (node.callee?.type === 'MemberExpression') {
              const objName = node.callee.object?.name || '';
              const isGlobalObj = objName === 'window' || objName === 'globalThis' || objName === 'global';
              
              if (!isGlobalObj) {
                const propName = node.callee.property?.name || '';
                if (propName === 'queueMacrotask') {
                  inserts.push({ pos: firstArg.start, text: `__wrapMacro(` });
                  inserts.push({ pos: firstArg.end, text: `, "cb_timeout")` });
                } else if (propName === 'queueMicrotask') {
                  inserts.push({ pos: firstArg.start, text: `__wrapMicro(` });
                  inserts.push({ pos: firstArg.end, text: `, "cb_microtask")` });
                }
              }
            }
          }
        }

        const isFunction = node.type === 'FunctionDeclaration' || 
                           node.type === 'FunctionExpression' || 
                           node.type === 'ArrowFunctionExpression';

        if (isFunction && node.body && node.loc) {
          // Skip if parent is queueMacrotask/queueMicrotask on a custom object since they are already wrapped
          let isQueueArg = false;
          if (parent && parent.type === 'CallExpression') {
            if (parent.callee?.type === 'MemberExpression') {
              const objName = parent.callee.object?.name || '';
              const isGlobalObj = objName === 'window' || objName === 'globalThis' || objName === 'global';
              if (!isGlobalObj) {
                const propName = parent.callee.property?.name || '';
                if (propName === 'queueMacrotask' || propName === 'queueMicrotask') {
                  isQueueArg = true;
                }
              }
            }
          }

          if (!isQueueArg) {
            const name = getFunctionName(node, parent);
            const startLine = node.loc.start.line;
            const endLine = node.loc.end.line;

            if (node.body.type === 'BlockStatement') {
              inserts.push({ pos: node.body.start + 1, text: `\n__pushStack("${name}", ${startLine});\ntry {\n` });
              inserts.push({ pos: node.body.end - 1, text: `\n} finally {\n__popStack(${endLine});\n}\n` });
            } else {
              inserts.push({ pos: node.body.start, text: `{ __pushStack("${name}", ${startLine}); try { return ` });
              inserts.push({ pos: node.body.end, text: `; } finally { __popStack(${endLine}); } }` });
            }
          }
        }

        Object.keys(node).forEach((key) => {
          const child = node[key];
          if (Array.isArray(child)) child.forEach(item => visit(item, node));
          else if (child && typeof child.type === 'string') visit(child, node);
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

    // Helper to wrap macro callbacks
    const wrapMacro = (cb: Function, name = 'macrotask', delay = 0) => {
      const id = Math.random().toString();
      const apiId = id;
      
      const wrapped = (...args: any[]) => {
        // Remove from queues
        const mqIdx = macrotaskQueue.findIndex(t => t.id === id);
        if (mqIdx !== -1) macrotaskQueue.splice(mqIdx, 1);
        
        const waIdx = webAPIs.findIndex(w => w.id === apiId);
        if (waIdx !== -1) webAPIs.splice(waIdx, 1);
        
        // Let execution flow enter callstack
        callStack.push(name);
        snap(0);
        
        const res = cb(...args);
        
        callStack.pop();
        snap(0);
        return res;
      };

      // Register in queues
      webAPIs.push({ id: apiId, name, timer: delay });
      macrotaskQueue.push({ id, name, cb: wrapped, delay, apiId });
      snap(0);
      return wrapped;
    };

    // Helper to wrap micro callbacks
    const wrapMicro = (cb: Function, name = 'microtask') => {
      const id = Math.random().toString();
      
      const wrapped = (...args: any[]) => {
        const mqIdx = microtaskQueue.findIndex(t => t.id === id);
        if (mqIdx !== -1) microtaskQueue.splice(mqIdx, 1);
        
        callStack.push(name);
        snap(0);
        
        const res = cb(...args);
        
        callStack.pop();
        snap(0);
        return res;
      };

      microtaskQueue.push({ id, name, cb: wrapped });
      snap(0);
      return wrapped;
    };

    // Custom Promise Class for Synchronous Sandbox
    class SandboxPromise {
      private state: 'pending' | 'fulfilled' | 'rejected' = 'pending';
      private value: any = undefined;
      private onFulfilledCallbacks: Array<{ cb: Function; resolve: Function; reject: Function }> = [];
      private onRejectedCallbacks: Array<{ cb: Function; resolve: Function; reject: Function }> = [];

      constructor(executor: (resolve: (value: any) => void, reject: (reason: any) => void) => void) {
        const resolve = (val: any) => {
          if (this.state !== 'pending') return;
          
          if (val && typeof val.then === 'function') {
            val.then(resolve, reject);
            return;
          }
          
          this.state = 'fulfilled';
          this.value = val;
          
          this.onFulfilledCallbacks.forEach(({ cb, resolve: res, reject: rej }) => {
            wrapMicro(() => {
              try {
                const result = cb(this.value);
                res(result);
              } catch (err) {
                rej(err);
              }
            }, 'Promise.then callback');
          });
          this.onFulfilledCallbacks = [];
        };

        const reject = (reason: any) => {
          if (this.state !== 'pending') return;
          
          this.state = 'rejected';
          this.value = reason;
          
          this.onRejectedCallbacks.forEach(({ cb, resolve: res, reject: rej }) => {
            wrapMicro(() => {
              try {
                const result = cb(this.value);
                res(result);
              } catch (err) {
                rej(err);
              }
            }, 'Promise.catch callback');
          });
          this.onRejectedCallbacks = [];
        };

        try {
          executor(resolve, reject);
        } catch (err) {
          reject(err);
        }
      }

      then(onFulfilled?: any, onRejected?: any) {
        return new SandboxPromise((resolve, reject) => {
          const fulfilledTask = {
            cb: onFulfilled || ((v: any) => v),
            resolve,
            reject
          };
          
          const rejectedTask = {
            cb: onRejected || ((err: any) => { throw err; }),
            resolve,
            reject
          };

          if (this.state === 'fulfilled') {
            wrapMicro(() => {
              try {
                const result = fulfilledTask.cb(this.value);
                resolve(result);
              } catch (err) {
                reject(err);
              }
            }, 'Promise.then callback');
          } else if (this.state === 'rejected') {
            wrapMicro(() => {
              try {
                const result = rejectedTask.cb(this.value);
                resolve(result);
              } catch (err) {
                reject(err);
              }
            }, 'Promise.catch callback');
          } else {
            this.onFulfilledCallbacks.push(fulfilledTask);
            this.onRejectedCallbacks.push(rejectedTask);
          }
        });
      }

      catch(onRejected?: any) {
        return this.then(undefined, onRejected);
      }

      static resolve(val?: any) {
        return new SandboxPromise((resolve) => resolve(val));
      }

      static reject(reason?: any) {
        return new SandboxPromise((_, reject) => reject(reason));
      }

      static all(promises: any[]) {
        return new SandboxPromise((resolve, reject) => {
          if (promises.length === 0) {
            resolve([]);
            return;
          }
          const results: any[] = [];
          let completed = 0;
          promises.forEach((p, idx) => {
            SandboxPromise.resolve(p).then(
              (val: any) => {
                results[idx] = val;
                completed++;
                if (completed === promises.length) {
                  resolve(results);
                }
              },
              (err: any) => {
                reject(err);
              }
            );
          });
        });
      }
    }

    const sandbox: Record<string, any> = {
      __snap: (line: number) => snap(line),
      __pushStack: (name: string, line: number) => {
        callStack.push(name);
        snap(line);
      },
      __popStack: (line: number) => {
        callStack.pop();
        snap(line);
      },
      __wrapMacro: (cb: Function, name = 'macrotask') => wrapMacro(cb, name, 0),
      __wrapMicro: (cb: Function, name = 'microtask') => wrapMicro(cb, name),
      console: {
        log: (...args: any[]) => {
          const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
          recordCustomLog(message);
        }
      },
      setTimeout: (cb: Function, delay = 0) => {
        const delayMs = typeof delay === 'number' ? delay : 0;
        return wrapMacro(cb, `setTimeout (${delayMs}ms)`, delayMs);
      },
      clearTimeout: (apiId: string) => {
        const apiIdx = webAPIs.findIndex(api => api.id === apiId);
        if (apiIdx !== -1) webAPIs.splice(apiIdx, 1);
        const macroIdx = macrotaskQueue.findIndex(task => task.apiId === apiId);
        if (macroIdx !== -1) macrotaskQueue.splice(macroIdx, 1);
        snap(0);
      },
      setInterval: (cb: Function, delay = 0) => {
        const delayMs = typeof delay === 'number' ? delay : 0;
        return wrapMacro(cb, `setInterval (${delayMs}ms)`, delayMs);
      },
      clearInterval: (apiId: string) => {
        const apiIdx = webAPIs.findIndex(api => api.id === apiId);
        if (apiIdx !== -1) webAPIs.splice(apiIdx, 1);
        const macroIdx = macrotaskQueue.findIndex(task => task.apiId === apiId);
        if (macroIdx !== -1) macrotaskQueue.splice(macroIdx, 1);
        snap(0);
      },
      queueMicrotask: (cb: Function) => {
        wrapMicro(cb, 'queueMicrotask callback');
      },
      Promise: SandboxPromise,
      fetch: (url: string) => {
        const name = `fetch ("${url}")`;
        const apiId = Math.random().toString();
        webAPIs.push({ id: apiId, name, timer: 0 });
        snap(0);

        return new SandboxPromise((resolve) => {
          // Simulate fetch returning and queuing the resolution
          wrapMacro(() => {
            resolve({
              json: () => SandboxPromise.resolve({ data: "mock payload" }),
              text: () => SandboxPromise.resolve("mock payload text"),
              ok: true,
              status: 200
            });
          }, 'fetch response callback', 0);
        });
      }
    };

    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.global = sandbox;

    const instrumentedSource = instrumentCode(this.rawCode);
    const runner = new Function('sandbox', `with (sandbox) { ${instrumentedSource} }`);

    callStack.push('main');
    snap(1);

    try {
      runner(sandbox);
    } catch (error) {
      currentLogs.push(`Runtime Error: ${String(error)}`);
    }

    if (callStack.includes('main')) {
      callStack.pop();
    }
    snap(0);

    // Synchronous Virtual Event Loop
    let iterations = 0;
    const maxIterations = 100; // prevent infinite loops
    while ((microtaskQueue.length > 0 || macrotaskQueue.length > 0) && iterations < maxIterations) {
      iterations++;
      
      // 1. Process ALL Microtasks
      while (microtaskQueue.length > 0) {
        const microtask = microtaskQueue[0];
        try {
          microtask.cb();
        } catch (err) {
          currentLogs.push(`Error in microtask: ${String(err)}`);
          microtaskQueue.shift(); // safety fallback
        }
      }

      // 2. Process ONE Macrotask (sorted by delay so shorter delays run first)
      if (macrotaskQueue.length > 0) {
        macrotaskQueue.sort((a, b) => a.delay - b.delay);
        const macrotask = macrotaskQueue[0];
        try {
          macrotask.cb();
        } catch (err) {
          currentLogs.push(`Error in macrotask: ${String(err)}`);
          macrotaskQueue.shift(); // safety fallback
          const apiIdx = webAPIs.findIndex(w => w.id === macrotask.apiId);
          if (apiIdx !== -1) webAPIs.splice(apiIdx, 1);
        }
      }
    }

    if (iterations >= maxIterations) {
      currentLogs.push(`Execution safety limit: halted simulation after ${maxIterations} event loop cycles.`);
    }

    // Ensure call stack is empty
    callStack.length = 0;
    snap(0);

    console.log = originalConsoleLog;
    return steps;
  }
}