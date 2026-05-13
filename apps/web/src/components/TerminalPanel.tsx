import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { CornerDownLeft, Keyboard, Plug, PlugZap, Power, Send, SquareTerminal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import '@xterm/xterm/css/xterm.css';

type TerminalPanelProps = {
  sessionName: string;
};

type TerminalConnectionState = 'connecting' | 'connected' | 'closed' | 'error';

type TerminalMessage =
  | {
      type: 'output';
      data?: unknown;
    }
  | {
      type: 'status';
      session?: unknown;
    }
  | {
      type: 'exit';
      exitCode?: unknown;
      signal?: unknown;
    };

function getTerminalWebSocketUrl(sessionName: string) {
  const configuredServerUrl = import.meta.env.VITE_DOPPEL_SERVER_URL;
  const baseUrl = new URL(configuredServerUrl ?? window.location.origin);
  const websocketUrl = new URL(`/ws/terminal/${encodeURIComponent(sessionName)}`, baseUrl);

  websocketUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  return websocketUrl.toString();
}

function parseTerminalMessage(data: string): TerminalMessage | null {
  try {
    const message = JSON.parse(data) as Partial<TerminalMessage>;

    if (message.type === 'output' || message.type === 'status' || message.type === 'exit') {
      return message as TerminalMessage;
    }
  } catch {
    return null;
  }

  return null;
}

function getSessionStatus(session: unknown) {
  if (!session || typeof session !== 'object') {
    return undefined;
  }

  const status = (session as Record<string, unknown>).status;

  return typeof status === 'string' ? status : undefined;
}

export function TerminalPanel({ sessionName }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<TerminalConnectionState>('connecting');
  const [sessionStatus, setSessionStatus] = useState<string | undefined>();
  const [command, setCommand] = useState('');
  const [appendEnter, setAppendEnter] = useState(true);

  const sendSocketMessage = useCallback((message: unknown) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      terminalRef.current?.writeln('\r\n[terminal disconnected]');
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const sendInput = useCallback(
    (data: string) => {
      return sendSocketMessage({
        type: 'input',
        data,
      });
    },
    [sendSocketMessage],
  );

  const fitTerminal = useCallback(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    if (!terminal || !fitAddon || !containerRef.current) {
      return;
    }

    fitAddon.fit();
    sendSocketMessage({
      type: 'resize',
      cols: terminal.cols,
      rows: terminal.rows,
    });
  }, [sendSocketMessage]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      scrollback: 10_000,
      theme: {
        background: '#111827',
        foreground: '#f8fafc',
        cursor: '#5eead4',
        selectionBackground: '#334155',
      },
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminal.focus();

    const inputSubscription = terminal.onData((data) => {
      sendInput(data);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    window.setTimeout(() => fitTerminal(), 0);

    return () => {
      inputSubscription.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [fitTerminal, sendInput]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      fitTerminal();
    });

    observer.observe(container);
    window.addEventListener('resize', fitTerminal);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitTerminal);
    };
  }, [fitTerminal]);

  useEffect(() => {
    setConnectionState('connecting');
    setSessionStatus(undefined);
    terminalRef.current?.reset();
    terminalRef.current?.writeln(`[connecting to ${sessionName}]`);

    const socket = new WebSocket(getTerminalWebSocketUrl(sessionName));
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnectionState('connected');
      fitTerminal();
    });

    socket.addEventListener('message', (event: MessageEvent<string>) => {
      const terminal = terminalRef.current;
      const message = parseTerminalMessage(event.data);

      if (!message || !terminal) {
        return;
      }

      if (message.type === 'output') {
        terminal.write(String(message.data ?? ''));
        return;
      }

      if (message.type === 'status') {
        setSessionStatus(getSessionStatus(message.session));
        return;
      }

      const exitCode = typeof message.exitCode === 'number' ? String(message.exitCode) : 'unknown';
      const signal = typeof message.signal === 'string' ? ` (${message.signal})` : '';

      terminal.writeln(`\r\n[process exited: ${exitCode}${signal}]`);
    });

    socket.addEventListener('close', () => {
      setConnectionState('closed');
    });

    socket.addEventListener('error', () => {
      setConnectionState('error');
    });

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [fitTerminal, sessionName]);

  const submitCommand = () => {
    const payload = appendEnter ? `${command}\r` : command;

    if (payload.length === 0) {
      return;
    }

    if (sendInput(payload)) {
      setCommand('');
    }
  };

  return (
    <section className="terminal-panel" aria-label="Terminal">
      <div className="section-heading terminal-heading">
        <div>
          <h2>
            <SquareTerminal size={18} aria-hidden="true" />
            {sessionName}
          </h2>
          <p>{sessionStatus ? `Session ${sessionStatus}` : 'Interactive terminal'}</p>
        </div>
        <span className={`connection-pill ${connectionState}`}>
          {connectionState === 'connected' ? (
            <PlugZap size={15} aria-hidden="true" />
          ) : (
            <Plug size={15} aria-hidden="true" />
          )}
          {connectionState}
        </span>
      </div>

      <div className="terminal-frame">
        <div className="terminal-host" ref={containerRef} />
      </div>

      <form
        className="command-bar"
        onSubmit={(event) => {
          event.preventDefault();
          submitCommand();
        }}
      >
        <input
          aria-label="Command"
          className="command-input"
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Command"
          type="text"
          value={command}
        />
        <label className="toggle-label">
          <input
            checked={appendEnter}
            onChange={(event) => setAppendEnter(event.target.checked)}
            type="checkbox"
          />
          Enter
        </label>
        <button className="primary-button" type="submit">
          <Send size={16} aria-hidden="true" />
          Send
        </button>
      </form>

      <div className="terminal-actions" aria-label="Terminal controls">
        <button className="tool-button" onClick={() => sendInput('\r')} type="button">
          <CornerDownLeft size={16} aria-hidden="true" />
          Enter
        </button>
        <button className="tool-button" onClick={() => sendInput('\u0003')} type="button">
          <Power size={16} aria-hidden="true" />
          Ctrl+C
        </button>
        <button className="tool-button" onClick={() => sendInput('\u0004')} type="button">
          <Keyboard size={16} aria-hidden="true" />
          Ctrl+D
        </button>
      </div>
    </section>
  );
}
