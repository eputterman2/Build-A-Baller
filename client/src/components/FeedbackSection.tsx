import { useMemo, useState } from 'react';
import { api } from '../api';

const MAX_FEEDBACK_WORDS = 300;

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function FeedbackSection() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wordCount = useMemo(() => countWords(message), [message]);
  const overLimit = wordCount > MAX_FEEDBACK_WORDS;
  const canSubmit = message.trim().length > 0 && !overLimit && !sending;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    try {
      await api.submitFeedback(message);
      setMessage('');
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="feedback-section">
      <div className="feedback-head">
        <h2>Share Your Feedback</h2>
      </div>

      <form className="feedback-form" onSubmit={submit}>
        <textarea
          value={message}
          onChange={event => { setMessage(event.target.value); setSent(false); }}
          placeholder="Share your thoughts..."
          rows={5}
          aria-label="Feedback"
        />
        <div className="feedback-meta">
          <span className={overLimit ? 'over-limit' : ''}>
            {wordCount}/{MAX_FEEDBACK_WORDS} words
          </span>
          <button className="btn btn-small" type="submit" disabled={!canSubmit}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {sent && <div className="feedback-success">Thanks. Your feedback was received.</div>}
        {error && <div className="form-error feedback-error">{error}</div>}
      </form>
    </section>
  );
}
