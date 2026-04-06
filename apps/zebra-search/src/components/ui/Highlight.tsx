import React from 'react';

interface Props {
  text: string;
  query: string;
}

/**
 * Wraps query terms inside `text` with <mark> elements.
 * Only terms longer than 2 characters are highlighted to avoid noise.
 */
export function Highlight({ text, query }: Props) {
  if (!query || !text) return <>{text}</>;

  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (!terms.length) return <>{text}</>;

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);

  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => part.toLowerCase() === t) ? (
          <mark key={i}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}
