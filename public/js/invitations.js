const token = localStorage.getItem('token');

const currentUserId = localStorage.getItem('userId');

if (!token || !currentUserId) {
  window.location.href = 'login.html';
}

const urlParameters = new URLSearchParams(window.location.search);

const selectedPostId = urlParameters.get('postId');

let receivedInvitationsData = [];

let sentInvitationsData = [];

let activeInvitationTab = 'received';

function authHeaders() {
  return {
    'Content-Type': 'application/json',

    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

function showMessage(message, type = 'success') {
  const messageBox = document.getElementById('message-box');

  messageBox.textContent = message;

  messageBox.className = `message-box ${type === 'error' ? 'error-message' : 'success-message'}`;

  setTimeout(() => {
    messageBox.classList.add('hidden');
  }, 3500);
}

function formatDate(dateValue) {
  if (!dateValue) {
    return 'Not available';
  }

  return new Date(dateValue).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClass(status) {
  switch (status) {
    case 'ACCEPTED':
      return 'status-accepted';

    case 'DECLINED':
      return 'status-declined';

    case 'CANCELLED':
      return 'status-cancelled';

    case 'EXPIRED':
      return 'status-expired';

    default:
      return 'status-pending';
  }
}

async function loadNotifications() {
  const container = document.getElementById('notifications-container');

  try {
    const response = await fetch('/notifications', { headers: authHeaders() });
    const notifications = await response.json();
    if (!response.ok) throw new Error(notifications.error || 'Failed to load notifications.');

    container.innerHTML = '';
    const unread = notifications.filter((notification) => !notification.read_at);
    document.getElementById('notifications-count').textContent = unread.length;

    if (!notifications.length) {
      container.innerHTML = '<div class="invitation-card">No notifications yet.</div>';
      return;
    }

    notifications.forEach((notification) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `invitation-card notification-card${notification.read_at ? '' : ' unread'}`;

      const message = document.createElement('strong');
      message.textContent = notification.message;
      const date = document.createElement('span');
      date.textContent = formatDate(notification.created_at);
      card.append(message, date);

      if (!notification.read_at) {
        card.addEventListener('click', async () => {
          const markResponse = await fetch(`/notifications/${notification.id}/read`, {
            method: 'PATCH',
            headers: authHeaders(),
          });
          if (markResponse.ok) {
            await loadNotifications();
            await refreshInvitationBadge();
          }
        });
      }

      container.appendChild(card);
    });
  } catch (error) {
    container.textContent = error.message;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function markAllNotificationsRead() {
  const response = await fetch('/notifications/read-all', {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (response.ok) {
    await loadNotifications();
    await refreshInvitationBadge();
  }
}

async function refreshInvitationBadge() {
  const badge = document.getElementById('invitation-count');

  if (!badge) {
    return;
  }

  try {
    const response = await fetch('/notifications/unread-count', {
      headers: authHeaders(),
    });

    const data = await response.json();

    if (!response.ok || typeof data.count !== 'number') {
      badge.classList.add('hidden');
      return;
    }

    badge.textContent = data.count;

    if (data.count > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (err) {
    console.error('Failed to refresh invitation badge:', err);
  }
}

/* =====================================
   LOAD RECEIVED INVITATIONS
===================================== */

async function loadReceivedInvitations() {
  const container = document.getElementById('received-container');

  container.innerHTML = `
    <div class="invitation-card">
      Loading received invitations...
    </div>
  `;

  try {
    const response = await fetch('/hangout-invitations/received', {
      headers: authHeaders(),
    });

    const invitations = await response.json();

    if (!response.ok) {
      throw new Error(invitations.error || 'Failed to load received invitations.');
    }

    receivedInvitationsData = invitations;

    document.getElementById('received-count').textContent = invitations.length;

    applyInvitationFilters();
  } catch (err) {
    console.error(err);

    container.innerHTML = `
      <div class="invitation-card">

        <h3>
          Unable to load invitations
        </h3>

        <p>
          ${escapeHtml(err.message)}
        </p>

      </div>
    `;
  }
}
/* =====================================
   LOAD SENT INVITATIONS
===================================== */

async function loadSentInvitations() {
  const container = document.getElementById('sent-container');

  container.innerHTML = `
    <div class="invitation-card">
      Loading sent invitations...
    </div>
  `;

  try {
    const response = await fetch('/hangout-invitations/sent', {
      headers: authHeaders(),
    });

    const invitations = await response.json();

    if (!response.ok) {
      throw new Error(invitations.error || 'Failed to load sent invitations.');
    }

    sentInvitationsData = invitations;

    document.getElementById('sent-count').textContent = invitations.length;

    applyInvitationFilters();
  } catch (err) {
    console.error(err);

    container.innerHTML = `
      <div class="invitation-card">

        <h3>
          Unable to load invitations
        </h3>

        <p>
          ${escapeHtml(err.message)}
        </p>

      </div>
    `;
  }
}

/* =====================================
   SEARCH AND FILTER INVITATIONS
===================================== */

function applyInvitationFilters() {
  const searchInput = document.getElementById('invitation-search');

  const statusFilter = document.getElementById('invitation-status-filter');

  const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const selectedStatus = statusFilter ? statusFilter.value : 'ALL';

  const filteredReceived = receivedInvitationsData.filter((invitation) => {
    const searchableText = `
          ${invitation.hangout_title || ''}
          ${invitation.sender_name || ''}
          ${invitation.location_name || ''}
          ${invitation.description || ''}
        `.toLowerCase();

    const matchesSearch = searchableText.includes(searchText);

    const matchesStatus = selectedStatus === 'ALL' || invitation.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const filteredSent = sentInvitationsData.filter((invitation) => {
    const searchableText = `
          ${invitation.hangout_title || ''}
          ${invitation.receiver_name || ''}
        `.toLowerCase();

    const matchesSearch = searchableText.includes(searchText);

    const matchesStatus = selectedStatus === 'ALL' || invitation.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  renderReceivedInvitations(filteredReceived);

  renderSentInvitations(filteredSent);

  updateFilterResultMessage(
    filteredReceived.length,
    filteredSent.length,
    searchText,
    selectedStatus,
  );
}

function resetInvitationFilters() {
  const searchInput = document.getElementById('invitation-search');

  const statusFilter = document.getElementById('invitation-status-filter');

  searchInput.value = '';

  statusFilter.value = 'ALL';

  applyInvitationFilters();
}

function updateFilterResultMessage(receivedCount, sentCount, searchText, selectedStatus) {
  const message = document.getElementById('filter-result-message');

  if (!searchText && selectedStatus === 'ALL') {
    message.textContent = 'Showing all invitations';

    return;
  }

  const visibleCount = activeInvitationTab === 'received' ? receivedCount : sentCount;

  message.textContent = `${visibleCount} matching invitation${visibleCount === 1 ? '' : 's'} found`;
}

function renderSentInvitations(invitations) {
  const container = document.getElementById('sent-container');
  container.innerHTML = '';

  if (!invitations.length) {
    container.innerHTML =
      '<div class="invitation-card empty-filter-card"><h3>No matching sent invitations</h3></div>';
    return;
  }

  invitations.forEach((invitation) => {
    const card = document.createElement('div');
    card.className = 'invitation-card';
    card.innerHTML = `
      <h3>${escapeHtml(invitation.hangout_title)}</h3>
      <p><strong>Invited:</strong> ${escapeHtml(invitation.receiver_name)}</p>
      <p><strong>Hangout:</strong> ${formatDate(invitation.hangout_at)}</p>
      <p><strong>Invitation expires:</strong> ${formatDate(invitation.expires_at)}</p>
      <span class="status-badge ${getStatusClass(invitation.status)}">${escapeHtml(invitation.status)}</span>
      ${
        invitation.status === 'PENDING'
          ? `
        <div class="invitation-actions">
          <button class="decline-btn">
            Cancel Invitation
          </button>
        </div>`
          : ''
      }
    `;

    const cancelButton = card.querySelector('.decline-btn');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => cancelInvitation(invitation.id, cancelButton));
    }

    container.appendChild(card);
  });
}

function renderReceivedInvitations(invitations) {
  const container = document.getElementById('received-container');

  container.innerHTML = '';

  if (!invitations.length) {
    container.innerHTML = `
      <div class="invitation-card empty-filter-card">

        <h3>
          No matching received invitations
        </h3>

        <p>
          Try changing your search text
          or selected status.
        </p>

      </div>
    `;

    return;
  }

  invitations.forEach((invitation) => {
    const card = document.createElement('div');

    card.className = 'invitation-card';

    const actionButtons =
      invitation.status === 'PENDING'
        ? `
          <div class="invitation-actions">
            <button class="accept-btn">Accept</button>
            <button class="decline-btn">Decline</button>
          </div>
        `
        : '';

    card.innerHTML = `
        <h3>
          ${escapeHtml(invitation.hangout_title)}
        </h3>

        <p>
          <strong>Invited by:</strong>
          ${escapeHtml(invitation.sender_name)}
        </p>

        <p>
          <strong>Location:</strong>

          ${escapeHtml(invitation.location_name || 'Location not available')}
        </p>

        <p>
          ${escapeHtml(invitation.description || 'No description provided.')}
        </p>

        <p>
          <strong>Received:</strong>

          ${formatDate(invitation.created_at)}
        </p>

        <p><strong>Hangout:</strong> ${formatDate(invitation.hangout_at)}</p>
        <p><strong>Invitation expires:</strong> ${formatDate(invitation.expires_at)}</p>

        <span
          class="status-badge ${getStatusClass(invitation.status)}"
        >
          ${escapeHtml(invitation.status)}
        </span>

        ${actionButtons}
      `;

    const acceptButton = card.querySelector('.accept-btn');
    const declineButton = card.querySelector('.decline-btn');

    if (acceptButton) {
      acceptButton.addEventListener('click', () => acceptInvitation(invitation.id, acceptButton));
    }

    if (declineButton) {
      declineButton.addEventListener('click', () =>
        declineInvitation(invitation.id, declineButton),
      );
    }

    container.appendChild(card);
  });
}

/* =====================================
   ACCEPT INVITATION
===================================== */

async function acceptInvitation(id, button) {
  if (!confirm('Accept this invitation?')) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Accepting...';
  }

  try {
    const response = await fetch(`/hangout-invitations/accept/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to accept invitation.');
    }

    showMessage('Invitation accepted successfully.');

    await Promise.all([loadReceivedInvitations(), loadSentInvitations(), refreshInvitationBadge()]);
  } catch (err) {
    console.error(err);

    showMessage(err.message, 'error');

    if (button) {
      button.disabled = false;
      button.textContent = 'Accept';
    }
  }
}

/* =====================================
   DECLINE INVITATION
===================================== */

async function declineInvitation(id, button) {
  if (!confirm('Decline this invitation?')) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Declining...';
  }

  try {
    const response = await fetch(`/hangout-invitations/decline/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to decline invitation.');
    }

    showMessage('Invitation declined.');

    await Promise.all([loadReceivedInvitations(), refreshInvitationBadge()]);
  } catch (err) {
    console.error(err);

    showMessage(err.message, 'error');

    if (button) {
      button.disabled = false;
      button.textContent = 'Decline';
    }
  }
}

/* =====================================
   CANCEL INVITATION
===================================== */

async function cancelInvitation(id, button) {
  if (!confirm('Cancel this invitation?')) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Cancelling...';
  }

  try {
    const response = await fetch(`/hangout-invitations/cancel/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to cancel invitation.');
    }

    showMessage('Invitation cancelled.');

    await loadSentInvitations();

    if (selectedPostId) {
      await loadInvitableFriends();
    }
  } catch (err) {
    console.error(err);

    showMessage(err.message, 'error');

    if (button) {
      button.disabled = false;
      button.textContent = 'Cancel Invitation';
    }
  }
}

/* =====================================
   INVITE FRIEND MODAL
===================================== */

function openInviteModal() {
  const modal = document.getElementById('invite-modal');

  modal.classList.remove('hidden');

  resetBulkInviteSelection();

  loadInvitableFriends();
}

function closeInviteModal() {
  const modal = document.getElementById('invite-modal');

  modal.classList.add('hidden');

  resetBulkInviteSelection();
}

async function loadInvitableFriends() {
  const container = document.getElementById('invitable-friends-container');

  const controls = document.getElementById('bulk-invite-controls');

  const footer = document.getElementById('bulk-invite-footer');

  controls.classList.add('hidden');
  footer.classList.add('hidden');

  if (!selectedPostId) {
    container.innerHTML = `
      <div class="invitation-card">

        <h3>No hangout selected</h3>

        <p>
          Open this page from a hangout post
          before inviting friends.
        </p>

      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="invitation-card">
      Loading friends...
    </div>
  `;

  try {
    const response = await fetch(`/hangout-invitations/invitable/${selectedPostId}`, {
      headers: authHeaders(),
    });

    const friends = await response.json();

    if (!response.ok) {
      throw new Error(friends.error || 'Failed to load friends.');
    }

    container.innerHTML = '';

    if (!friends.length) {
      container.innerHTML = `
        <div class="invitation-card">

          <h3>No friends available</h3>

          <p>
            All eligible friends may already have
            been invited or joined the hangout.
          </p>

        </div>
      `;

      return;
    }

    controls.classList.remove('hidden');
    footer.classList.remove('hidden');

    friends.forEach((friend) => {
      const card = document.createElement('label');

      card.className = 'invitation-card selectable-friend-card';

      card.innerHTML = `
        <input
          type="checkbox"
          class="friend-invite-checkbox"
          value="${Number(friend.id)}"
        />

        <div class="friend-selection-details">

          <h3>
            ${escapeHtml(friend.student_name)}
          </h3>

          <p>
            Select this friend to include them
            in the invitation.
          </p>

        </div>
      `;

      card
        .querySelector('.friend-invite-checkbox')
        .addEventListener('change', updateBulkInviteSelection);

      container.appendChild(card);
    });

    updateBulkInviteSelection();
  } catch (err) {
    console.error(err);

    container.innerHTML = `
      <div class="invitation-card">

        <h3>Unable to load friends</h3>

        <p>${escapeHtml(err.message)}</p>

      </div>
    `;
  }
}

function getSelectedFriendIds() {
  const checkedBoxes = document.querySelectorAll('.friend-invite-checkbox:checked');

  return Array.from(checkedBoxes).map((checkbox) => Number(checkbox.value));
}

function updateBulkInviteSelection() {
  const allCheckboxes = document.querySelectorAll('.friend-invite-checkbox');

  const selectedCheckboxes = document.querySelectorAll('.friend-invite-checkbox:checked');

  const selectAllCheckbox = document.getElementById('select-all-friends');

  const selectedCount = document.getElementById('selected-friends-count');

  const bulkInviteButton = document.getElementById('bulk-invite-button');

  selectedCount.textContent = `${selectedCheckboxes.length} selected`;

  bulkInviteButton.disabled = selectedCheckboxes.length === 0;

  if (!allCheckboxes.length) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }

  selectAllCheckbox.checked = selectedCheckboxes.length === allCheckboxes.length;

  selectAllCheckbox.indeterminate =
    selectedCheckboxes.length > 0 && selectedCheckboxes.length < allCheckboxes.length;
}

function toggleSelectAllFriends(selectAllCheckbox) {
  const friendCheckboxes = document.querySelectorAll('.friend-invite-checkbox');

  friendCheckboxes.forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked;
  });

  updateBulkInviteSelection();
}

function resetBulkInviteSelection() {
  const selectAllCheckbox = document.getElementById('select-all-friends');

  const selectedCount = document.getElementById('selected-friends-count');

  const bulkInviteButton = document.getElementById('bulk-invite-button');

  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }

  if (selectedCount) {
    selectedCount.textContent = '0 selected';
  }

  if (bulkInviteButton) {
    bulkInviteButton.disabled = true;
    bulkInviteButton.textContent = 'Invite Selected Friends';
  }
}

async function sendBulkInvitations() {
  const receiverIds = getSelectedFriendIds();

  const bulkInviteButton = document.getElementById('bulk-invite-button');

  if (!selectedPostId) {
    showMessage('No hangout was selected.', 'error');

    return;
  }

  if (!receiverIds.length) {
    showMessage('Select at least one friend.', 'error');

    return;
  }

  bulkInviteButton.disabled = true;

  bulkInviteButton.textContent = `Inviting ${receiverIds.length}...`;

  const friendCheckboxes = document.querySelectorAll('.friend-invite-checkbox');

  friendCheckboxes.forEach((checkbox) => {
    checkbox.disabled = true;
  });

  const successfulInvites = [];
  const failedInvites = [];

  for (const receiverId of receiverIds) {
    try {
      const response = await fetch('/hangout-invitations', {
        method: 'POST',

        headers: authHeaders(),

        body: JSON.stringify({
          post_id: Number(selectedPostId),

          receiver_id: Number(receiverId),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation.');
      }

      successfulInvites.push(receiverId);
    } catch (err) {
      console.error(`Failed to invite user ${receiverId}:`, err);

      failedInvites.push({
        receiverId,
        error: err.message,
      });
    }
  }

  if (successfulInvites.length > 0 && failedInvites.length === 0) {
    showMessage(
      `${successfulInvites.length} invitation${
        successfulInvites.length === 1 ? '' : 's'
      } sent successfully.`,
    );
  } else if (successfulInvites.length > 0 && failedInvites.length > 0) {
    showMessage(
      `${successfulInvites.length} invitation${
        successfulInvites.length === 1 ? '' : 's'
      } sent, but ${failedInvites.length} failed.`,
      'error',
    );
  } else {
    showMessage('Unable to send the selected invitations.', 'error');
  }

  await Promise.all([loadSentInvitations(), loadInvitableFriends()]);
}

/* =====================================
   TABS
===================================== */

function showReceivedTab() {
  activeInvitationTab = 'received';

  document.querySelector('.invitation-filter-toolbar').classList.remove('hidden');
  document.getElementById('filter-result-message').classList.remove('hidden');

  document.getElementById('received-section').classList.remove('hidden');

  document.getElementById('sent-section').classList.add('hidden');

  document.getElementById('notifications-section').classList.add('hidden');
  document.getElementById('notifications-tab').classList.remove('active-tab');

  document.getElementById('received-tab').classList.add('active-tab');

  document.getElementById('sent-tab').classList.remove('active-tab');

  applyInvitationFilters();
}

function showSentTab() {
  activeInvitationTab = 'sent';

  document.querySelector('.invitation-filter-toolbar').classList.remove('hidden');
  document.getElementById('filter-result-message').classList.remove('hidden');

  document.getElementById('sent-section').classList.remove('hidden');

  document.getElementById('received-section').classList.add('hidden');

  document.getElementById('notifications-section').classList.add('hidden');
  document.getElementById('notifications-tab').classList.remove('active-tab');

  document.getElementById('sent-tab').classList.add('active-tab');

  document.getElementById('received-tab').classList.remove('active-tab');

  applyInvitationFilters();
}

function showNotificationsTab() {
  activeInvitationTab = 'notifications';
  document.querySelector('.invitation-filter-toolbar').classList.add('hidden');
  document.getElementById('filter-result-message').classList.add('hidden');
  document.getElementById('received-section').classList.add('hidden');
  document.getElementById('sent-section').classList.add('hidden');
  document.getElementById('notifications-section').classList.remove('hidden');
  document.getElementById('received-tab').classList.remove('active-tab');
  document.getElementById('sent-tab').classList.remove('active-tab');
  document.getElementById('notifications-tab').classList.add('active-tab');
  loadNotifications();
}

/* =====================================
   INITIAL PAGE LOAD
===================================== */

document.getElementById('open-invite-button').addEventListener('click', openInviteModal);

document.getElementById('close-invite-modal').addEventListener('click', closeInviteModal);

document.getElementById('received-tab').addEventListener('click', showReceivedTab);

document.getElementById('sent-tab').addEventListener('click', showSentTab);

document.getElementById('notifications-tab').addEventListener('click', showNotificationsTab);

document.getElementById('invitation-search').addEventListener('input', applyInvitationFilters);

document
  .getElementById('invitation-status-filter')
  .addEventListener('change', applyInvitationFilters);

document
  .getElementById('reset-invitation-filters')
  .addEventListener('click', resetInvitationFilters);

document
  .getElementById('mark-notifications-read')
  .addEventListener('click', markAllNotificationsRead);

document
  .getElementById('select-all-friends')
  .addEventListener('change', (event) => toggleSelectAllFriends(event.target));

document.getElementById('bulk-invite-button').addEventListener('click', sendBulkInvitations);

if (selectedPostId) {
  document.getElementById('open-invite-button').classList.remove('hidden');
}

loadReceivedInvitations();

loadSentInvitations();

loadNotifications();

refreshInvitationBadge();
