document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const checkInForm = document.getElementById('checkInForm');
  const eligiblePost = document.getElementById('eligiblePost');
  const checkInButton = document.getElementById('checkInButton');
  const checkInMessage = document.getElementById('checkInMessage');
  const checkInContainer = document.getElementById('checkInContainer');
  const checkInTemplate = document.getElementById('checkInTemplate');
  const postIdFilter = document.getElementById('postIdFilter');
  const refreshButton = document.getElementById('refreshButton');

  let allCheckIns = [];

  function request(url, options, callback) {
    const requestOptions = options || {};
    requestOptions.headers = requestOptions.headers || {};
    requestOptions.headers.Authorization = 'Bearer ' + token;

    fetch(url, requestOptions)
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            callback(null, response, data);
          });
      })
      .catch(function (error) {
        callback(error);
      });
  }

  function showMessage(message, type) {
    checkInMessage.textContent = message;
    checkInMessage.className = 'status-message visible ' + type;
  }

  function clearMessage() {
    checkInMessage.textContent = '';
    checkInMessage.className = 'status-message';
  }

  function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (isNaN(date.getTime())) return 'Recently';

    return date.toLocaleString('en-SG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderEmptyState(title, message) {
    checkInContainer.innerHTML = '';

    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.setAttribute('data-testid', 'checkin-empty-state');

    const heading = document.createElement('h3');
    heading.textContent = title;

    const paragraph = document.createElement('p');
    paragraph.textContent = message;

    emptyState.appendChild(heading);
    emptyState.appendChild(paragraph);
    checkInContainer.appendChild(emptyState);
  }

  function renderCheckIns() {
    const filterValue = postIdFilter.value.trim();

    const visibleCheckIns = filterValue
      ? allCheckIns.filter(function (checkIn) {
          return String(checkIn.post_id) === filterValue;
        })
      : allCheckIns;

    checkInContainer.innerHTML = '';

    if (visibleCheckIns.length === 0) {
      if (filterValue) {
        renderEmptyState(
          'No matching check-in',
          'Clear the post ID filter to view all completed check-ins.',
        );
      } else {
        renderEmptyState(
          'No completed check-ins yet',
          'Accept a hangout, then use the form above when you arrive.',
        );
      }

      return;
    }

    visibleCheckIns.forEach(function (checkIn) {
      const card = checkInTemplate.content.cloneNode(true);

      card.querySelector('.post-number').textContent = 'Post #' + checkIn.post_id;

      card.querySelector('.post-title').textContent = checkIn.title;

      card.querySelector('.post-description').textContent = checkIn.description;

      card.querySelector('.host-name').textContent = checkIn.host_name;

      card.querySelector('.location-name').textContent = checkIn.location_name;

      card.querySelector('.participant-count').textContent =
        checkIn.current_participants + ' / ' + checkIn.max_participants;

      card.querySelector('.checked-in-date').textContent = formatDate(checkIn.checked_in_at);

      card.querySelector('.cancel-button').addEventListener('click', function () {
        cancelCheckIn(checkIn.post_id, checkIn.title);
      });

      checkInContainer.appendChild(card);
    });
  }

  function loadCheckIns() {
    request('/checkin/me', { method: 'GET' }, function (error, response, data) {
      if (error || !response || !response.ok) {
        renderEmptyState(
          'Unable to load check-ins',
          (data && data.message) || 'Please try refreshing the page.',
        );

        return;
      }

      allCheckIns = Array.isArray(data) ? data : [];
      renderCheckIns();
    });
  }

  function loadEligibleHangouts() {
    eligiblePost.disabled = true;
    checkInButton.disabled = true;
    eligiblePost.innerHTML = '<option value="">Loading...</option>';

    request('/checkin/eligible', { method: 'GET' }, function (error, response, data) {
      eligiblePost.innerHTML = '';

      if (error || !response || !response.ok) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Unable to load accepted hangouts';

        eligiblePost.appendChild(option);

        showMessage((data && data.message) || 'Failed to load accepted hangouts.', 'error');

        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No accepted hangouts available';

        eligiblePost.appendChild(option);
        eligiblePost.disabled = true;
        checkInButton.disabled = true;

        return;
      }

      const placeholder = document.createElement('option');

      placeholder.value = '';
      placeholder.textContent = 'Choose an accepted hangout';

      eligiblePost.appendChild(placeholder);

      data.forEach(function (hangout) {
        const option = document.createElement('option');

        option.value = hangout.post_id;

        option.textContent =
          '#' + hangout.post_id + ' - ' + hangout.title + ' at ' + hangout.location_name;

        eligiblePost.appendChild(option);
      });

      const requestedPostId = new URLSearchParams(window.location.search).get('postId');

      if (
        requestedPostId &&
        data.some(function (hangout) {
          return String(hangout.post_id) === requestedPostId;
        })
      ) {
        eligiblePost.value = requestedPostId;
      }

      eligiblePost.disabled = false;
      checkInButton.disabled = false;
    });
  }

  function createCheckIn(postId) {
    checkInButton.disabled = true;
    clearMessage();

    request(
      '/checkin/' + encodeURIComponent(postId),
      { method: 'POST' },
      function (error, response, data) {
        checkInButton.disabled = false;

        if (error || !response || !response.ok) {
          showMessage((data && data.message) || 'Failed to create check-in.', 'error');

          return;
        }

        showMessage('Checked in successfully.', 'success');

        checkInForm.reset();
        loadEligibleHangouts();
        loadCheckIns();
      },
    );
  }

  function cancelCheckIn(postId, title) {
    const confirmed = window.confirm('Cancel your check-in for "' + title + '"?');

    if (!confirmed) return;

    request(
      '/checkin/' + encodeURIComponent(postId),
      { method: 'DELETE' },
      function (error, response, data) {
        if (error || !response || !response.ok) {
          showMessage((data && data.message) || 'Failed to cancel check-in.', 'error');

          return;
        }

        showMessage('Check-in cancelled successfully.', 'success');

        loadEligibleHangouts();
        loadCheckIns();
      },
    );
  }

  checkInForm.addEventListener('submit', function (event) {
    event.preventDefault();

    if (!eligiblePost.value) {
      showMessage('Choose an accepted hangout first.', 'error');

      return;
    }

    createCheckIn(eligiblePost.value);
  });

  postIdFilter.addEventListener('input', renderCheckIns);

  refreshButton.addEventListener('click', function () {
    clearMessage();
    loadEligibleHangouts();
    loadCheckIns();
  });

  loadEligibleHangouts();
  loadCheckIns();
});
