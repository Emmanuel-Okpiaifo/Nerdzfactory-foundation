import { useEffect, useState } from 'react';

const WP_API = 'https://nerdzfactory.org/wp-json/wp/v2';

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 6;

  useEffect(() => {
    document.title = 'Blog — Nerdzfactory Foundation';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const catRes = await fetch(`${WP_API}/categories?search=Articles`);
        const cats = await catRes.json();
        const catId = cats[0]?.id;
        if (!catId) { setPosts([]); return; }

        const res = await fetch(
          `${WP_API}/posts?per_page=${perPage}&page=${page}&categories=${catId}&_embed`
        );
        const data = await res.json();
        if (cancelled) return;
        setPosts(data);
        setTotal(parseInt(res.headers.get('X-WP-Total') || '0', 10));
        setTotalPages(parseInt(res.headers.get('X-WP-TotalPages') || '1', 10));
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  return (
    <main>
      <section className="blog-hero">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>Our Blog</h1>
          <p>Insights, stories, and updates from our journey of empowering communities through technology.</p>
        </div>
      </section>

      <section className="blog-content">
        <div className="container">
          <div className="blog-filters">
            <button type="button" className="filter-btn active">Articles</button>
            {!loading && total > 0 && (
              <div className="posts-counter">
                Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} Articles
              </div>
            )}
          </div>

          {loading && (
            <div className="loading-spinner" style={{ display: 'flex' }}>
              <div className="spinner" />
              <p>Loading blog posts...</p>
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div className="no-posts">
              <h3>No Articles Found</h3>
              <p>No articles are currently available.</p>
            </div>
          )}

          {!loading && posts.length > 0 && (
            <div className="blog-grid">
              {posts.map((post) => {
                const img = post._embedded?.['wp:featuredmedia']?.[0]?.source_url
                  || 'https://nerdzfactory.org/wp-content/uploads/2023/04/FM_03445-2.jpg';
                const excerpt = post.excerpt.rendered.replace(/<[^>]*>/g, '').substring(0, 150) + '...';
                const date = new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                });
                return (
                  <article key={post.id} className="blog-card">
                    <div className="blog-image">
                      <img src={img} alt={post.title.rendered} />
                    </div>
                    <div className="blog-content">
                      <div className="blog-meta">
                        <span className="blog-category">Articles</span>
                        <span className="blog-date">{date}</span>
                      </div>
                      <h3 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                      <p>{excerpt}</p>
                      <a href={post.link} className="read-more" target="_blank" rel="noopener noreferrer">
                        Read More
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="blog-pagination">
              {page > 1 && (
                <button type="button" className="pagination-btn prev" onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`pagination-btn${n === page ? ' active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              {page < totalPages && (
                <button type="button" className="pagination-btn next" onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
