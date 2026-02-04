import React, { useEffect, useRef, useState } from 'react';
import { askAgent } from '../services/localData';

const AgentPanel = ({ context, request }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const lastRequestRef = useRef(null);
  const messagesRef = useRef([]);

  const formatPrice = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'N/A';
    if (numeric >= 1_000_000) return `£${(numeric / 1_000_000).toFixed(2)}M`;
    if (numeric >= 1_000) return `£${Math.round(numeric / 1_000)}K`;
    return `£${Math.round(numeric).toLocaleString()}`;
  };

  const formatCount = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 'N/A';
  };

  const sanitizeHistory = (history) => {
    const cleaned = [];
    for (const item of history || []) {
      const role = item?.role;
      const content = item?.content;
      if (!content || (role !== 'user' && role !== 'assistant')) continue;
      const lastRole = cleaned[cleaned.length - 1]?.role;
      if (role === lastRole) continue;
      cleaned.push({ role, content });
    }
    if (cleaned.length && cleaned[cleaned.length - 1].role === 'user') {
      cleaned.pop();
    }
    return cleaned.slice(-10);
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
      const history = sanitizeHistory(messagesRef.current);
      const response = await askAgent({
        message: trimmed,
        history,
        context
      });
      const answer = response?.answer || 'No response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      setError(err?.message || 'Failed to reach the agent. Check PERPLEXITY_API_KEY.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!request || request.id === lastRequestRef.current) return;
    lastRequestRef.current = request.id;

    const title = request.title || request.code || 'Area';
    const month = request.month ? ` (${request.month})` : '';

    let prompt = '';
    if (request.selectionType === 'live') {
      const kind = request.kind === 'rent' ? 'rental' : 'for sale';
      prompt =
        `Give a detailed but concise analysis of this live listing (${kind}) in ${title}. ` +
        `Price: ${formatPrice(request.price)}. ` +
        `${request.bedrooms ? `Bedrooms: ${request.bedrooms}. ` : ''}` +
        `Comment on what stands out, likely target buyer/tenant, and key risks. ` +
        `Then give a short area-level view: what's attractive and what's not (transport, schools, amenities, safety, demand). ` +
        `Use current public info and cite sources if available.`;
    } else {
      prompt = `Give a detailed but concise summary about ${title}${month}. Median: ${formatPrice(
        request.median_price
      )}, mean: ${formatPrice(request.mean_price)}, sales: ${formatCount(
        request.sales
      )}. Highlight strengths and weaknesses (transport, schools, amenities, safety, affordability, demand). Use current public info and cite sources if available.`;
    }

    setOpen(true);
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setLoading(true);
    setError('');

    const history = sanitizeHistory(messagesRef.current);
    const ctx = request?.context || context;

    askAgent({ message: prompt, history, context: ctx })
      .then((response) => {
        const answer = response?.answer || 'No response.';
        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to reach the agent. Check PERPLEXITY_API_KEY.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [request]);

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
