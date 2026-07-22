import { useEffect } from 'react';
import LegacyPage from './LegacyPage';
import homeHtml from '../content/home';

export default function HomePage() {
  useEffect(() => {
    document.title = 'Nerdzfactory Foundation';
  }, []);

  return <LegacyPage html={homeHtml} />;
}
