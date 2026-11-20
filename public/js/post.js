document.addEventListener("DOMContentLoaded", function () {
  const postForm = document.getElementById("postForm");
  const warningCard = document.getElementById("modalWarning");
  const warningText = document.getElementById("modalWarningText");
  const postsGrid = document.getElementById("postsGrid");
  const postCount = document.getElementById("postCount");
  const loginBanner = document.getElementById("loginBanner");
  const btnNewPost = document.getElementById("btnNewPost");
  const titleInput = document.getElementById("postTitle");
  const descInput = document.getElementById("postDesc");
  const titleCount = document.getElementById("titleCount");
  const descCount = document.getElementById("descCount");
  const categoryInput = document.getElementById("categoryInput");
  const hangoutAtInput = document.getElementById("hangoutAt");
  const maxParticipantsInput =
    document.getElementById("maxParticipants");
  const maxParticipantsValue =
    document.getElementById("maxParticipantsValue");

  const token = localStorage.getItem("token");

  const userId =
    localStorage.getItem("userId") ||
    localStorage.getItem("user_id");

  const currentUrl = window.location.origin;

  let allPosts = [];
  let activeFilter = "all";
  let acceptedPostId = null;

  const commentsCache = {};

  if (!postsGrid) {
    console.error(
      'post.js: Missing element with id="postsGrid".'
    );
    return;
  }

  function fetchMethod(
    url,
    callback,
    method = "GET",
    data = null,
    tokenValue = null
  ) {
    const config = {
      method: method,
      headers: {}
    };

    if (data !== null) {
      config.headers["Content-Type"] =
        "application/json";

      config.body = JSON.stringify(data);
    }

    if (tokenValue) {
      config.headers.Authorization =
        `Bearer ${tokenValue}`;
    }

    fetch(url, config)
      .then(function (response) {
        return response.text().then(
          function (text) {
            let responseData = null;

            if (text) {
              try {
                responseData =
                  JSON.parse(text);
              } catch (error) {
                responseData = text;
              }
            }

            callback(
              response.status,
              responseData
            );
          }
        );
      })
      .catch(function (error) {
        console.error(
          "Fetch error:",
          error
        );

        callback(500, {
          error:
            "Unable to connect to the server."
        });
      });
  }

  function escHtml(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "Recently";
    }

    const date =
      new Date(dateString);

    if (
      Number.isNaN(date.getTime())
    ) {
      return "Recently";
    }

    return date.toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );
  }

  function formatDateTime(
    dateString
  ) {
    if (!dateString) {
      return "Not set";
    }

    const date =
      new Date(dateString);

    if (
      Number.isNaN(date.getTime())
    ) {
      return "Not set";
    }

    return date.toLocaleString(
      "en-SG",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    );
  }

  function mapLocationToCategory(
    locationId
  ) {
    const map = {
      1: "SP Library",
      2: "SP Food Court 6",
      3: "SP Food Court 5",
      4: "SP Food Court 4",
      5: "SP Hilltop Heaven"
    };

    return (
      map[Number(locationId)] ||
      "Unknown location"
    );
  }

  function mapCategoryToLocation(
    category
  ) {
    const map = {
      "SP Library": 1,
      "SP Food Court 6": 2,
      "SP Food Court 5": 3,
      "SP Food Court 4": 4,
      "SP Hilltop Heaven": 5
    };

    return map[category] || null;
  }

  function isHost(post) {
    return (
      String(post.userId) ===
      String(userId)
    );
  }

  function showWarning(message) {
    if (
      !warningCard ||
      !warningText
    ) {
      return;
    }

    warningCard.classList.add(
      "visible"
    );

    warningText.textContent =
      message;
  }

  function hideWarning() {
    if (
      !warningCard ||
      !warningText
    ) {
      return;
    }

    warningCard.classList.remove(
      "visible"
    );

    warningText.textContent = "";
  }

  function applyAuthState() {
    if (loginBanner) {
      loginBanner.style.display =
        token ? "none" : "flex";
    }

    if (btnNewPost) {
      btnNewPost.style.display =
        token ? "flex" : "none";
    }
  }

  function renderComments(postId) {
    const comments =
      commentsCache[postId] || [];

    if (comments.length === 0) {
      return `
        <div class="comment-empty">
          No comments yet. Be the first!
        </div>
      `;
    }

    return comments
      .map(function (comment) {
        const author =
          comment.student_name ||
          comment.studentname ||
          comment.author ||
          `user${
            comment.user_id ||
            comment.userid ||
            ""
          }`;

        return `
          <div class="comment-item">
            <div class="comment-meta">
              <span class="comment-author">
                ${escHtml(author)}
              </span>

              <span class="comment-date">
                ${escHtml(
                  formatDate(
                    comment.created_at ||
                    comment.createdat
                  )
                )}
              </span>
            </div>

            <p class="comment-text">
              ${escHtml(comment.content)}
            </p>

            ${
              token &&
              String(
                comment.user_id ||
                comment.userid
              ) === String(userId)
                ? `
                  <button
                    type="button"
                    class="btn-delete-comment"
                    data-comment-id="${comment.id}"
                    data-post-id="${postId}"
                  >
                    Delete
                  </button>
                `
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  function loadComments(postId) {
    fetchMethod(
      `${currentUrl}/comments/post/${postId}`,
      function (
        responseStatus,
        responseData
      ) {
        const commentsList =
          document.getElementById(
            `comments-list-${postId}`
          );

        if (!commentsList) {
          return;
        }

        if (
          responseStatus !== 200 ||
          !Array.isArray(responseData)
        ) {
          commentsList.innerHTML = `
            <div class="comment-empty">
              Failed to load comments.
            </div>
          `;

          return;
        }

        commentsCache[postId] =
          responseData;

        commentsList.innerHTML =
          renderComments(postId);
      },
      "GET"
    );
  }

  function getActionButton(post) {
    const accepted =
      String(acceptedPostId) ===
      String(post.id);

    const full =
      Number(
        post.currentParticipants
      ) >=
      Number(post.maxParticipants);

    if (isHost(post)) {
      return `
        <button
          type="button"
          class="btn-card-action invite"
          onclick="openInvitePage(${post.id})"
        >
          Invite Friends
        </button>
      `;
    }

    if (accepted) {
      return `
        <button
          type="button"
          class="btn-card-action accept accepted"
          onclick="handleAccept(${post.id})"
        >
          Unaccept
        </button>
      `;
    }

    if (full) {
      return `
        <button
          type="button"
          class="btn-card-action accept full"
          disabled
        >
          Full
        </button>
      `;
    }

    return `
      <button
        type="button"
        class="btn-card-action accept"
        onclick="handleAccept(${post.id})"
      >
        Accept
      </button>
    `;
  }

  function renderPosts(posts) {
    if (postCount) {
      postCount.textContent =
        posts.length === 0
          ? "No posts yet"
          : `${posts.length} post${
              posts.length === 1
                ? ""
                : "s"
            }`;
    }

    if (posts.length === 0) {
      postsGrid.innerHTML = `
        <div class="empty-state">
          <h3>No posts yet!</h3>
        </div>
      `;

      return;
    }

    postsGrid.innerHTML =
      posts
        .map(function (
          post,
          index
        ) {
          const current =
            Number(
              post.currentParticipants ||
              1
            );

          const maximum =
            Number(
              post.maxParticipants ||
              5
            );

          const remaining =
            Math.max(
              maximum - current,
              0
            );

          const percentage =
            Math.min(
              (
                current /
                maximum
              ) * 100,
              100
            );

          const full =
            current >= maximum;

          return `
            <div
              class="post-card"
              data-post-id="${post.id}"
              data-cat="${escHtml(
                post.category
              )}"
              style="animation-delay:${
                index * 0.06
              }s"
            >
              <div class="card-top">
                <span class="cat-badge">
                  ${escHtml(
                    post.category
                  )}
                </span>

                <span class="card-author">
                  ${escHtml(
                    post.author
                  )}
                </span>
              </div>

              <h3 class="card-title">
                ${escHtml(post.title)}
              </h3>

              <p class="card-desc">
                ${escHtml(
                  post.description
                )}
              </p>

              <div
                class="participant-summary ${
                  full ? "full" : ""
                }"
              >
                <div
                  class="participant-summary-top"
                >
                  <span
                    class="participant-count-text"
                  >
                    ${current} /
                    ${maximum}
                    people joined
                  </span>

                  <span
                    class="participant-spots-text"
                  >
                    ${
                      full
                        ? "Hangout full"
                        : `${remaining} spot${
                            remaining === 1
                              ? ""
                              : "s"
                          } left`
                    }
                  </span>
                </div>

                <div
                  class="participant-progress-track"
                >
                  <div
                    class="participant-progress-fill"
                    style="width:${percentage}%"
                  ></div>
                </div>
              </div>

              <div class="card-footer-row">
                <span class="card-date">
                  Posted
                  ${escHtml(post.date)}
                  · Hangout
                  ${escHtml(
                    post.hangoutAt
                  )}
                </span>

                <div
                  style="
                    display:flex;
                    gap:8px;
                    align-items:center;
                    flex-wrap:wrap;
                  "
                >
                  ${getActionButton(post)}

                  <button
                    type="button"
                    class="btn-card-action comment-toggle"
                    data-post-id="${post.id}"
                  >
                    Comments
                  </button>

                  <button
                    type="button"
                    class="
                      btn-card-action
                      bookmark-btn
                      ${
                        post.bookmarked
                          ? "bookmarked"
                          : ""
                      }
                    "
                    data-post-id="${post.id}"
                    ${
                      post.bookmarked
                        ? "disabled"
                        : ""
                    }
                  >
                    ${
                      post.bookmarked
                        ? "Bookmarked"
                        : "Bookmark"
                    }
                  </button>

                  ${
                    isHost(post)
                      ? `
                        <button
                          type="button"
                          class="btn-card-action delete"
                          onclick="handleDelete(${post.id})"
                        >
                          Delete
                        </button>
                      `
                      : ""
                  }
                </div>
              </div>

              <div
                class="comments-panel"
                id="comments-panel-${post.id}"
              >
                <div
                  class="comments-list"
                  id="comments-list-${post.id}"
                >
                  <div class="comment-empty">
                    Comments hidden.
                  </div>
                </div>

                <form
                  class="comment-form"
                  data-post-id="${post.id}"
                >
                  <textarea
                    class="comment-input"
                    name="content"
                    placeholder="${
                      token
                        ? "Write a comment..."
                        : "Log in to write a comment"
                    }"
                    ${
                      token
                        ? ""
                        : "disabled"
                    }
                  ></textarea>

                  <button
                    type="submit"
                    class="btn-comment-submit"
                    ${
                      token
                        ? ""
                        : "disabled"
                    }
                  >
                    Add Comment
                  </button>
                </form>
              </div>
            </div>
          `;
        })
        .join("");
  }

  function showFilteredPosts() {
    if (activeFilter === "all") {
      renderPosts(allPosts);
      return;
    }

    renderPosts(
      allPosts.filter(
        function (post) {
          return (
            post.category ===
            activeFilter
          );
        }
      )
    );
  }

  function loadAcceptedPost() {
    if (!userId) {
      acceptedPostId = null;
      showFilteredPosts();
      return;
    }

    fetchMethod(
      `${currentUrl}/accept/user/${userId}`,
      function (
        responseStatus,
        responseData
      ) {
        if (
          responseStatus === 200 &&
          Array.isArray(
            responseData
          ) &&
          responseData.length > 0
        ) {
          acceptedPostId =
            responseData[0].post_id;
        } else {
          acceptedPostId = null;
        }

        showFilteredPosts();
      },
      "GET",
      null,
      token
    );
  }

  function loadBookmarks() {
  if (!token) {
    return;
  }

  fetchMethod(
    `${currentUrl}/bookmark`,
    function (
      responseStatus,
      responseData
    ) {
      if (
        responseStatus !== 200 ||
        !Array.isArray(responseData)
      ) {
        return;
      }

      const bookmarkedIds =
        responseData.map(
          function (bookmark) {
            return String(
              bookmark.post_id
            );
          }
        );

      allPosts.forEach(
        function (post) {
          post.bookmarked =
            bookmarkedIds.includes(
              String(post.id)
            );
        }
      );

      showFilteredPosts();
    },
    "GET",
    null,
    token
  );
}

  function loadPosts() {
    if (postCount) {
      postCount.textContent =
        "Loading posts...";
    }

    fetchMethod(
      `${currentUrl}/posts`,
      function (
        responseStatus,
        responseData
      ) {
        console.log(
          "GET /posts:",
          responseStatus,
          responseData
        );

        if (
          responseStatus !== 200 ||
          !Array.isArray(responseData)
        ) {
          postsGrid.innerHTML = `
            <div class="empty-state">
              <h3>
                Failed to load posts.
              </h3>

              <p>
                Check that your backend
                server is running.
              </p>
            </div>
          `;

          if (postCount) {
            postCount.textContent =
              "Unable to load posts";
          }

          return;
        }

        allPosts =
          responseData.map(
            function (post) {
              return {
                id: post.id,

                title:
                  post.title,

                description:
                  post.description,

                category:
                  mapLocationToCategory(
                    post.location_id ||
                    post.locationid
                  ),

                author:
                  post.student_name ||
                  post.studentname ||
                  `user${
                    post.user_id ||
                    post.userid ||
                    ""
                  }`,

                date:
                  formatDate(
                    post.created_at ||
                    post.createdat
                  ),

                hangoutAt:
                  formatDateTime(
                    post.hangout_at ||
                    post.hangoutAt
                  ),

                userId:
                  post.user_id ||
                  post.userid,

                currentParticipants:
                  Number(
                    post.current_participants ||
                    post.currentParticipants ||
                    1
                  ),

                maxParticipants:
                  Number(
                    post.max_participants ||
                    post.maxParticipants ||
                    5
                  ),

                bookmarked: false
              };
            }
          );

        showFilteredPosts();
        loadBookmarks();
        loadAcceptedPost();
      },
      "GET",
      null,
      token
    );
  }

  window.filterPosts =
    function (
      category,
      button
    ) {
      activeFilter = category;

      document
        .querySelectorAll(
          ".filter-btn"
        )
        .forEach(
          function (
            filterButton
          ) {
            filterButton
              .classList
              .remove("active");
          }
        );

      if (button) {
        button.classList.add(
          "active"
        );
      }

      showFilteredPosts();
    };

  window.openInvitePage =
    function (postId) {
      if (!token) {
        alert(
          "Please log in to invite friends."
        );

        window.location.href =
          "login.html";

        return;
      }

      window.location.href =
        `invitations.html?postId=${
          encodeURIComponent(
            postId
          )
        }`;
    };

  window.handleAccept =
    function (postId) {
      if (!token) {
        alert(
          "Please log in to accept a post!"
        );

        return;
      }

      const post =
        allPosts.find(
          function (item) {
            return (
              String(item.id) ===
              String(postId)
            );
          }
        );

      if (!post) {
        alert("Post not found.");
        return;
      }

      const alreadyAccepted =
        String(
          acceptedPostId
        ) === String(postId);

      if (alreadyAccepted) {
        const confirmed =
          confirm(
            "Are you sure you want to leave this hangout?"
          );

        if (!confirmed) {
          return;
        }

        fetchMethod(
          `${currentUrl}/accept/${postId}`,
          function (
            responseStatus,
            responseData
          ) {
            if (
              responseStatus !== 200
            ) {
              alert(
                (
                  responseData &&
                  (
                    responseData.error ||
                    responseData.message
                  )
                ) ||
                "Failed to leave the hangout."
              );

              return;
            }

            acceptedPostId = null;

            post.currentParticipants =
              Number(
                (
                  responseData &&
                  responseData
                    .current_participants
                ) ||
                Math.max(
                  Number(
                    post.currentParticipants
                  ) - 1,
                  1
                )
              );

            showFilteredPosts();
          },
          "DELETE",
          null,
          token
        );

        return;
      }

      if (
        acceptedPostId !== null
      ) {
        alert(
          "You already joined another hangout. Unaccept it before joining this one."
        );

        return;
      }

      if (
        Number(
          post.currentParticipants
        ) >=
        Number(
          post.maxParticipants
        )
      ) {
        alert(
          "Sorry, this hangout is already full."
        );

        return;
      }

      const confirmed =
        confirm(
          "Are you sure you want to join this hangout?"
        );

      if (!confirmed) {
        return;
      }

      fetchMethod(
        `${currentUrl}/accept/${postId}`,
        function (
          responseStatus,
          responseData
        ) {
          if (
            responseStatus !== 200 &&
            responseStatus !== 201
          ) {
            alert(
              (
                responseData &&
                (
                  responseData.error ||
                  responseData.message
                )
              ) ||
              "Failed to accept post."
            );

            return;
          }

          acceptedPostId =
            postId;

          post.currentParticipants =
            Number(
              (
                responseData &&
                responseData
                  .current_participants
              ) ||
              Number(
                post.currentParticipants
              ) + 1
            );

          showFilteredPosts();
        },
        "POST",
        null,
        token
      );
    };

  window.openModal =
    function () {
      if (!token) {
        window.location.href =
          "login.html";

        return;
      }

      const modal =
        document.getElementById(
          "postModal"
        );

      if (modal) {
        modal.classList.add(
          "open"
        );
      }

      document.body.style.overflow =
        "hidden";
    };

  window.closeModal =
    function () {
      const modal =
        document.getElementById(
          "postModal"
        );

      if (modal) {
        modal.classList.remove(
          "open"
        );
      }

      document.body.style.overflow =
        "";

      if (postForm) {
        postForm.reset();
      }

      if (titleCount) {
        titleCount.textContent =
          "0";
      }

      if (descCount) {
        descCount.textContent =
          "0";
      }

      if (categoryInput) {
        categoryInput.value =
          "";
      }

      if (
        maxParticipantsInput
      ) {
        maxParticipantsInput.value =
          "5";
      }

      if (
        maxParticipantsValue
      ) {
        maxParticipantsValue.textContent =
          "5";
      }

      document
        .querySelectorAll(
          ".cat-pick-btn"
        )
        .forEach(
          function (button) {
            button.classList.remove(
              "selected"
            );
          }
        );

      hideWarning();
    };

  window.handleOverlayClick =
    function (event) {
      const modal =
        document.getElementById(
          "postModal"
        );

      if (
        event.target === modal
      ) {
        window.closeModal();
      }
    };

  window.selectCat =
    function (button) {
      document
        .querySelectorAll(
          ".cat-pick-btn"
        )
        .forEach(
          function (
            categoryButton
          ) {
            categoryButton
              .classList
              .remove(
                "selected"
              );
          }
        );

      button.classList.add(
        "selected"
      );

      if (categoryInput) {
        categoryInput.value =
          button.dataset.cat;
      }
    };

  window.handleDelete =
    function (postId) {
      const confirmed =
        confirm(
          "Delete this post?"
        );

      if (!confirmed) {
        return;
      }

      fetchMethod(
        `${currentUrl}/posts/${postId}`,
        function (
          responseStatus,
          responseData
        ) {
          if (
            responseStatus !== 200
          ) {
            alert(
              (
                responseData &&
                (
                  responseData.error ||
                  responseData.message
                )
              ) ||
              "Failed to delete post."
            );

            return;
          }

          allPosts =
            allPosts.filter(
              function (post) {
                return (
                  String(
                    post.id
                  ) !==
                  String(postId)
                );
              }
            );

          delete commentsCache[
            postId
          ];

          if (
            String(
              acceptedPostId
            ) ===
            String(postId)
          ) {
            acceptedPostId =
              null;
          }

          showFilteredPosts();
        },
        "DELETE",
        null,
        token
      );
    };

  postsGrid.addEventListener(
    "click",
    function (event) {
      const commentButton =
        event.target.closest(
          ".comment-toggle"
        );

      if (!commentButton) {
        return;
      }

      const postId =
        commentButton.dataset
          .postId;

      const panel =
        document.getElementById(
          `comments-panel-${postId}`
        );

      if (!panel) {
        return;
      }

      panel.classList.toggle(
        "open"
      );

      if (
        panel.classList.contains(
          "open"
        )
      ) {
        loadComments(postId);
      }
    }
  );

  postsGrid.addEventListener(
    "click",
    function (event) {
      const bookmarkButton =
        event.target.closest(
          ".bookmark-btn"
        );

      if (!bookmarkButton) {
        return;
      }

      if (!token) {
        alert(
          "Please log in to bookmark!"
        );

        return;
      }

      const postId =
        bookmarkButton.dataset
          .postId;

      bookmarkButton.disabled =
        true;

      bookmarkButton.textContent =
        "Saving...";

      fetchMethod(
        `${currentUrl}/posts/${postId}`,
        function (
          responseStatus,
          responseData
        ) {
          if (
            responseStatus !== 200 &&
            responseStatus !== 201
          ) {
            bookmarkButton.disabled =
              false;

            bookmarkButton.textContent =
              "Bookmark";

            alert(
              (
                responseData &&
                (
                  responseData.error ||
                  responseData.message
                )
              ) ||
              "Failed to bookmark."
            );

            return;
          }

          const post =
            allPosts.find(
              function (item) {
                return (
                  String(
                    item.id
                  ) ===
                  String(postId)
                );
              }
            );

          if (post) {
            post.bookmarked = true;
          }

          bookmarkButton.textContent =
            "Bookmarked";

          bookmarkButton.classList.add(
            "bookmarked"
          );
        },
        "POST",
        null,
        token
      );
    }
  );

  postsGrid.addEventListener(
    "submit",
    function (event) {
      const commentForm =
        event.target.closest(
          ".comment-form"
        );

      if (!commentForm) {
        return;
      }

      event.preventDefault();

      if (!token) {
        alert(
          "Please log in to comment."
        );

        return;
      }

      const postId =
        commentForm.dataset
          .postId;

      const textarea =
        commentForm.querySelector(
          ".comment-input"
        );

      const submitButton =
        commentForm.querySelector(
          ".btn-comment-submit"
        );

      const content =
        textarea
          ? textarea.value.trim()
          : "";

      if (!content) {
        alert(
          "Comment cannot be empty."
        );

        return;
      }

      if (submitButton) {
        submitButton.disabled =
          true;

        submitButton.textContent =
          "Adding...";
      }

      fetchMethod(
        `${currentUrl}/comments/post/${postId}`,
        function (
          responseStatus,
          responseData
        ) {
          if (submitButton) {
            submitButton.disabled =
              false;

            submitButton.textContent =
              "Add Comment";
          }

          if (
            responseStatus !== 200 &&
            responseStatus !== 201
          ) {
            alert(
              (
                responseData &&
                (
                  responseData.error ||
                  responseData.message
                )
              ) ||
              "Failed to add comment."
            );

            return;
          }

          if (textarea) {
            textarea.value = "";
          }

          loadComments(postId);
        },
        "POST",
        {
          content:
            content
        },
        token
      );
    }
  );

  postsGrid.addEventListener(
    "click",
    function (event) {
      const deleteButton =
        event.target.closest(
          ".btn-delete-comment"
        );

      if (!deleteButton) {
        return;
      }

      if (!token) {
        alert(
          "Please log in to delete a comment."
        );

        return;
      }

      const commentId =
        deleteButton.dataset
          .commentId;

      const postId =
        deleteButton.dataset
          .postId;

      const confirmed =
        confirm(
          "Are you sure you want to delete this comment?"
        );

      if (!confirmed) {
        return;
      }

      deleteButton.disabled =
        true;

      deleteButton.textContent =
        "Deleting...";

      fetchMethod(
        `${currentUrl}/comments/${commentId}`,
        function (
          responseStatus,
          responseData
        ) {
          if (
            responseStatus !== 200
          ) {
            deleteButton.disabled =
              false;

            deleteButton.textContent =
              "Delete";

            alert(
              (
                responseData &&
                (
                  responseData.error ||
                  responseData.message
                )
              ) ||
              "Failed to delete comment."
            );

            return;
          }

          loadComments(postId);
        },
        "DELETE",
        null,
        token
      );
    }
  );

  if (
    titleInput &&
    titleCount
  ) {
    titleInput.addEventListener(
      "input",
      function () {
        titleCount.textContent =
          String(
            titleInput.value.length
          );
      }
    );
  }

  if (
    descInput &&
    descCount
  ) {
    descInput.addEventListener(
      "input",
      function () {
        descCount.textContent =
          String(
            descInput.value.length
          );
      }
    );
  }

  if (
    maxParticipantsInput &&
    maxParticipantsValue
  ) {
    maxParticipantsValue.textContent =
      maxParticipantsInput.value;

    maxParticipantsInput
      .addEventListener(
        "input",
        function () {
          maxParticipantsValue
            .textContent =
            maxParticipantsInput
              .value;
        }
      );
  }

  if (postForm) {
    postForm.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();
        hideWarning();

        if (
          !token ||
          !userId
        ) {
          showWarning(
            "Please log in before creating a post."
          );

          return;
        }

        const title =
          titleInput
            ? titleInput.value.trim()
            : "";

        const description =
          descInput
            ? descInput.value.trim()
            : "";

        const category =
          categoryInput
            ? categoryInput.value
            : "";

        const hangoutAt =
          hangoutAtInput
            ? hangoutAtInput.value
            : "";

        const locationId =
          mapCategoryToLocation(
            category
          );

        const maxParticipants =
          Number(
            maxParticipantsInput
              ? maxParticipantsInput.value
              : 5
          );

        const submitButton =
          postForm.querySelector(
            'button[type="submit"]'
          );

        const originalButtonText =
          submitButton
            ? submitButton.textContent
            : "Create Post";

        if (!title) {
          showWarning(
            "Please enter a title."
          );

          return;
        }

        if (
          !category ||
          !locationId
        ) {
          showWarning(
            "Please select a location."
          );

          return;
        }

        if (!description) {
          showWarning(
            "Please enter a description."
          );

          return;
        }

        if (
          !hangoutAt ||
          new Date(hangoutAt) <=
            new Date()
        ) {
          showWarning(
            "Please select a future hangout date and time."
          );

          return;
        }

        if (
          !Number.isInteger(
            maxParticipants
          ) ||
          maxParticipants < 1 ||
          maxParticipants > 100
        ) {
          showWarning(
            "Participants must be between 1 and 100."
          );

          return;
        }

        if (submitButton) {
          submitButton.disabled =
            true;

          submitButton.textContent =
            "Creating...";
        }

        fetchMethod(
          `${currentUrl}/posts`,
          function (
            responseStatus,
            responseData
          ) {
            if (submitButton) {
              submitButton.disabled =
                false;

              submitButton.textContent =
                originalButtonText;
            }

            if (
              responseStatus !== 200 &&
              responseStatus !== 201
            ) {
              showWarning(
                (
                  responseData &&
                  (
                    responseData.error ||
                    responseData.message
                  )
                ) ||
                "Failed to create post."
              );

              return;
            }

            window.closeModal();
            loadPosts();
          },
          "POST",
          {
            user_id:
              Number(userId),

            location_id:
              Number(locationId),

            title:
              title,

            description:
              description,

            hangout_at:
              new Date(
                hangoutAt
              ).toISOString(),

            max_participants:
              maxParticipants
          },
          token
        );
      }
    );
  }

  document.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key ===
        "Escape"
      ) {
        window.closeModal();
      }
    }
  );

//////////////////////////////////////////////////////
// REFRESH PARTICIPANT COUNTS FOR ALL USERS
//////////////////////////////////////////////////////

function refreshParticipantCounts() {
  fetchMethod(
    `${currentUrl}/posts`,
    function (
      responseStatus,
      responseData
    ) {
      if (
        responseStatus !== 200 ||
        !Array.isArray(responseData)
      ) {
        return;
      }

      let countChanged = false;

      responseData.forEach(
        function (serverPost) {
          const localPost =
            allPosts.find(
              function (post) {
                return (
                  String(post.id) ===
                  String(serverPost.id)
                );
              }
            );

          if (!localPost) {
            return;
          }

          const newCurrentCount =
            Number(
              serverPost.current_participants ||
              serverPost.currentParticipants ||
              1
            );

          const newMaximumCount =
            Number(
              serverPost.max_participants ||
              serverPost.maxParticipants ||
              5
            );

          if (
            localPost.currentParticipants !==
              newCurrentCount ||
            localPost.maxParticipants !==
              newMaximumCount
          ) {
            localPost.currentParticipants =
              newCurrentCount;

            localPost.maxParticipants =
              newMaximumCount;

            countChanged = true;
          }
        }
      );

      if (countChanged) {
        showFilteredPosts();
      }
    },
    "GET",
    null,
    token
  );
}


//////////////////////////////////////////////////////
// START PAGE
//////////////////////////////////////////////////////

applyAuthState();
loadPosts();


//////////////////////////////////////////////////////
// CHECK FOR UPDATED COUNTS EVERY 2 SECONDS
//////////////////////////////////////////////////////

const participantRefreshTimer =
  setInterval(
    refreshParticipantCounts,
    2000
  );


//////////////////////////////////////////////////////
// REFRESH WHEN USER RETURNS TO THE TAB
//////////////////////////////////////////////////////

document.addEventListener(
  "visibilitychange",
  function () {
    if (!document.hidden) {
      refreshParticipantCounts();
      loadAcceptedPost();
    }
  }
);


//////////////////////////////////////////////////////
// STOP TIMER WHEN PAGE CLOSES
//////////////////////////////////////////////////////

window.addEventListener(
  "beforeunload",
  function () {
    clearInterval(
      participantRefreshTimer
    );
  }
);

});