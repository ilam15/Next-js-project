// public/visualizer.worker.js

self.onmessage = function (e) {
  const { code } = e.data;

  // This will store the sequence of states we capture during execution
  const timeline = [];

  // Intercept standard console.log so it records to our timeline instead of just the hidden browser console
  const capturedLogs = [];
  const customLog = (message) => {
    // Clean up our custom class internal logs for a prettier UI output
    const cleanMessage = String(message).replace('[LOG]: ', '');
    if (cleanMessage.includes('Final Generated Output Sequence') || cleanMessage.startsWith('\n')) return;

    capturedLogs.push(cleanMessage);

    // Take a snapshot of the runtime data at this exact moment
    timeline.push({
      consoleLogs: [...capturedLogs],
      // We read the dynamic state of your custom class instance below during execution
      callStack: [`log("${cleanMessage}")`],
      webAPIs: [],
      microtaskQueue: [],
      macrotaskQueue: [],
      currentLine: 0
    });
  };

  try {
    // 1. Create a sandboxed environment context mapping console.log to our interceptor
    const sandboxEnv = {
      console: {
        log: customLog
      }
    };

    // 2. Compile the user's code into an executable sandboxed function wrapper
    const runner = new Function(...Object.keys(sandboxEnv), `
      try {
        ${code}
      } catch (err) {
        console.log("Runtime Error: " + err.message);
      }
    `);

    // 3. Execute the code! This runs your class, creates the queues, and resolves everything
    runner(...Object.values(sandboxEnv));

    // 4. Send the completely populated execution timeline back to the React UI thread
    self.postMessage({ type: 'EXECUTION_COMPLETE', timeline });

  } catch (err) {
    self.postMessage({ type: 'COMPILATION_ERROR', error: err.message });
  }
};