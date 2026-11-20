const token = localStorage.getItem('token');

const currentUserId = localStorage.getItem('userId');

if (!token || !currentUserId) {
  window.location.href = 'login.html';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',

    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

async function loadRequests() {
  const response = await fetch(`/friends/pending/${currentUserId}`, {
    headers: authHeaders(),
  });

  const requests = await response.json();

  document.getElementById('pending-count').textContent = requests.length;

  const container = document.getElementById('requests-container');

  container.innerHTML = '';

  requests.forEach((request) => {
    const div = document.createElement('div');

    div.className = 'card';

    div.innerHTML = `
      <p>
        ${request.sender_name}
        sent you a friend request.
      </p>

      <button
        class="accept-btn"
        onclick="acceptRequest(${request.id})"
      >
        Accept
      </button>

      <button
        class="reject-btn"
        onclick="rejectRequest(${request.id})"
      >
        Reject
      </button>
    `;

    container.appendChild(div);
  });
}

async function loadFriends() {
  try {
    const response = await fetch(`/friends/list/${currentUserId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    const friends = await response.json();

    document.getElementById('friend-count').textContent =
      `${friends.length} Friend${friends.length == 1 ? '' : 's'}`;

    const container = document.getElementById('friends-container');

    container.innerHTML = '';

    //////////////////////////////////////////////////////
    // NO FRIENDS
    //////////////////////////////////////////////////////
    if (!friends.length) {
      container.innerHTML = `
        <div class="card">
          No friends yet.
        </div>
      `;

      return;
    }

    //////////////////////////////////////////////////////
    // DISPLAY FRIENDS
    //////////////////////////////////////////////////////
    friends.forEach((friend) => {
      const friendName =
        friend.sender_id == currentUserId ? friend.receiver_name : friend.sender_name;

      //////////////////////////////////////////////////////
      // GET REAL FRIEND ID
      //////////////////////////////////////////////////////

      const friendId = friend.sender_id == currentUserId ? friend.receiver_id : friend.sender_id;

      container.innerHTML += `

    <div class="card">

      <div
        onclick="openProfile(${friendId})"
        style="cursor:pointer;"
      >

        <h3>
          ${friendName}
        </h3>

        <p>
          Friends since:
          ${new Date(friend.created_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>

      </div>

      <button
        class="remove-btn"
        onclick="removeFriend(${friend.id})"
      >
        Remove Friend
      </button>

    </div>

  `;
    });
  } catch (err) {
    console.error(err);
  }
}

async function acceptRequest(id) {
  try {
    const token = localStorage.getItem('token');

    const response = await fetch(`/friends/accept/${id}`, {
      method: 'PATCH',

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Failed to accept request');

      return;
    }

    loadRequests();

    loadFriends();
  } catch (err) {
    console.error(err);
  }
}

async function rejectRequest(id) {
  try {
    const token = localStorage.getItem('token');

    const response = await fetch(`/friends/reject/${id}`, {
      method: 'PATCH',

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Failed to reject request');

      return;
    }

    loadRequests();
  } catch (err) {
    console.error(err);
  }
}

async function searchUsers() {
  const searchInput = document.getElementById('search-user');

  const search = searchInput.value.trim();

  if (!search) {
    alert('Enter a name');

    return;
  }

  const response = await fetch(`/friends/search/${search}`, {
    headers: authHeaders(),
  });

  const users = await response.json();

  const container = document.getElementById('search-results');

  container.innerHTML = '';

  if (users.length === 0) {
    container.innerHTML = `
      <div class="card">
        <p>No users found.</p>
      </div>
    `;

    return;
  }

  users.forEach((user) => {
    if (user.id == currentUserId) return;

    const card = document.createElement('div');

    card.className = 'card';

    card.innerHTML = `

      <h3>${user.student_name}</h3>

      <div class="button-group">

        <button
          class="add-btn"
          onclick="sendRequestToUser(${user.id})"
        >
          Add Friend
        </button>

      </div>

    `;

    container.appendChild(card);
  });
}

async function sendRequestToUser(receiverId) {
  try {
    const token = localStorage.getItem('token');

    const response = await fetch('/friends/request', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        sender_id: currentUserId,

        receiver_id: receiverId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || data.message || 'Failed to send request');

      return;
    }

    alert('Friend request sent!');

    loadSuggestions();
  } catch (err) {
    console.error(err);
  }
}

function logout() {
  localStorage.removeItem('token');

  localStorage.removeItem('userId');

  window.location.href = 'login.html';
}

function openSearchModal() {
  document.getElementById('search-modal').classList.remove('hidden');
}

function closeSearchModal() {
  document.getElementById('search-modal').classList.add('hidden');
}

function openNotificationModal() {
  document.getElementById('notification-modal').classList.remove('hidden');
}

function closeNotificationModal() {
  document.getElementById('notification-modal').classList.add('hidden');
}

async function openProfile(id) {
  try {
    const response = await fetch(`/users/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    const user = await response.json();

    document.getElementById('profile-content').innerHTML = `

<div class="profile-popup">

  <div class="profile-avatar">

    ${user.student_name.charAt(0).toUpperCase()}

  </div>

  <h2>
    ${user.student_name}
  </h2>

  <p class="profile-email">
    ${user.student_email}
  </p>

  <div class="profile-section">

    <h3>
      About Me
    </h3>

    <p>
      ${user.bio || 'No bio yet.'}
    </p>

  </div>

</div>

`;

    document.getElementById('profile-modal').classList.remove('hidden');
  } catch (err) {
    console.error(err);
  }
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.add('hidden');
}

async function loadSuggestions() {
  try {
    const response = await fetch('/friends/suggestions', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    const users = await response.json();

    const container = document.getElementById('suggestions-container');

    container.innerHTML = '';

    if (!users.length) {
      container.innerHTML = `
        <div class="card">
          No suggestions available.
        </div>
      `;

      return;
    }

    users.forEach((user) => {
      container.innerHTML += `

      <div class="card">

      <h3>
      ${user.student_name}
      </h3>

      <p class="mutual-friends">
      ${user.mutual_count || 0}
      mutual friend${user.mutual_count == 1 ? '' : 's'}
      </p>

      <button
      class="add-btn"
      onclick="sendRequestToUser(${user.id})"
      >
      Add Friend
      </button>

      </div>

    `;
    });
  } catch (err) {
    console.error(err);
  }
}

async function removeFriend(id) {
  if (!confirm('Remove this friend?')) return;

  try {
    const response = await fetch(`/friends/remove/${id}`, {
      method: 'DELETE',

      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    await response.json();

    loadFriends();
  } catch (err) {
    console.error(err);
  }
}

loadRequests();

Object.assign(window, {
  acceptRequest,
  rejectRequest,
  searchUsers,
  sendRequestToUser,
  logout,
  openSearchModal,
  closeSearchModal,
  openNotificationModal,
  closeNotificationModal,
  openProfile,
  closeProfileModal,
  removeFriend,
});

loadFriends();

loadSuggestions();
