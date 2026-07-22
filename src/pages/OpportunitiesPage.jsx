import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchOpportunities,
  fetchOpportunitiesMeta,
  fetchFeatured,
} from '../lib/opportunitiesApi';
import {
  formatDeadline,
  getOpportunityLead,
  CATEGORY_ICONS,
  FALLBACK_IMAGE,
} from '../lib/opportunities';
import '../styles/opportunities.css';

const PER_PAGE = 12;
const HERO_IMAGE =
  'https://nerdzfactory.org/wp-content/uploads/2023/04/FM_03445-2.jpg';

export default function OpportunitiesPage() {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ categoryCounts: {}, totalPublished: 0 });
  const [featuredList, setFeaturedList] = useState([]);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categories = useMemo(() => {
    return Object.entries(meta.categoryCounts || {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [meta.categoryCounts]);

  const featured = featuredList[0];
  const highlights = featuredList.slice(1, 4);
  const totalCount = meta.totalPublished || pagination.total;

  useEffect(() => {
    document.title = 'Opportunities — Nerdzfactory Foundation';
  }, []);

  useEffect(() => {
    setPage(1);
  }, [category, search]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        // Load independently so one failing call does not blank the whole page
        const metaResult = await fetchOpportunitiesMeta().catch((e) => {
          throw e;
        });
        const listResult = await fetchOpportunities({
          search,
          category,
          page,
          limit: PER_PAGE,
        });
        const featuredResult = await fetchFeatured(4).catch(() => []);

        if (cancelled) return;
        setMeta(metaResult);
        setItems(listResult.data);
        setPagination(listResult.pagination);
        setFeaturedList(featuredResult);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load opportunities');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search, category, page]);

  const showFeatured = !search && category === 'all' && featured;
  const showHighlights = showFeatured && highlights.length > 0;

  return (
    <main className="opp-page">
      <section
        className="opp-hero"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      >
        <div className="opp-hero__overlay" />
        <div className="opp-hero__content">
          <span className="opp-eyebrow">...enabling opportunities</span>
          <h1>Discover your next opportunity</h1>
          <p>
            Grants, fellowships, accelerators, and programs curated for African
            youth, women, and builders ready to grow.
          </p>
          <div className="opp-hero__stats">
            <div className="opp-hero__stat">
              <strong>{totalCount}</strong>
              <span>Open listings</span>
            </div>
            <div className="opp-hero__stat">
              <strong>{categories.length}</strong>
              <span>Categories</span>
            </div>
          </div>
        </div>
      </section>

      <section className="opp-body">
        <div className="container">
          <div className="opp-toolbar-panel">
            <div className="opp-search">
              <i className="fas fa-search" aria-hidden />
              <input
                type="search"
                placeholder="Search by title, keyword, or program..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search opportunities"
              />
              {search && (
                <button
                  type="button"
                  className="opp-search__clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <i className="fas fa-times" />
                </button>
              )}
            </div>

            <div className="opp-filters" role="tablist" aria-label="Categories">
              <button
                type="button"
                role="tab"
                aria-selected={category === 'all'}
                className={`opp-filter${category === 'all' ? ' is-active' : ''}`}
                onClick={() => setCategory('all')}
              >
                All
                <span className="opp-filter__count">{totalCount}</span>
              </button>
              {categories.map(({ name, count }) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={category === name}
                  className={`opp-filter${category === name ? ' is-active' : ''}`}
                  onClick={() => setCategory(name)}
                >
                  <i
                    className={`fas ${CATEGORY_ICONS[name] || 'fa-star'}`}
                    aria-hidden
                  />
                  {name}
                  <span className="opp-filter__count">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="opp-empty">
              <div className="opp-empty__icon">
                <i className="fas fa-exclamation-circle" aria-hidden />
              </div>
              <h3>Could not load opportunities</h3>
              <p>{error}</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.85 }}>
                Check <code>https://nerdzfactory.org/api/health</code>. If it says
                missing <code>config.php</code>, in cPanel File Manager open{' '}
                <code>public_html/nf-cms/</code> and rename{' '}
                <code>config.example.php</code> to <code>config.php</code>, then
                refresh.
              </p>
            </div>
          )}

          {!error && showFeatured && (
            <div className="opp-spotlight">
              <div className="opp-section-head">
                <span className="opp-eyebrow opp-eyebrow--dark">Editor&apos;s pick</span>
                <h2>Featured opportunity</h2>
              </div>
              <FeaturedCard opp={featured} large />
            </div>
          )}

          {!error && showHighlights && (
            <div className="opp-highlights">
              <div className="opp-section-head opp-section-head--row">
                <div>
                  <span className="opp-eyebrow opp-eyebrow--dark">Trending</span>
                  <h2>More to explore</h2>
                </div>
              </div>
              <div className="opp-highlights__track">
                {highlights.map((opp) => (
                  <FeaturedCard key={opp.slug} opp={opp} />
                ))}
              </div>
            </div>
          )}

          <div className="opp-listing">
            <div className="opp-section-head opp-section-head--row">
              <div>
                <span className="opp-eyebrow opp-eyebrow--dark">
                  {search ? 'Search results' : 'Browse'}
                </span>
                <h2>
                  {search
                    ? `Results for “${search}”`
                    : category !== 'all'
                      ? category
                      : 'All opportunities'}
                </h2>
              </div>
              <p className="opp-results-count">
                {pagination.total} listing{pagination.total !== 1 ? 's' : ''}
              </p>
            </div>

            {loading && (
              <div className="opp-empty">
                <div className="opp-detail-loading__ring" style={{ margin: '0 auto 1rem' }} />
                <p>Loading opportunities...</p>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="opp-empty">
                <div className="opp-empty__icon">
                  <i className="fas fa-compass" aria-hidden />
                </div>
                <h3>No opportunities found</h3>
                <p>Try a different search term or browse another category.</p>
                <button
                  type="button"
                  className="opp-btn opp-btn--outline"
                  onClick={() => {
                    setSearch('');
                    setCategory('all');
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <div className="opp-grid">
                {items.map((opp) => (
                  <OpportunityCard key={opp.slug || opp.id} opp={opp} />
                ))}
              </div>
            )}

            {!loading && !error && pagination.totalPages > 1 && (
              <nav className="opp-pagination" aria-label="Pagination">
                <button
                  type="button"
                  className="opp-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <i className="fas fa-arrow-left" aria-hidden /> Previous
                </button>
                <div className="opp-page-btn__nums">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(
                      (n) =>
                        n === 1 ||
                        n === pagination.totalPages ||
                        Math.abs(n - page) <= 1
                    )
                    .map((n, idx, arr) => (
                      <span key={n} className="opp-pagination__item">
                        {idx > 0 && arr[idx - 1] !== n - 1 && (
                          <span className="opp-pagination__gap">…</span>
                        )}
                        <button
                          type="button"
                          className={`opp-page-btn opp-page-btn--num${n === page ? ' is-active' : ''}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      </span>
                    ))}
                </div>
                <button
                  type="button"
                  className="opp-page-btn"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <i className="fas fa-arrow-right" aria-hidden />
                </button>
              </nav>
            )}
          </div>
        </div>
      </section>

      <section className="opp-cta">
        <div className="opp-cta__pattern" aria-hidden />
        <div className="container opp-cta__inner">
          <span className="opp-eyebrow">Community</span>
          <h2>Share an opportunity with us</h2>
          <p>
            Know a grant, fellowship, or program our community should see? Send
            it our way and we&apos;ll list it for everyone.
          </p>
          <Link to="/contact" className="opp-btn opp-btn--light">
            Submit an opportunity
            <i className="fas fa-arrow-right" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}

function FeaturedCard({ opp, large = false }) {
  const deadline = formatDeadline(opp.deadline);

  return (
    <Link
      to={`/opportunities/${opp.slug}`}
      className={`opp-featured${large ? ' opp-featured--large' : ''}`}
    >
      <div className="opp-featured__media">
        <img src={opp.image || FALLBACK_IMAGE} alt={opp.imageAlt || ''} loading="lazy" />
        <div className="opp-featured__shade" />
        <span className="opp-featured__cat">
          <i
            className={`fas ${CATEGORY_ICONS[opp.category] || 'fa-star'}`}
            aria-hidden
          />
          {opp.category}
        </span>
        <span
          className={`opp-featured__deadline${deadline.urgent ? ' is-urgent' : ''}${deadline.expired ? ' is-expired' : ''}`}
        >
          <i className="fas fa-clock" aria-hidden />
          {deadline.expired ? 'Closed' : deadline.label}
        </span>
      </div>
      <div className="opp-featured__body">
        <h3>{opp.title}</h3>
        <p>{getOpportunityLead(opp.summary)}</p>
        <span className="opp-featured__link">
          View details <i className="fas fa-arrow-right" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function OpportunityCard({ opp }) {
  const deadline = formatDeadline(opp.deadline);

  return (
    <Link to={`/opportunities/${opp.slug}`} className="opp-card">
      <div className="opp-card__media">
        <img src={opp.image || FALLBACK_IMAGE} alt={opp.imageAlt || ''} loading="lazy" />
        <div className="opp-card__shade" />
        <span className="opp-card__cat">
          <i
            className={`fas ${CATEGORY_ICONS[opp.category] || 'fa-star'}`}
            aria-hidden
          />
          {opp.category}
        </span>
      </div>
      <div className="opp-card__body">
        <div className="opp-card__top">
          <span
            className={`opp-card__deadline${deadline.urgent ? ' is-urgent' : ''}${deadline.expired ? ' is-expired' : ''}`}
          >
            <i className="fas fa-clock" aria-hidden />
            {deadline.expired ? 'Closed' : deadline.label}
          </span>
        </div>
        <h3>{opp.title}</h3>
        <p>{getOpportunityLead(opp.summary)}</p>
        <span className="opp-card__link">
          Read more <i className="fas fa-arrow-right" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
