document.addEventListener('DOMContentLoaded', function () {
  const bookmarkList = document.getElementById('bookmarkList');

  const token = localStorage.getItem('token');

  // Redirect if user is not logged in
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  if (!bookmarkList) return;

  //////////////////////////////////////////////////////
  // FETCH HELPER
  //////////////////////////////////////////////////////
  function fetchMethod(url, callback, method = 'GET', data = null, token = null) {
    const fetchConfig = {
      method,
      headers: {},
    };

    if (data) {
      fetchConfig.headers['Content-Type'] = 'application/json';
      fetchConfig.body = JSON.stringify(data);
    }

    if (token) {
      fetchConfig.headers.Authorization = `Bearer ${token}`;
    }

    fetch(url, fetchConfig)
      .then(async (res) => {
        let data;

        try {
          data = await res.json();
        } catch {
          data = {};
        }

        callback(res.status, data);
      })
      .catch((err) => {
        console.error(err);

        callback(500, {
          error: 'Network error',
        });
      });
  }

  //////////////////////////////////////////////////////
  // ESCAPE HTML
  //////////////////////////////////////////////////////
  function esc(str) {
    if (!str) return '';

    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  //////////////////////////////////////////////////////
  // FORMAT DATE
  //////////////////////////////////////////////////////
  function formatDate(dateStr) {
    const d = new Date(dateStr);

    if (isNaN(d)) return '';

    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  //////////////////////////////////////////////////////
  // RENDER BOOKMARKS
  //////////////////////////////////////////////////////
  function renderBookmarks(bookmarks) {
    if (!bookmarks.length) {
      bookmarkList.innerHTML = `
        <div class="empty-state">
          <h3>No bookmarks yet ⭐</h3>
          <p>Save posts from the forum to see them here.</p>
        </div>
      `;
      return;
    }

    bookmarkList.innerHTML = '';

    bookmarks.forEach((b, index) => {
      bookmarkList.innerHTML += `
        <div class="post-card" style="animation-delay:${index * 0.05}s">
          <div class="card-top">
            <span class="cat-badge">${esc(b.location_name)}</span>
            <span class="card-author">@${esc(b.student_name)}</span>
          </div>

          <h3 class="card-title">${esc(b.title)}</h3>

          <p class="card-desc">
            ${esc(b.description)}
          </p>

          <div class="card-participants">
            ${b.current_participants} / ${b.max_participants} participants
          </div>

          <div class="card-footer-row">
            <span class="card-date">
              ${formatDate(b.created_at)}
            </span>

            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <button
                class="btn-card-action delete"
                onclick="removeBookmark(${b.post_id})"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      `;
    });
  }

  //////////////////////////////////////////////////////
  // LOAD BOOKMARKS
  //////////////////////////////////////////////////////
  function loadBookmarks() {
    fetchMethod(
      '/bookmark',
      (status, res) => {
        console.log('bookmark response:', status, res);

        if (status === 200) {
          renderBookmarks(res);
        } else {
          bookmarkList.innerHTML = `
            <p>Failed to load bookmarks.</p>
          `;
        }
      },
      'GET',
      null,
      token,
    );
  }

  //////////////////////////////////////////////////////
  // REMOVE BOOKMARK
  //////////////////////////////////////////////////////
  window.removeBookmark = function (postId) {
    if (!confirm('Remove this bookmark?')) return;

    fetchMethod(
      `/bookmark/${postId}`,
      (status, res) => {
        console.log('remove bookmark:', status, res);

        if (status === 200) {
          loadBookmarks();
        } else {
          alert(res?.error || 'Failed to remove bookmark');
        }
      },
      'DELETE',
      null,
      token,
    );
  };

  //////////////////////////////////////////////////////
  // INITIAL LOAD
  //////////////////////////////////////////////////////
  loadBookmarks();
});