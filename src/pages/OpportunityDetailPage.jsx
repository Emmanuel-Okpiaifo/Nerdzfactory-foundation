import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  fetchOpportunityBySlug,
  fetchRelated,
} from '../lib/opportunitiesApi';
import {
  formatDeadline,
  getOpportunityLead,
  isEffectivelyEmptyHtml,
  CATEGORY_ICONS,
  FALLBACK_IMAGE,
} from '../lib/opportunities';
import '../styles/opportunities.css';
import '../styles/opportunity-detail.css';

export default function OpportunityDetailPage() {
  const { slug } = useParams();
  const [opportunity, setOpportunity] = useState(null);
  const [browseMore, setBrowseMore] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const similarOpportunities = browseMore.slice(0, 3);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setOpportunity(null);
    setBrowseMore([]);
    window.scrollTo(0, 0);

    (async () => {
      try {
        const data = await fetchOpportunityBySlug(slug);
        if (cancelled) return;
        setOpportunity(data);
        const related = await fetchRelated(data, 8);
        if (!cancelled) setBrowseMore(related);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (opportunity) {
      document.title = `${opportunity.title} — Nerdzfactory Foundation`;
    }
  }, [opportunity]);

  const proseHtml = useMemo(() => {
    if (!opportunity?.content || isEffectivelyEmptyHtml(opportunity.content)) return '';
    return opportunity.content;
  }, [opportunity?.content]);

  if (!loading && notFound) return <Navigate to="/opportunities" replace />;
  if (!loading && !opportunity) return <Navigate to="/opportunities" replace />;

  const display = opportunity;
  const deadline = formatDeadline(display?.deadline);
  const lead = display ? getOpportunityLead(display.summary) : '';
  const applyUrl = display?.applyUrl;
  const canApply = applyUrl && !applyUrl.startsWith('#');

  return (
    <main className="opp-detail-page">
      <div className="opp-detail-bar">
        <div className="container opp-detail-bar__inner">
          <Link to="/opportunities" className="opp-detail-back">
            <i className="fas fa-arrow-left" aria-hidden />
            All opportunities
          </Link>
        </div>
      </div>

      {loading && (
        <div className="opp-detail-loading" style={{ padding: '4rem 1rem' }}>
          <div className="opp-detail-loading__ring" />
          <p>Loading opportunity...</p>
        </div>
      )}

      {!loading && display && (
        <>
          <section className="opp-detail-intro">
            <div className="container">
              <div className="opp-detail-intro__card">
                <div className="opp-detail-intro__visual">
                  <img
                    src={display.image || FALLBACK_IMAGE}
                    alt={display.imageAlt || display.title}
                    loading="eager"
                  />
                  <span className="opp-detail-intro__cat">
                    <i
                      className={`fas ${CATEGORY_ICONS[display.category] || 'fa-star'}`}
                      aria-hidden
                    />
                    {display.category}
                  </span>
                </div>

                <div className="opp-detail-intro__main">
                  {deadline.urgent && !deadline.expired && (
                    <span className="opp-detail-urgent">
                      <i className="fas fa-bolt" aria-hidden />
                      Closing soon
                    </span>
                  )}

                  <h1>{display.title}</h1>

                  {lead && <p className="opp-detail-lead">{lead}</p>}

                  <div className="opp-detail-facts">
                    <div className="opp-detail-fact">
                      <i className="fas fa-calendar-alt" aria-hidden />
                      <div>
                        <span>Deadline</span>
                        <strong className={deadline.expired ? 'is-expired' : ''}>
                          {deadline.expired ? 'Closed' : deadline.label}
                        </strong>
                      </div>
                    </div>
                    <div className="opp-detail-fact">
                      <i className="fas fa-map-marker-alt" aria-hidden />
                      <div>
                        <span>Location</span>
                        <strong>{display.location || 'Not specified'}</strong>
                      </div>
                    </div>
                    {display.tags?.length > 0 && (
                      <div className="opp-detail-fact opp-detail-fact--tags">
                        <i className="fas fa-tags" aria-hidden />
                        <div>
                          <span>Tags</span>
                          <div className="opp-detail-taglist">
                            {display.tags.map((t) => (
                              <em key={t}>{t}</em>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {canApply && (
                    <div className="opp-detail-intro__cta">
                      <a
                        href={applyUrl}
                        className="opp-btn opp-btn--primary"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Click to apply
                        <i className="fas fa-external-link-alt" aria-hidden />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="opp-detail-read">
            <div className="container opp-detail-read__layout">
              <article className="opp-detail-article">
                <header className="opp-detail-article__head">
                  <span className="opp-eyebrow opp-eyebrow--dark">Overview</span>
                  <h2>About this opportunity</h2>
                </header>

                {proseHtml ? (
                  <div
                    className="opp-detail-prose opp-detail-prose--cms"
                    dangerouslySetInnerHTML={{ __html: proseHtml }}
                  />
                ) : lead ? (
                  <div className="opp-detail-prose">
                    <p>{lead}</p>
                  </div>
                ) : (
                  <div className="opp-detail-prose">
                    <p>No additional details have been added for this opportunity yet.</p>
                  </div>
                )}

                {canApply && (
                  <div className="opp-detail-apply-banner">
                    <div>
                      <strong>Ready to apply?</strong>
                      <p>Visit the official application page to submit your entry.</p>
                    </div>
                    <a
                      href={applyUrl}
                      className="opp-btn opp-btn--primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to apply
                      <i className="fas fa-external-link-alt" aria-hidden />
                    </a>
                  </div>
                )}
              </article>

              <aside className="opp-detail-aside" aria-label="Quick actions">
                <div className="opp-detail-aside__card">
                  <p className="opp-detail-aside__label">Application</p>
                  <p
                    className={`opp-detail-aside__deadline${deadline.urgent ? ' is-urgent' : ''}${deadline.expired ? ' is-expired' : ''}`}
                  >
                    {deadline.expired ? 'This opportunity has closed' : deadline.label}
                  </p>
                  {canApply && (
                    <a
                      href={applyUrl}
                      className="opp-btn opp-btn--primary opp-btn--block"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to apply
                      <i className="fas fa-external-link-alt" aria-hidden />
                    </a>
                  )}
                  {browseMore.length > 0 && (
                    <div className="opp-detail-aside__browse">
                      <p className="opp-detail-aside__browse-title">
                        Browse more opportunities
                      </p>
                      <ul className="opp-detail-aside__browse-list">
                        {browseMore.map((o) => (
                          <BrowseItem key={o.slug} opp={o} />
                        ))}
                      </ul>
                    </div>
                  )}
                  <Link to="/opportunities" className="opp-detail-aside__link">
                    View all opportunities
                  </Link>
                </div>
              </aside>
            </div>
          </section>

          {similarOpportunities.length > 0 && (
            <section className="opp-detail-related">
              <div className="container">
                <header className="opp-detail-related__head">
                  <span className="opp-eyebrow opp-eyebrow--dark">Keep exploring</span>
                  <h2>Similar opportunities</h2>
                </header>
                <div className="opp-detail-related__grid">
                  {similarOpportunities.map((o) => (
                    <RelatedCard key={o.slug} opp={o} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {canApply && (
            <div className="opp-detail-mobile-cta">
              <a
                href={applyUrl}
                className="opp-btn opp-btn--primary opp-btn--block"
                target="_blank"
                rel="noopener noreferrer"
              >
                Click to apply
                <i className="fas fa-external-link-alt" aria-hidden />
              </a>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function BrowseItem({ opp }) {
  const deadline = formatDeadline(opp.deadline);

  return (
    <li>
      <Link to={`/opportunities/${opp.slug}`} className="opp-detail-aside__browse-item">
        <span className="opp-detail-aside__browse-name">{opp.title}</span>
        <span className="opp-detail-aside__browse-meta">
          {deadline.expired ? 'Closed' : deadline.label}
        </span>
      </Link>
    </li>
  );
}

function RelatedCard({ opp }) {
  const deadline = formatDeadline(opp.deadline);

  return (
    <Link to={`/opportunities/${opp.slug}`} className="opp-detail-related-card">
      <div className="opp-detail-related-card__img">
        <img src={opp.image || FALLBACK_IMAGE} alt={opp.imageAlt || ''} loading="lazy" />
      </div>
      <div className="opp-detail-related-card__body">
        <span className="opp-detail-related-card__cat">{opp.category}</span>
        <h3>{opp.title}</h3>
        <time>
          {deadline.expired ? 'Closed' : deadline.label}
        </time>
        <span className="opp-detail-related-card__cta">
          View details <i className="fas fa-arrow-right" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
