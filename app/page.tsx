// app/page.tsx
"use client";
import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { DynamicInterpreter } from '../utils/interpreter';
import { VisualizerState } from '../types/visualizer';

const INITIAL_CODE = `class EventLoopSimulation {
  constructor() {
    this.microtaskQueue = [];
    this.macrotaskQueue = [];
    this.executionLog = [];
  }

  log(message) {
    this.executionLog.push(message);
    console.log(\`[LOG]: \${message}\`);
  }

  queueMacrotask(callback) {
    this.macrotaskQueue.push(callback);
  }

  queueMicrotask(callback) {
    this.microtaskQueue.push(callback);
  }

  createPromise(executor) {
    let thenCallbacks = [];
    let isResolved = false;
    let resolvedData = null;

    const resolve = (data) => {
      isResolved = true;
      resolvedData = data;
      while (thenCallbacks.length > 0) {
        const cb = thenCallbacks.shift();
        this.queueMicrotask(() => cb(resolvedData));
      }
    };

    executor(resolve);

    return {
      then: (onFulfilled) => {
        if (isResolved) {
          this.queueMicrotask(() => onFulfilled(resolvedData));
        } else {
          thenCallbacks.push(onFulfilled);
        }
      }
    };
  }

  runEngine() {
    while (this.microtaskQueue.length > 0 || this.macrotaskQueue.length > 0) {
      while (this.microtaskQueue.length > 0) {
        const microtask = this.microtaskQueue.shift();
        microtask();
      }
      if (this.macrotaskQueue.length > 0) {
        const macrotask = this.macrotaskQueue.shift();
        macrotask();
      }
    }
  }
}

const runtime = new EventLoopSimulation();

runtime.log("1: Start");

const delayPromise = runtime.createPromise((resolve) => {
  runtime.queueMacrotask(() => {
    runtime.log("2: Timeout 1 trigger");
    resolve("3: Resolved data");
  });
});

delayPromise.then((data) => {
  runtime.log(data);
  runtime.queueMicrotask(() => {
    runtime.log("4: Microtask inside resolved promise");
  });
});

runtime.queueMacrotask(() => {
  runtime.log("5: Timeout 2 trigger");
});

runtime.queueMicrotask(() => {
  runtime.log("6: Instant microtask");
});

runtime.log("7: End");

runtime.runEngine();`;

