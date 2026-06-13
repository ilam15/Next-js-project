// components/ChatBot.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { VisualizerState } from '../types/visualizer';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface ChatBotProps {
  code: string;
  currentState: VisualizerState;
  stepIndex: number;
}

export default function ChatBot({ code, currentState, stepIndex }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load API Key from LocalStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('groq_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setShowSettings(true); // Open settings to input key if not saved
    }

    // Add initial greeting message
    setMessages([
      {
        id: 'initial',
        sender: 'assistant',
        text: "Hi! I am your JS Runtime Engine Assistant. I have full context of the code and execution state you are currently visualizing. Feel free to ask me anything about the call stack, microtask queues, or event-loop timings!",
        timestamp: new Date()
      }
    ]);
  }, []);

  // Scroll to bottom of chat history when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('groq_api_key', apiKey.trim());
    setShowSettings(false);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('groq_api_key');
    setApiKey('');
    setShowSettings(true);
  };

  // Helper to trigger predefined query chips
  const handleChipClick = (prompt: string) => {
    if (isLoading) return;
    sendMessage(prompt);
  };

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    const currentKey = localStorage.getItem('groq_api_key') || apiKey;

    if (!currentKey) {
      setShowSettings(true);
      alert('Please configure your Groq API Key first!');
      return;
    }

    const newUserMessage: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    setIsLoading(true);

    // Context description injected as system prompt
    const systemPrompt = `You are an expert AI Assistant specialized in JavaScript Runtime Architecture, the Event Loop, and V8 engine mechanics.
You help developers understand how Javascript code runs step-by-step.
You have direct context of the developer's current Javascript code and the exact frame state of their runtime visualizer (including Call Stack, Web APIs, Microtask Queue, Macrotask Queue, and Console Outputs).

[CONTEXT RULES]:
1. If the user asks about the current state, look at the visualizer state provided below and explain what is executing, what is queued, and why.
2. Relate V8 mechanics (like Microtask queues draining before Macrotasks) to their specific code logic.
3. Keep your answers concise, clear, and highly educational.

[CURRENT CODE]:
\`\`\`javascript
${code}
\`\`\`

[CURRENT FRAME STATE (Step ${stepIndex + 1})]:
- Current Focused Line: ${currentState.currentLine || 'None'}
- Active Call Stack (top is executing): ${currentState.callStack.length > 0 ? currentState.callStack.join(' <- ') : 'Empty (Idle)'}
- Web APIs (timers, network requests): ${currentState.webAPIs.length > 0 ? JSON.stringify(currentState.webAPIs) : 'None'}
- Microtask Queue: ${currentState.microtaskQueue.length > 0 ? currentState.microtaskQueue.join(', ') : 'Empty'}
- Macrotask Queue (Callback Queue): ${currentState.macrotaskQueue.length > 0 ? currentState.macrotaskQueue.join(', ') : 'Empty'}
- Console Log Outputs: ${currentState.consoleLogs.length > 0 ? JSON.stringify(currentState.consoleLogs) : 'No logs yet'}`;

    try {
      // Build messages payload
      const chatPayload = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        })),
        { role: 'user', content: textToSend }
      ];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: chatPayload,
          temperature: 0.5
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const assistantText = data?.choices?.[0]?.message?.content || "No response generated.";

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: assistantText,
          timestamp: new Date()
        }
      ]);
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `⚠️ Error contacting Groq: ${error?.message || 'Check your internet connection or API Key.'}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
  };

  // Safe formatting function to render markdown bold tags and code blocks
  const formatMessageText = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        const codeText = match ? match[2] : part.slice(3, -3);
        return (
          <pre
            key={index}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-[10px] p-2.5 rounded-lg my-2 font-mono overflow-x-auto whitespace-pre"
          >
            <code>{codeText.trim()}</code>
          </pre>
        );
      }

      return (
        <span key={index} className="whitespace-pre-wrap text-[11px] leading-relaxed">
          {part.split('\n').map((line, lineIdx) => {
            const lineParts = line.split(/(\*\*.*?\*\*)/g);
            return (
              <span key={lineIdx} className="block mt-1 first:mt-0">
                {lineParts.map((subPart, subIdx) => {
                  if (subPart.startsWith('**') && subPart.endsWith('**')) {
                    return (
                      <strong key={subIdx} className="text-teal-400 font-extrabold">
                        {subPart.slice(2, -2)}
                      </strong>
                    );
                  }
                  return subPart;
                })}
              </span>
            );
          })}
        </span>
      );
    });
  };

  return (
    <>
      {/* Floating Chat Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white p-3.5 rounded-full shadow-2xl shadow-teal-500/20 hover:scale-105 transition-all duration-300 cursor-pointer flex items-center justify-center border border-teal-400/20"
        title="Open JS Assistant"
      >
        {isOpen ? (
          <span className="text-lg font-bold">❌</span>
        ) : (
          <span className="text-xl">🤖</span>
        )}
      </button>

      {/* Floating Chat Widget Panel */}
      {isOpen && (
        <div className="fixed bottom-22 right-6 w-96 h-[480px] z-50 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
          
          {/* Widget Header */}
          <div className="bg-slate-950/80 border-b border-slate-800 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse"></span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                JS Runtime Assistant
              </h4>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
                title="Configure Groq API Key"
              >
                ⚙️ Key
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold cursor-pointer"
              >
                ❌
              </button>
            </div>
          </div>

          {/* API Key Configuration Form */}
          {showSettings && (
            <div className="bg-slate-950/95 border-b border-slate-800 p-4 animate-in slide-in-from-top duration-200">
              <form onSubmit={handleSaveApiKey} className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Enter Groq API Key
                  </label>
                  {localStorage.getItem('groq_api_key') && (
                    <button
                      type="button"
                      onClick={handleClearApiKey}
                      className="text-[9px] text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      Clear Saved Key
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="gsk_..."
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500 transition-all font-mono"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[9px] text-slate-500">
                  Your key is saved locally in your browser storage and sent directly to Groq.
                </p>
              </form>
            </div>
          )}

          {/* Chat Messages Display Container */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-slate-900/50">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div
                    className={`p-3 rounded-2xl shadow-sm text-slate-100 ${
                      isUser
                        ? 'bg-gradient-to-r from-teal-600 to-blue-600 rounded-br-none border border-teal-500/20'
                        : 'bg-slate-800 rounded-bl-none border border-slate-700/60'
                    }`}
                  >
                    {formatMessageText(m.text)}
                  </div>
                  <span className="text-[8px] text-slate-500 mt-1 font-mono">
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="self-start flex flex-col gap-1 items-start max-w-[85%]">
                <div className="bg-slate-800 border border-slate-700/60 p-3 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick-Action Chips Panel */}
          {messages.length > 0 && !isLoading && (
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/30 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
              <button
                onClick={() => handleChipClick("Explain the current state and what is on the Call Stack.")}
                className="text-[9px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold px-2 py-1 rounded-full transition cursor-pointer"
              >
                Explain State 🥞
              </button>
              <button
                onClick={() => handleChipClick("Explain what microtasks are and how they relate to the Promises here.")}
                className="text-[9px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold px-2 py-1 rounded-full transition cursor-pointer"
              >
                Explain Microtasks 🧪
              </button>
              <button
                onClick={() => handleChipClick("Explain why setTimeout callbacks are deferred to the Macrotask Queue.")}
                className="text-[9px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold px-2 py-1 rounded-full transition cursor-pointer"
              >
                Explain setTimeout ⏱️
              </button>
            </div>
          )}

          {/* Form Message Input bar */}
          <form
            onSubmit={handleFormSubmit}
            className="p-3 border-t border-slate-800 bg-slate-950/60 flex gap-2 flex-shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={apiKey || localStorage.getItem('groq_api_key') ? "Ask about event loop mechanics..." : "Configure Groq API Key..."}
              disabled={isLoading}
              className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-500 disabled:opacity-50 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-bold text-xs px-4 rounded-xl transition cursor-pointer flex items-center justify-center flex-shrink-0"
            >
              Send
            </button>
          </form>

        </div>
      )}
    </>
  );
}
