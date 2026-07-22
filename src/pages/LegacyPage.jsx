import { useEffect } from 'react';
import { usePageEffects } from '../hooks/usePageEffects';

export default function LegacyPage({ html, title }) {
  usePageEffects();

  useEffect(() => {
    document.title = title ? `${title} — Nerdzfactory Foundation` : 'Nerdzfactory Foundation';
  }, [title]);

  return <main dangerouslySetInnerHTML={{ __html: html }} />;
}
