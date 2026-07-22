const WP = 'https://nerdzfactory.org';

const EXPLORE = [
  { href: `${WP}/`, label: 'Home' },
  { href: `${WP}/about/`, label: 'About' },
  { href: `${WP}/contact-us/`, label: 'Reach Us' },
  { href: `${WP}/get-involved/`, label: 'Get Involved' },
  { href: `${WP}/gallery/`, label: 'Gallery' },
  { href: `${WP}/careers/`, label: 'Careers' },
  { href: `${WP}/blog/`, label: 'Blog' },
  { to: '/opportunities', label: 'Opportunities', app: true },
];

const SOCIAL = [
  { href: 'https://www.facebook.com/nerdzfactoryorg/', icon: 'fab fa-facebook' },
  { href: 'https://x.com/nerdzfactoryorg?t=nNIe24BD69MhKHI2uW7aDg&s=09', icon: 'fab fa-twitter' },
  { href: 'https://www.instagram.com/nerdzfactoryorg?igshid=YmMyMTA2M2Y%3D', icon: 'fab fa-instagram' },
  { href: 'https://www.linkedin.com/company/nerdzfactoryorg/', icon: 'fab fa-linkedin' },
  { href: 'https://www.youtube.com/@nerdzfactoryfoundation4932', icon: 'fab fa-youtube' },
];

export default function Footer() {
  return (
    <footer>
      <div className="footer-content">
        <div className="footer-section">
          <h3>Explore</h3>
          <ul>
            {EXPLORE.map((l) => (
              <li key={l.label}>
                {l.app ? (
                  <a href="/opportunities">{l.label}</a>
                ) : (
                  <a href={l.href}>{l.label}</a>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-section">
          <h3>Contact Info</h3>
          <div className="contact-info">
            <p><span>Address:</span> Plot 2b Insha Allah Street, Off Ramat Crescent, Ogudu</p>
            <p><span>Email:</span> info@nerdzfactory.org</p>
            <p><span>Phone:</span> +234 8108269069</p>
          </div>
        </div>
        <div className="footer-section social-section">
          <div className="social-links">
            {SOCIAL.map((s) => (
              <a key={s.href} href={s.href} className="social-link" target="_blank" rel="noopener noreferrer">
                <i className={s.icon} />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>Copyright © {new Date().getFullYear()} NerdzFactory Foundation</p>
      </div>
    </footer>
  );
}
