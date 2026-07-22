import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LegacyPage from './pages/LegacyPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import OpportunityDetailPage from './pages/OpportunityDetailPage';
import BlogPage from './pages/BlogPage';

import aboutHtml from './content/about';
import programsHtml from './content/programs';
import contactHtml from './content/contact';
import involvedHtml from './content/involved';
import careersHtml from './content/careers';
import galleryHtml from './content/gallery';
import stemHtml from './content/stem';
import ytpHtml from './content/ytp';
import wdepHtml from './content/wdep';
import digi_gapHtml from './content/digi_gap';
import digi_safeHtml from './content/digi_safe';
import powerupHtml from './content/powerup';
import susHtml from './content/sus';
import bybHtml from './content/byb';
import techdriveHtml from './content/techdrive';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<LegacyPage html={aboutHtml} title="About Us" />} />
        <Route path="programs" element={<LegacyPage html={programsHtml} title="Programs" />} />
        <Route path="contact" element={<LegacyPage html={contactHtml} title="Contact Us" />} />
        <Route path="involved" element={<LegacyPage html={involvedHtml} title="Get Involved" />} />
        <Route path="careers" element={<LegacyPage html={careersHtml} title="Careers" />} />
        <Route path="gallery" element={<LegacyPage html={galleryHtml} title="Gallery" />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="opportunities" element={<OpportunitiesPage />} />
        <Route path="opportunities/:slug" element={<OpportunityDetailPage />} />

        <Route path="programs/stem" element={<LegacyPage html={stemHtml} title="STEM Educator Immersion Program" />} />
        <Route path="programs/ytp" element={<LegacyPage html={ytpHtml} title="Youth Transition Program" />} />
        <Route path="programs/wdep" element={<LegacyPage html={wdepHtml} title="Women Digital Entrepreneurship Program" />} />
        <Route path="programs/digigap" element={<LegacyPage html={digi_gapHtml} title="DigiGap Program" />} />
        <Route path="programs/digisafe" element={<LegacyPage html={digi_safeHtml} title="Digital Safety" />} />
        <Route path="programs/powerup" element={<LegacyPage html={powerupHtml} title="PowerUp Entrepreneurship Program" />} />
        <Route path="programs/sustainability" element={<LegacyPage html={susHtml} title="Sustainability Clubs" />} />
        <Route path="programs/byb" element={<LegacyPage html={bybHtml} title="Build Your Business" />} />
        <Route path="programs/techdrive" element={<LegacyPage html={techdriveHtml} title="TechDrive" />} />
      </Route>
    </Routes>
  );
}
