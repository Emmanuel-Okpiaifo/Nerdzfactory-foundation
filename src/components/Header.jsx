import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

/** Softaculous WordPress site — non-opportunities nav goes here */
const WP = 'https://nerdzfactory.org';

const LOGO_SRC = `${WP}/wp-content/uploads/2023/04/nf_logo-1-300x64.png`;

const SOCIAL = [
  { href: 'https://www.facebook.com/nerdzfactoryorg/', icon: 'fab fa-facebook' },
  { href: 'https://x.com/nerdzfactoryorg?t=nNIe24BD69MhKHI2uW7aDg&s=09', icon: 'fab fa-twitter' },
  { href: 'https://www.instagram.com/nerdzfactoryorg?igshid=YmMyMTA2M2Y%3D', icon: 'fab fa-instagram' },
  { href: 'https://www.linkedin.com/company/nerdzfactoryorg/', icon: 'fab fa-linkedin' },
  { href: 'https://www.youtube.com/@nerdzfactoryfoundation4932', icon: 'fab fa-youtube' },
];

const NAV = [
  { href: `${WP}/`, label: 'Home' },
  { href: `${WP}/about/`, label: 'About Us' },
  { href: `${WP}/programs/`, label: 'Programs' },
  { href: `${WP}/contact-us/`, label: 'Contact Us' },
  { href: `${WP}/get-involved/`, label: 'Get Involved' },
  { to: '/opportunities', label: 'Opportunities', app: true },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <div className="top-bar">
        <span>+234 8108269069</span>
        <div className="top-bar__actions">
          <ThemeToggle />
          <div className="social-icons">
            {SOCIAL.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
                <i className={s.icon} />
              </a>
            ))}
          </div>
        </div>
      </div>
      <nav>
        <a href={`${WP}/`} className="logo" onClick={() => setMenuOpen(false)}>
          <img src={LOGO_SRC} alt="Nerdzfactory Logo" />
        </a>
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <i className={menuOpen ? 'fas fa-times' : 'fas fa-bars'} />
        </button>
        <ul className={menuOpen ? 'active' : ''}>
          {NAV.map((item) => (
            <li key={item.label}>
              {item.app ? (
                <NavLink
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'active-nav' : undefined)}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ) : (
                <a href={item.href} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
        <a href={`${WP}/get-involved/`} className="apply-btn" onClick={() => setMenuOpen(false)}>
          Apply
        </a>
      </nav>
    </header>
  );
}
