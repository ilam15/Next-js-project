// app/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { DynamicInterpreter } from '../utils/interpreter';
import { VisualizerState } from '../types/visualizer';
import CallStack from '../components/CallStack';
import QueueBox from '../components/QueueBox';
import WebApiBox from '../components/WebApiBox';
import TemplateSelector, { TEMPLATES } from '../components/TemplateSelector';
import ChatBot from '../components/ChatBot';

export default function Home() {
  const [code, setCode] = useState(TEMPLATES[0].code);
  const [currentTemplateId, setCurrentTemplateId] = useState(TEMPLATES[0].id);
  const [timeline, setTimeline] = useState<VisualizerState[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // speed in ms

  // Monaco Editor Reference
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [decorations, setDecorations] = useState<string[]>([]);

  const currentState = timeline[stepIndex] || {
    callStack: [],
    webAPIs: [],
    microtaskQueue: [],
    macrotaskQueue: [],
    consoleLogs: [],
    currentLine: 0
  };

  // Compile and run the interpreter to generate timelines
  const handleRunInterpreter = async (sourceCode = code) => {
    const interpreter = new DynamicInterpreter(sourceCode);
    const steps = await interpreter.generateAllSteps();
    setTimeline(steps);
    setStepIndex(0);
    setIsPlaying(false);
  };

  // Run automatically on first mount
  useEffect(() => {
    handleRunInterpreter(TEMPLATES[0].code);
  }, []);

  // Handle template selection
  const handleTemplateSelect = (newCode: string) => {
    setCode(newCode);
    handleRunInterpreter(newCode);
  };

  // Editor Mount Callback
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Apply Line Highlighting inside Monaco whenever currentLine changes
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const line = currentState.currentLine;
    if (line > 0) {
      const newDecorations = editor.deltaDecorations(decorations, [
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'active-execution-line',
            glyphMarginClassName: 'active-execution-glyph'
          }
        }
      ]);
      setDecorations(newDecorations);
      editor.revealLineInCenterIfOutsideViewport(line);
    } else {
      const newDecorations = editor.deltaDecorations(decorations, []);
      setDecorations(newDecorations);
    }
  }, [currentState.currentLine, stepIndex]);

  // Autoplay Effect
  useEffect(() => {
    if (!isPlaying || timeline.length === 0) return;

    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < timeline.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, playSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, timeline, playSpeed]);

  const handleEditorChange = (val: string | undefined) => {
    setCode(val || '');
    // Stop autoplay and reset timeline when code is modified
    setIsPlaying(false);
    if (editorRef.current && monacoRef.current) {
      setDecorations(editorRef.current.deltaDecorations(decorations, []));
    }
  };

  return (
    <main className="flex flex-col h-screen bg-slate-950 text-slate-50 p-6 overflow-hidden">
      
      {/* APP TOP CONTROLS NAVBAR SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-800 mb-4 gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
            JS Architecture Runtime Engine Visualizer
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {timeline.length > 0 
              ? `Step Frame: ${stepIndex + 1} / ${timeline.length} (Line Focus: ${currentState.currentLine || 'N/A'})` 
              : "Paste scripts & compile to visualize architecture stack transitions"}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Selector */}
          <TemplateSelector 
            onSelect={handleTemplateSelect} 
            currentTemplateId={currentTemplateId}
            setCurrentTemplateId={setCurrentTemplateId}
          />

          <div className="flex gap-2 self-end">
            <button 
              onClick={() => handleRunInterpreter(code)} 
              className="bg-teal-600 hover:bg-teal-500 font-bold text-xs px-4 py-2.5 rounded-lg transition-all duration-300 shadow-md shadow-teal-950/40 text-slate-100 flex items-center gap-1.5 cursor-pointer"
            >
              Compile & Run 🚀
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD CORE CONTENT GRID */}
      <div className="flex flex-1 gap-6 min-h-0">
        
        {/* LEFT COLUMN PANEL: SOURCE EDITOR & TERMINAL CONSOLE */}
        <div className="w-5/12 flex flex-col gap-4 h-full min-h-0">
          {/* Monaco Editor Container */}
          <div className="flex-1 rounded-xl border border-slate-800 overflow-hidden bg-slate-900 shadow-2xl relative">
            <div className="absolute top-2 right-2 z-10 bg-slate-950/80 backdrop-blur text-[10px] text-teal-400 font-mono px-2 py-0.5 rounded border border-teal-500/20">
              Source Code
            </div>
            <Editor
              height="100%"
              theme="vs-dark"
              defaultLanguage="javascript"
              value={code}
              options={{ 
                fontSize: 13, 
                minimap: { enabled: false }, 
                wordWrap: "on",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true
              }}
              onMount={handleEditorDidMount}
              onChange={handleEditorChange}
            />
          </div>
          
          {/* Console Terminal Logs */}
          <div className="h-44 bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs flex flex-col shadow-inner">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
              <span className="text-slate-500 font-bold uppercase tracking-wider">Console Outputs</span>
              <span className="text-[10px] text-slate-400 font-semibold">{currentState.consoleLogs.length} entries</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 text-teal-400 custom-scrollbar pr-1">
              {currentState.consoleLogs.map((log, idx) => (
                <div key={idx} className="border-l-2 border-teal-500/30 pl-2 py-0.5 hover:bg-slate-800/30">
                  <span className="text-teal-600 mr-1.5 font-bold">&gt;</span>{log}
                </div>
              ))}
              {currentState.consoleLogs.length === 0 && (
                <div className="text-slate-600 italic py-2">No output streams generated yet. Compile & Step to see logs.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN PANEL: RUNTIME ARCHITECTURAL QUEUE LAYOUTS */}
        <div className="w-7/12 flex flex-col gap-4 h-full min-h-0">
          
          {/* INTERACTIVE TIMELINE AND PLAYER PANEL */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={timeline.length === 0}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-30 ${
                    isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {isPlaying ? '⏸️ Pause' : '▶️ Play Autoplay'}
                </button>

                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">Speed:</span>
                  <select
                    value={playSpeed}
                    onChange={(e) => setPlaySpeed(Number(e.target.value))}
                    className="bg-transparent text-slate-300 text-[10px] font-bold focus:outline-none cursor-pointer"
                  >
                    <option value={300}>0.3s</option>
                    <option value={500}>0.5s</option>
                    <option value={1000}>1.0s</option>
                    <option value={1500}>1.5s</option>
                    <option value={2000}>2.0s</option>
                    <option value={3000}>3.0s</option>
                  </select>
                </div>
              </div>

              {/* Navigation Steps */}
              <div className="flex gap-2">
                <button 
                  onClick={() => setStepIndex(0)} 
                  disabled={stepIndex === 0 || timeline.length === 0}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 font-semibold text-xs px-2.5 py-1.5 rounded-md transition cursor-pointer"
                  title="First Step"
                >
                  ⏮️ First
                </button>
                <button 
                  onClick={() => stepIndex > 0 && setStepIndex(stepIndex - 1)} 
                  disabled={stepIndex === 0 || timeline.length === 0} 
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 font-semibold text-xs px-2.5 py-1.5 rounded-md transition cursor-pointer"
                  title="Previous Step"
                >
                  ◀️ Prev
                </button>
                <span className="flex items-center px-2 font-mono text-xs font-bold text-slate-300">
                  {stepIndex + 1} / {Math.max(1, timeline.length)}
                </span>
                <button 
                  onClick={() => stepIndex < timeline.length - 1 && setStepIndex(stepIndex + 1)} 
                  disabled={stepIndex === timeline.length - 1 || timeline.length === 0} 
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 font-semibold text-xs px-2.5 py-1.5 rounded-md transition cursor-pointer"
                  title="Next Step"
                >
                  Next ▶️
                </button>
                <button 
                  onClick={() => setStepIndex(timeline.length - 1)} 
                  disabled={stepIndex === timeline.length - 1 || timeline.length === 0}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 font-semibold text-xs px-2.5 py-1.5 rounded-md transition cursor-pointer"
                  title="Last Step"
                >
                  Last ⏭️
                </button>
              </div>
            </div>

            {/* Slider Scrub Bar */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500 font-mono">0</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, timeline.length - 1)}
                value={stepIndex}
                disabled={timeline.length === 0}
                onChange={(e) => setStepIndex(Number(e.target.value))}
                className="flex-1 accent-teal-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg appearance-none disabled:opacity-30"
              />
              <span className="text-[10px] text-slate-500 font-mono">{Math.max(0, timeline.length - 1)}</span>
            </div>
          </div>

          {/* GRID OF ARCHITECTURAL BOXES */}
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 min-h-0 overflow-y-auto">
            {/* CALL STACK */}
            <CallStack frames={currentState.callStack} />

            {/* WEB APIS */}
            <WebApiBox tasks={currentState.webAPIs} />

            {/* MICROTASK QUEUE */}
            <QueueBox
              title="Microtask Queue"
              icon="🧪"
              tasks={currentState.microtaskQueue}
              type="microtask"
              badgeColor="rose"
              emptyMessage="Microtask Queue Clean"
            />

            {/* MACROTASK QUEUE */}
            <QueueBox
              title="Macrotask Queue"
              icon="🎟️"
              tasks={currentState.macrotaskQueue}
              type="macrotask"
              badgeColor="blue"
              emptyMessage="Macrotask Queue Clean"
            />
          </div>

        </div>
      </div>
      <ChatBot code={code} currentState={currentState} stepIndex={stepIndex} />
    </main>
  );
}