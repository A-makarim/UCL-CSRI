import React, { useEffect, useRef, useState } from 'react';
import { askAgent } from '../services/localData';

const AgentPanel = ({ context }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const response = await askAgent({
        message: trimmed,
        history: nextMessages,
        context
      });
      const answer = response?.answer || 'No response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      setError('Failed to reach the agent. Check PERPLEXITY_API_KEY.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="agent-panel">
      <button className="agent-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? 'Close AI' : 'Ask AI'}
      </button>
      {open && (
        <div className="agent-window glass-panel">
          <div className="agent-header">
            <div className="agent-title">Map Assistant</div>
            <div className="agent-sub">Ask about prices, trends, or the map.</div>
          </div>
          <div className="agent-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="agent-empty">Try: “What does this month show for London?”</div>
            )}
            {messages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`agent-message ${message.role}`}
              >
                {message.content}
              </div>
            ))}
            {loading && <div className="agent-message assistant">Thinking…</div>}
          </div>
          {error && <div className="agent-error">{error}</div>}
          <div className="agent-input">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything…"
              rows={2}
            />
            <button className="agent-send" onClick={handleSend} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentPanel;
