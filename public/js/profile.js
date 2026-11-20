document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const joinedDate = document.getElementById('joinedDate');
  const favouriteLocation = document.getElementById('favouriteLocation');
  const postsCreated = document.getElementById('postsCreated');
  const hangoutsJoined = document.getElementById('hangoutsJoined');
  const checkInsCompleted = document.getElementById('checkInsCompleted');
  const bookmarksSaved = document.getElementById('bookmarksSaved');
  const friendsCount = document.getElementById('friendsCount');
  const profileMessage = document.getElementById('profileMessage');
  const profileSummary = document.getElementById('profileSummary');
  const logoutButton = document.getElementById('logoutButton');

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function countValue(value) {
    return Number(value) || 0;
  }

  function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (!dateValue || isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function showMessage(message, isError) {
    profileMessage.textContent = message;
    profileMessage.classList.toggle('error', isError === true);
  }

  function clearStoredLogin() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user_id');
    localStorage.removeItem('student_name');
    localStorage.removeItem('student_email');
  }

  function fillProfile(profile) {
    const posts = countValue(profile.posts_created);
    const accepted = countValue(profile.hangouts_joined);
    const checkIns = countValue(profile.check_ins_completed);
    const bookmarks = countValue(profile.bookmarks_saved);
    const friends = countValue(profile.friends_count);

    setText(profileName, profile.student_name || 'Student User');
    setText(profileEmail, profile.student_email || 'student@ichat.sp.edu.sg');
    setText(joinedDate, formatDate(profile.created_at));
    setText(favouriteLocation, profile.favourite_location || 'No favourite yet');
    setText(postsCreated, posts);
    setText(hangoutsJoined, accepted);
    setText(checkInsCompleted, checkIns);
    setText(bookmarksSaved, bookmarks);
    setText(friendsCount, friends);

    profileSummary.textContent =
      'You have created ' +
      posts +
      ' posts, accepted ' +
      accepted +
      ' hangouts, completed ' +
      checkIns +
      ' check-ins, saved ' +
      bookmarks +
      ' bookmarks and connected with ' +
      friends +
      ' friends.';

    localStorage.setItem('student_name', profile.student_name || '');
    localStorage.setItem('student_email', profile.student_email || '');
    showMessage('Profile loaded successfully.', false);
  }

  function loadProfile() {
    fetch('/profile/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { response: response, data: data };
          });
      })
      .then(function (result) {
        if (result.response.status === 401) {
          clearStoredLogin();
          window.location.href = 'login.html';
          return;
        }

        if (!result.response.ok) {
          showMessage(result.data.message || 'Failed to load profile.', true);
          return;
        }

        fillProfile(result.data);
      })
      .catch(function (error) {
        console.error('Profile fetch error:', error);
        showMessage('Failed to load profile.', true);
      });
  }

  logoutButton.addEventListener('click', function () {
    clearStoredLogin();
    window.location.href = 'login.html';
  });

  loadProfile();
});