export default function Home() {
  const [code, setCode] = useState(INITIAL_CODE);
  const [timeline, setTimeline] = useState<VisualizerState[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  const currentState = timeline[stepIndex] || {
    callStack: [],
    webAPIs: [],
    microtaskQueue: [],
    macrotaskQueue: [],
    consoleLogs: [],
    currentLine: 1
  };

  const handleRunInterpreter = async () => {
    const interpreter = new DynamicInterpreter(code);
    const steps = await interpreter.generateAllSteps();
    setTimeline(steps);
    setStepIndex(0);
  };

  return (
    <main className="flex flex-col h-screen bg-slate-950 text-slate-50 p-6 overflow-hidden">
      
      {/* APP TOP CONTROLS NAVBAR SECTION */}
      <header className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
            JS Architecture Runtime Engine Visualizer
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {timeline.length > 0 ? `Step Frame: ${stepIndex + 1} / ${timeline.length} (Line Focus: ${currentState.currentLine})` : "Load custom script structures & compile dynamically"}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleRunInterpreter} className="bg-teal-600 hover:bg-teal-500 font-semibold text-sm px-4 py-2 rounded-md transition shadow-md shadow-teal-950/40">
            Compile Code 🚀
          </button>
          <button onClick={() => stepIndex > 0 && setStepIndex(stepIndex - 1)} disabled={stepIndex === 0 || timeline.length === 0} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 font-semibold text-sm px-3 py-2 rounded-md transition">
            ⏮️ Prev
          </button>
          <button onClick={() => stepIndex < timeline.length - 1 && setStepIndex(stepIndex + 1)} disabled={stepIndex === timeline.length - 1 || timeline.length === 0} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 font-semibold text-sm px-3 py-2 rounded-md transition">
            Next ⏭️
          </button>
        </div>
      </header>

      {/* DASHBOARD CORE CONTENT GRID */}
      <div className="flex flex-1 gap-6 min-h-0">
        
        {/* LEFT COLUMN PANEL: SOURCE EDITOR & TERMINAL CONSOLE */}
        <div className="w-5/12 flex flex-col gap-4 h-full min-h-0">
          <div className="flex-1 rounded-xl border border-slate-800 overflow-hidden bg-slate-900 shadow-xl">
            <Editor
              height="100%"
              theme="vs-dark"
              defaultLanguage="javascript"
              value={code}
              options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on" }}
              onChange={(v) => setCode(v || '')}
            />
          </div>
          
          <div className="h-44 bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs flex flex-col shadow-inner">
            <span className="text-slate-500 font-bold uppercase mb-2 tracking-wider">Console Terminal logs</span>
            <div className="flex-1 overflow-y-auto space-y-1 text-teal-400">
              {currentState.consoleLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
              {currentState.consoleLogs.length === 0 && <div className="text-slate-600 italic">No output streams generated yet.</div>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN PANEL: RUNTIME ARCHITECTURAL QUEUE LAYOUTS */}
        <div className="w-7/12 grid grid-cols-2 grid-rows-2 gap-4 h-full overflow-y-auto pr-1">
          
          {/* PANELS 1: CALL STACK ENGINE CONTAINER */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 border-b border-slate-800 pb-2 mb-3">
              🥞 Call Stack Frame
            </h3>
            <div className="flex-1 flex flex-col-reverse justify-end gap-2 overflow-y-auto">
              {currentState.callStack.map((frame, i) => (
                <div key={i} className="bg-amber-600 text-white font-mono text-xs text-center font-bold py-2.5 px-3 rounded-lg border border-amber-400/20 shadow animate-pulse">
                  {frame}
                </div>
              ))}
              {currentState.callStack.length === 0 && <div className="text-slate-600 font-mono italic text-xs text-center my-auto">Stack Empty (Idle)</div>}
            </div>
          </div>

          {/* PANELS 2: BACKGROUND WEB APIS METRIC TRACKER */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 border-b border-slate-800 pb-2 mb-3">
              🌐 Background Web APIs
            </h3>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              {currentState.webAPIs.map((api, i) => (
                <div key={i} className="bg-purple-950/50 border border-purple-800 text-purple-300 font-mono text-xs p-2 rounded-lg flex justify-between items-center">
                  <span>{api.name}</span>
                  <span className="text-[10px] bg-purple-900/60 px-1.5 py-0.5 rounded text-purple-200 font-bold">Active</span>
                </div>
              ))}
              {currentState.webAPIs.length === 0 && <div className="text-slate-600 font-mono italic text-xs text-center my-auto">No Active Background Tasks</div>}
            </div>
          </div>

          {/* PANELS 3: MICROTASK QUEUE CONTAINER TRACK */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-rose-400 border-b border-slate-800 pb-2 mb-3">
              🧪 Microtask Queue (High Priority)
            </h3>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              {currentState.microtaskQueue.map((task, i) => (
                <div key={i} className="bg-rose-950/40 border border-rose-900 text-rose-300 font-mono text-xs p-2.5 rounded-lg font-semibold shadow-sm">
                  {task}
                </div>
              ))}
              {currentState.microtaskQueue.length === 0 && <div className="text-slate-600 font-mono italic text-xs text-center my-auto">Microtask Line Clean</div>}
            </div>
          </div>

          {/* PANELS 4: MACROTASK QUEUE (EVENT LOOP MAIN TIMELINE TRACKER) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 border-b border-slate-800 pb-2 mb-3">
              🎟️ Macrotask Queue (Callback Queue)
            </h3>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              {currentState.macrotaskQueue.map((task, i) => (
                <div key={i} className="bg-blue-950/40 border border-blue-900 text-blue-300 font-mono text-xs p-2.5 rounded-lg font-semibold shadow-sm">
                  {task}
                </div>
              ))}
              {currentState.macrotaskQueue.length === 0 && <div className="text-slate-600 font-mono italic text-xs text-center my-auto">Macrotask Line Clean</div>}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}