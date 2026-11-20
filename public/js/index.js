const ACCEPT_API_ENDPOINT = '/accept/user';

const acceptedPostsContainer = document.getElementById('somethingsTableBody');
const postTemplate = document.getElementById('somethingRowTemplate');
const homepageUsername = document.getElementById('homepageUsername');
const homepageEmail = document.getElementById('homepageEmail');

function getToken() {
  return localStorage.getItem('token');
}

function getCurrentUserId() {
  return localStorage.getItem('userId') || localStorage.getItem('user_id');
}

function clearStoredLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('user_id');
  localStorage.removeItem('student_name');
  localStorage.removeItem('student_email');
}

function loadHomepageUser() {
  homepageUsername.textContent = localStorage.getItem('student_name') || 'Student User';
  homepageEmail.textContent = localStorage.getItem('student_email') || 'student@ichat.sp.edu.sg';
}

function showMessage(title, message) {
  acceptedPostsContainer.innerHTML = '';

  const emptyMessage = document.createElement('div');
  emptyMessage.className = 'empty-message';
  emptyMessage.setAttribute('data-testid', 'accepted-empty-state');

  const heading = document.createElement('h3');
  heading.textContent = title;

  const paragraph = document.createElement('p');
  paragraph.textContent = message;

  const link = document.createElement('a');
  link.href = 'post.html';
  link.textContent = 'Browse Hangouts';

  emptyMessage.appendChild(heading);
  emptyMessage.appendChild(paragraph);
  emptyMessage.appendChild(link);
  acceptedPostsContainer.appendChild(emptyMessage);
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (isNaN(date.getTime())) return 'Recently';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function setOptionalDetail(card, selector, value) {
  const element = card.querySelector(selector);
  const row = element.closest('p');

  if (value === undefined || value === null || value === '') {
    row.hidden = true;
    return;
  }

  element.textContent = value;
}

function renderAcceptedPosts(acceptedPosts) {
  acceptedPostsContainer.innerHTML = '';

  if (!Array.isArray(acceptedPosts) || acceptedPosts.length === 0) {
    showMessage('No accepted hangout posts yet.', 'Accept a hangout and it will appear here.');
    return;
  }

  acceptedPosts.forEach(function (acceptance) {
    const card = postTemplate.content.cloneNode(true);

    card.querySelector('.something-name').textContent =
      acceptance.post_title || acceptance.title || 'Hangout Post';
    card.querySelector('.something-id').textContent = acceptance.post_id;
    card.querySelector('.accepted-date').textContent = formatDate(acceptance.accepted_at);
    card.querySelector('.checkin-link').href =
      'checkin.html?postId=' + encodeURIComponent(acceptance.post_id);

    setOptionalDetail(card, '.host-name', acceptance.host_name);
    setOptionalDetail(card, '.location-name', acceptance.location_name);

    const participantCount =
      acceptance.current_participants !== undefined && acceptance.max_participants !== undefined
        ? acceptance.current_participants + ' / ' + acceptance.max_participants
        : null;

    setOptionalDetail(card, '.participant-count', participantCount);

    card.querySelector('.delete-button').addEventListener('click', function () {
      const confirmed = window.confirm('Are you sure you want to cancel this accepted hangout?');

      if (confirmed) cancelAccept(acceptance.post_id);
    });

    acceptedPostsContainer.appendChild(card);
  });
}

function readJsonResponse(response) {
  return response
    .json()
    .catch(function () {
      return {};
    })
    .then(function (data) {
      return { response: response, data: data };
    });
}

function populateAcceptedPosts() {
  const token = getToken();
  const userId = getCurrentUserId();

  if (!token || !userId) {
    clearStoredLogin();
    window.location.href = 'login.html';
    return;
  }

  fetch(ACCEPT_API_ENDPOINT + '/' + encodeURIComponent(userId), {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
  })
    .then(readJsonResponse)
    .then(function (result) {
      if (result.response.status === 401) {
        clearStoredLogin();
        window.location.href = 'login.html';
        return;
      }

      if (!result.response.ok) {
        showMessage(
          'Failed to load accepted posts.',
          result.data.message || result.data.error || 'Please refresh and try again.',
        );
        return;
      }

      renderAcceptedPosts(result.data);
    })
    .catch(function (error) {
      console.error('Accepted posts fetch error:', error);
      showMessage('Failed to load accepted posts.', 'Please check your connection and try again.');
    });
}

function cancelAccept(postId) {
  fetch('/accept/' + encodeURIComponent(postId), {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + getToken() },
  })
    .then(readJsonResponse)
    .then(function (result) {
      if (!result.response.ok) {
        window.alert(result.data.message || result.data.error || 'Failed to cancel acceptance.');
        return;
      }

      window.alert('Acceptance removed successfully.');
      populateAcceptedPosts();
    })
    .catch(function (error) {
      console.error('Cancel acceptance error:', error);
      window.alert('Failed to cancel acceptance.');
    });
}

document.addEventListener('DOMContentLoaded', function () {
  loadHomepageUser();
  populateAcceptedPosts();
});
