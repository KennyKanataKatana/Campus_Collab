/* global currentUrl, fetchMethod */

document.addEventListener("DOMContentLoaded", function () {
  const forumList = document.getElementById("forumList");
  const createThreadForm = document.getElementById("createThreadForm");
  const warningCard = document.getElementById("warningCard");
  const warningText = document.getElementById("warningText");
  const locationFilterBar = document.getElementById("locationFilterBar");
  const forumSearchInput = document.getElementById("forumSearchInput");
  const forumSortSelect = document.getElementById("forumSortSelect");
  const yourPostsBtn = document.getElementById("yourPostsBtn");
  const friendsOnlyBtn = document.getElementById("friendsOnlyBtn");


  const token = localStorage.getItem("token");
  const currentUserId = localStorage.getItem("userId");


  let allThreads = [];
  let allLocations = [];
  let friendIds = [];
  let activeLocationFilter = "all";
  let activeSearchTerm = "";
  let activeSort = "recent";
  let showOnlyMine = false;
  let showFriendsOnly = false;


  function showWarning(message) {
    if (!warningCard || !warningText) return;
    warningCard.classList.remove("d-none");
    warningText.innerText = message;
  }


  function hideWarning() {
    if (!warningCard || !warningText) return;
    warningCard.classList.add("d-none");
    warningText.innerText = "";
  }


  function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString();
  }


  function isLikelyUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }


  function getYoutubeEmbedUrl(url) {
    try {
      const parsed = new URL(url);
      let videoId = null;


      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.slice(1);
      } else if (parsed.hostname.includes("youtube.com")) {
        videoId = parsed.searchParams.get("v");
      }


      if (!videoId) return null;


      return `https://www.youtube.com/embed/${videoId}`;
    } catch {
      return null;
    }
  }


  function renderMedia(thread) {
    let mediaHtml = "";


    if (thread.image_url && isLikelyUrl(thread.image_url)) {
      mediaHtml += `
        <div class="thread-media">
          <img src="${escapeHtml(thread.image_url)}" alt="Thread image" class="thread-image" loading="lazy" onerror="this.style.display='none'" />
        </div>
      `;
    }


    if (thread.video_url && isLikelyUrl(thread.video_url)) {
      const youtubeEmbed = getYoutubeEmbedUrl(thread.video_url);


      if (youtubeEmbed) {
        mediaHtml += `
          <div class="thread-media">
            <iframe class="thread-video" src="${escapeHtml(youtubeEmbed)}" frameborder="0" allowfullscreen loading="lazy"></iframe>
          </div>
        `;
      } else {
        mediaHtml += `
          <div class="thread-media">
            <video class="thread-video" src="${escapeHtml(thread.video_url)}" controls preload="metadata"></video>
          </div>
        `;
      }
    }


    return mediaHtml;
  }


  function renderVoteBar(thread) {
    const likeCount = Number(thread.like_count) || 0;
    const dislikeCount = Number(thread.dislike_count) || 0;
    const myVote = thread.my_vote || null;


    return `
      <div class="vote-bar" data-thread-id="${thread.id}">
        <button class="vote-btn like-btn ${myVote === "LIKE" ? "active" : ""}" data-thread-id="${thread.id}" data-vote-type="LIKE">
          👍 <span class="vote-count">${likeCount}</span>
        </button>
        <button class="vote-btn dislike-btn ${myVote === "DISLIKE" ? "active" : ""}" data-thread-id="${thread.id}" data-vote-type="DISLIKE">
          👎 <span class="vote-count">${dislikeCount}</span>
        </button>
      </div>
    `;
  }


  function renderLocationFilters() {
    if (!locationFilterBar) return;


    let html = `
      <div class="mini-pill active" data-location-id="all">All Locations</div>
    `;


    allLocations.forEach((location) => {
      html += `
        <div class="mini-pill" data-location-id="${location.id}">
          ${escapeHtml(location.location_name)}
        </div>
      `;
    });


    locationFilterBar.innerHTML = html;


    const filterButtons = locationFilterBar.querySelectorAll(".mini-pill");
    filterButtons.forEach((button) => {
      button.addEventListener("click", function () {
        activeLocationFilter = button.getAttribute("data-location-id");


        filterButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");


        applyFilters();
      });
    });
  }


  function applyFilters() {
    let filteredThreads = [...allThreads];


    if (activeLocationFilter !== "all") {
      filteredThreads = filteredThreads.filter(
        (thread) => String(thread.location_id) === String(activeLocationFilter)
      );
    }


    if (showOnlyMine) {
      filteredThreads = filteredThreads.filter(
        (thread) =>
          currentUserId &&
          (
            String(thread.user_id) === String(currentUserId) ||
            String(thread.student_id) === String(currentUserId)
          )
      );
    }


    if (showFriendsOnly) {
      filteredThreads = filteredThreads.filter((thread) =>
        friendIds.includes(String(thread.user_id))
      );
    }


    if (activeSearchTerm) {
      const searchLower = activeSearchTerm.toLowerCase();
      filteredThreads = filteredThreads.filter((thread) => {
        const title = (thread.title || "").toLowerCase();
        const content = (thread.content || "").toLowerCase();
        const locationName = (thread.location_name || "").toLowerCase();
        const student = (thread.student_name || "").toLowerCase();


        return (
          title.includes(searchLower) ||
          content.includes(searchLower) ||
          locationName.includes(searchLower) ||
          student.includes(searchLower)
        );
      });
    }


    renderThreads(filteredThreads);
  }


  function renderThreads(threads) {
    if (!forumList) return;


    forumList.innerHTML = "";


    if (!threads || threads.length === 0) {
      let emptyTitle = "No forum threads yet.";
      let emptySubtitle = "Be the first to start a discussion.";


      if (showFriendsOnly) {
        emptyTitle = "No posts from friends yet.";
        emptySubtitle = "Add some friends or wait for them to post.";
      } else if (showOnlyMine) {
        emptyTitle = "You haven't posted anything yet.";
        emptySubtitle = "Start a thread to see it here.";
      }


      forumList.innerHTML = `
        <div class="empty-state">
          <h3>${emptyTitle}</h3>
          <p>${emptySubtitle}</p>
        </div>
      `;
      return;
    }


    threads.forEach((thread) => {
      const threadCard = document.createElement("article");
      threadCard.className = "forum-card";
      threadCard.setAttribute("data-thread-id", thread.id);


      const isOwnPost =
        currentUserId &&
        (
          String(thread.user_id) === String(currentUserId) ||
          String(thread.student_id) === String(currentUserId)
        );


      threadCard.innerHTML = `
        <div class="card-top">
          <div class="meta-cluster">
            <span class="name-pill">@${escapeHtml(thread.student_name || "unknown")}</span>
            <span class="loc-pill">${escapeHtml(thread.location_name || "Unknown location")}</span>
          </div>
          <span class="post-time">${escapeHtml(formatDate(thread.created_at))}</span>
        </div>


        <div class="card-body">
          <h3 class="thread-title">${escapeHtml(thread.title)}</h3>
          <p class="thread-text">${escapeHtml(thread.content)}</p>
          ${renderMedia(thread)}
          ${renderVoteBar(thread)}
        </div>


        <div class="replies-section" id="replies-${thread.id}">
          <p class="reply-loading">Loading replies...</p>
        </div>


        <form class="reply-form" data-thread-id="${thread.id}">
          <textarea class="reply-input" placeholder="Write a reply..." required></textarea>
          <button type="submit" class="btn-submit-reply">Reply</button>
        </form>


        <div class="card-actions">
          ${isOwnPost ? `<button class="action-btn report delete-thread-btn" data-thread-id="${thread.id}">Delete</button>` : ``}
        </div>
      `;


      forumList.appendChild(threadCard);
      loadReplies(thread.id);
    });


    bindReplyForms();
    bindDeleteButtons();
    bindVoteButtons();
  }


  function renderReplies(threadId, replies) {
    const repliesContainer = document.getElementById(`replies-${threadId}`);
    if (!repliesContainer) return;


    repliesContainer.innerHTML = "";


    if (!replies || replies.length === 0) {
      repliesContainer.innerHTML = `<p class="reply-loading">No replies yet.</p>`;
      return;
    }


    replies.forEach((reply) => {
      const replyItem = document.createElement("div");
      replyItem.className = "reply-item";


      replyItem.innerHTML = `
        <div class="reply-meta">
          <span class="reply-user">@${escapeHtml(reply.student_name || "unknown")}</span>
          <span class="reply-date">${escapeHtml(formatDate(reply.created_at))}</span>
        </div>
        <p class="reply-content">${escapeHtml(reply.content)}</p>
      `;


      repliesContainer.appendChild(replyItem);
    });
  }


  function loadLocations() {
    const callback = (responseStatus, responseData) => {
      if (responseStatus === 200) {
        allLocations = responseData;
        renderLocationFilters();
      } else {
        showWarning("Failed to load locations.");
      }
    };


    fetchMethod(currentUrl + "/locations", callback, "GET");
  }


  function loadThreads() {
    const callback = (responseStatus, responseData) => {
      if (responseStatus === 200) {
        allThreads = responseData;
        applyFilters();
      } else {
        showWarning("Failed to load forum threads.");
      }
    };


    fetchMethod(currentUrl + `/forum?sort=${activeSort}`, callback, "GET", null, token);
  }


  function loadFriendIds() {
    if (!currentUserId || !token) return;


    const callback = (responseStatus, responseData) => {
      if (responseStatus === 200 && Array.isArray(responseData)) {
        friendIds = responseData.map((friendRow) => {
          const isSender = String(friendRow.sender_id) === String(currentUserId);
          return isSender ? String(friendRow.receiver_id) : String(friendRow.sender_id);
        });
      } else {
        friendIds = [];
      }
    };


    fetchMethod(currentUrl + `/friends/list/${currentUserId}`, callback, "GET", null, token);
  }


  function loadReplies(threadId) {
    const callback = (responseStatus, responseData) => {
      if (responseStatus === 200) {
        renderReplies(threadId, responseData);
      } else {
        const repliesContainer = document.getElementById(`replies-${threadId}`);
        if (repliesContainer) {
          repliesContainer.innerHTML = `<p class="reply-loading">Failed to load replies.</p>`;
        }
      }
    };


    fetchMethod(currentUrl + `/forum/${threadId}/replies`, callback, "GET", null, token);
  }


  function bindReplyForms() {
    const replyForms = document.querySelectorAll(".reply-form");


    replyForms.forEach((form) => {
      form.addEventListener("submit", function (event) {
        event.preventDefault();


        hideWarning();


        if (!token) {
          showWarning("You need to log in first to reply.");
          return;
        }


        const threadId = form.getAttribute("data-thread-id");
        const replyInput = form.querySelector(".reply-input");
        const content = replyInput.value.trim();


        if (!content) {
          showWarning("Reply cannot be empty.");
          return;
        }


        const data = {
          content: content
        };


        const callback = (responseStatus, responseData) => {
          if (responseStatus === 200 || responseStatus === 201) {
            replyInput.value = "";
            loadReplies(threadId);
          } else {
            showWarning(
              (responseData && responseData.error) ||
              (responseData && responseData.message) ||
              "Failed to post reply."
            );
          }
        };


        fetchMethod(
          currentUrl + `/forum/${threadId}/replies`,
          callback,
          "POST",
          data,
          token
        );
      });
    });
  }


  function bindDeleteButtons() {
    const deleteButtons = document.querySelectorAll(".delete-thread-btn");


    deleteButtons.forEach((button) => {
      button.addEventListener("click", function () {
        hideWarning();


        if (!token) {
          showWarning("You need to log in first to delete a thread.");
          return;
        }


        const threadId = button.getAttribute("data-thread-id");


        if (!confirm("Are you sure you want to delete this thread?")) {
          return;
        }


        const callback = (responseStatus, responseData) => {
          if (responseStatus === 200) {
            loadThreads();
          } else {
            showWarning(
              (responseData && responseData.error) ||
              (responseData && responseData.message) ||
              "Failed to delete thread."
            );
          }
        };


        fetchMethod(currentUrl + `/forum/${threadId}`, callback, "DELETE", null, token);
      });
    });
  }


  function bindVoteButtons() {
    const voteButtons = document.querySelectorAll(".vote-btn");


    voteButtons.forEach((button) => {
      button.addEventListener("click", function () {
        hideWarning();


        if (!token) {
          showWarning("You need to log in first to vote.");
          return;
        }


        const threadId = button.getAttribute("data-thread-id");
        const voteType = button.getAttribute("data-vote-type");
        const isAlreadyActive = button.classList.contains("active");


        const callback = (responseStatus, responseData) => {
          if (responseStatus === 200) {
            loadThreads();
          } else {
            showWarning(
              (responseData && responseData.error) ||
              (responseData && responseData.message) ||
              "Failed to register vote."
            );
          }
        };


        if (isAlreadyActive) {
          fetchMethod(currentUrl + `/forum/${threadId}/vote`, callback, "DELETE", null, token);
        } else {
          fetchMethod(currentUrl + `/forum/${threadId}/vote`, callback, "POST", { vote_type: voteType }, token);
        }
      });
    });
  }


  if (forumSearchInput) {
    forumSearchInput.addEventListener("input", function () {
      activeSearchTerm = forumSearchInput.value.trim();
      applyFilters();
    });
  }


  if (forumSortSelect) {
    forumSortSelect.addEventListener("change", function () {
      activeSort = forumSortSelect.value;
      loadThreads();
    });
  }


  if (yourPostsBtn) {
    yourPostsBtn.addEventListener("click", function () {
      hideWarning();


      if (!currentUserId) {
        showWarning("You need to log in first to view your posts.");
        return;
      }


      showOnlyMine = !showOnlyMine;
      yourPostsBtn.classList.toggle("active", showOnlyMine);
      yourPostsBtn.innerText = showOnlyMine ? "Show All Posts" : "Your Posts";
      applyFilters();
    });
  }


  if (friendsOnlyBtn) {
    friendsOnlyBtn.addEventListener("click", function () {
      hideWarning();


      if (!currentUserId || !token) {
        showWarning("You need to log in first to view friends' posts.");
        return;
      }


      showFriendsOnly = !showFriendsOnly;
      friendsOnlyBtn.classList.toggle("active", showFriendsOnly);
      friendsOnlyBtn.innerText = showFriendsOnly ? "Show All Posts" : "Friends Only";
      applyFilters();
    });
  }


  if (createThreadForm) {
    createThreadForm.addEventListener("submit", function (event) {
      event.preventDefault();


      hideWarning();


      if (!token) {
        showWarning("You need to log in first to create a thread.");
        return;
      }


      const title = document.getElementById("threadTitle").value.trim();
      const locationId = document.getElementById("threadLocation").value;
      const content = document.getElementById("threadMsg").value.trim();
      const imageUrl = document.getElementById("threadImageUrl").value.trim();
      const videoUrl = document.getElementById("threadVideoUrl").value.trim();


      if (!title || !locationId || !content) {
        showWarning("Please fill in all thread fields.");
        return;
      }


      if (imageUrl && !isLikelyUrl(imageUrl)) {
        showWarning("Image link doesn't look like a valid URL.");
        return;
      }


      if (videoUrl && !isLikelyUrl(videoUrl)) {
        showWarning("Video link doesn't look like a valid URL.");
        return;
      }


      const data = {
        location_id: Number(locationId),
        title: title,
        content: content,
        image_url: imageUrl || null,
        video_url: videoUrl || null
      };


      const callback = (responseStatus, responseData) => {
        if (responseStatus === 200 || responseStatus === 201) {
          createThreadForm.reset();
          loadThreads();
        } else {
          showWarning(
            (responseData && responseData.error) ||
            (responseData && responseData.message) ||
            "Failed to create thread."
          );
        }
      };


      fetchMethod(currentUrl + "/forum", callback, "POST", data, token);
    });
  }


  hideWarning();
  loadLocations();
  loadFriendIds();
  loadThreads();
});