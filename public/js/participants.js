document.addEventListener("DOMContentLoaded", function () {
  //////////////////////////////////////////////////////
  // ELEMENTS
  //////////////////////////////////////////////////////

  const postsGrid =
    document.getElementById("postsGrid");

  const participantsModal =
    document.getElementById("participantsModal");

  const participantsModalTitle =
    document.getElementById(
      "participantsModalTitle"
    );

  const participantsModalCount =
    document.getElementById(
      "participantsModalCount"
    );

  const participantsModalSpots =
    document.getElementById(
      "participantsModalSpots"
    );

  const participantsModalProgress =
    document.getElementById(
      "participantsModalProgress"
    );

  const participantsList =
    document.getElementById(
      "participantsList"
    );

  const closeParticipantsModalButton =
    document.getElementById(
      "closeParticipantsModalButton"
    );

  if (!postsGrid) {
    return;
  }

  //////////////////////////////////////////////////////
  // USER DATA
  //////////////////////////////////////////////////////

  const currentUrl =
    "http://localhost:3000";

  const token =
    localStorage.getItem("token");

  const userId =
    localStorage.getItem("userId");

  //////////////////////////////////////////////////////
  // PARTICIPANT STATE
  //////////////////////////////////////////////////////

  let postsById = {};
  let acceptedPostId = null;
  let openedParticipantsPostId = null;
  let refreshInProgress = false;

  //////////////////////////////////////////////////////
  // REQUEST HELPER
  //////////////////////////////////////////////////////

  function sendRequest(
    url,
    method,
    tokenValue
  ) {
    const config = {
      method: method || "GET",
      headers: {}
    };

    if (tokenValue) {
      config.headers.Authorization =
        `Bearer ${tokenValue}`;
    }

    return fetch(url, config)
      .then(function (response) {
        return response
          .text()
          .then(function (responseText) {
            let responseData = null;

            if (responseText) {
              try {
                responseData =
                  JSON.parse(responseText);
              } catch (error) {
                responseData = null;
              }
            }

            return {
              status: response.status,
              data: responseData
            };
          });
      })
      .catch(function (error) {
        console.error(
          "Participant request failed:",
          error
        );

        return {
          status: 500,
          data: {
            message:
              "Unable to connect to the server."
          }
        };
      });
  }

  //////////////////////////////////////////////////////
  // HELPERS
  //////////////////////////////////////////////////////

  function escapeHtml(value) {
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

  function getPost(postId) {
    return postsById[
      String(postId)
    ];
  }

  function getCurrentCount(post) {
    const count =
      Number(
        post &&
        post.current_participants
      );

    if (
      Number.isNaN(count) ||
      count < 1
    ) {
      return 1;
    }

    return count;
  }

  function getMaximumCount(post) {
    const maximum =
      Number(
        post &&
        post.max_participants
      );

    if (
      Number.isNaN(maximum) ||
      maximum < 2
    ) {
      return 5;
    }

    return maximum;
  }

  function getErrorMessage(
    responseData,
    fallbackMessage
  ) {
    if (!responseData) {
      return fallbackMessage;
    }

    return (
      responseData.message ||
      responseData.error ||
      fallbackMessage
    );
  }

  function getPostIdFromCard(card) {
    const button =
      card.querySelector(
        ".comment-toggle[data-post-id]"
      );

    if (!button) {
      return null;
    }

    return button.dataset.postId;
  }

  //////////////////////////////////////////////////////
  // CREATE PARTICIPANT SECTION
  //////////////////////////////////////////////////////

  function addParticipantSection(
    card,
    postId
  ) {
    let participantSummary =
      card.querySelector(
        ".participant-summary"
      );

    if (participantSummary) {
      return participantSummary;
    }

    participantSummary =
      document.createElement("div");

    participantSummary.className =
      "participant-summary";

    participantSummary.id =
      `participant-summary-${postId}`;

    participantSummary.innerHTML = `
      <div class="participant-summary-top">
        <div>
          <p class="participant-count-text">
            Loading participants...
          </p>

          <p class="participant-spots-text"></p>
        </div>

        <button
          type="button"
          class="btn-view-participants"
          data-post-id="${postId}"
        >
          View People
        </button>
      </div>

      <div class="participant-progress-track">
        <div class="participant-progress-fill"></div>
      </div>
    `;

    const footer =
      card.querySelector(
        ".card-footer-row"
      );

    if (footer) {
      card.insertBefore(
        participantSummary,
        footer
      );
    } else {
      card.appendChild(
        participantSummary
      );
    }

    return participantSummary;
  }

  //////////////////////////////////////////////////////
  // UPDATE ONE POST CARD
  //////////////////////////////////////////////////////

  function updatePostCard(card) {
    const postId =
      getPostIdFromCard(card);

    if (!postId) {
      return;
    }

    card.dataset.postId =
      postId;

    const post =
      getPost(postId);

    const currentParticipants =
      getCurrentCount(post);

    const maxParticipants =
      getMaximumCount(post);

    const remainingSpots =
      Math.max(
        maxParticipants -
          currentParticipants,
        0
      );

    const isFull =
      currentParticipants >=
      maxParticipants;

    const progressPercentage =
      Math.min(
        Math.round(
          (
            currentParticipants /
            maxParticipants
          ) * 100
        ),
        100
      );

    const participantSummary =
      addParticipantSection(
        card,
        postId
      );

    const countText =
      participantSummary.querySelector(
        ".participant-count-text"
      );

    const spotsText =
      participantSummary.querySelector(
        ".participant-spots-text"
      );

    const progressFill =
      participantSummary.querySelector(
        ".participant-progress-fill"
      );

    countText.textContent =
      `${currentParticipants} / ${maxParticipants} people joined`;

    spotsText.textContent =
      isFull
        ? "Hangout full"
        : `${remainingSpots} spot${
            remainingSpots === 1
              ? ""
              : "s"
          } remaining`;

    progressFill.style.width =
      `${progressPercentage}%`;

    participantSummary.classList.toggle(
      "full",
      isFull
    );

    ////////////////////////////////////////////////////
    // UPDATE ACCEPT BUTTON
    ////////////////////////////////////////////////////

    const acceptButton =
      card.querySelector(
        ".btn-card-action.accept"
      );

    if (!acceptButton) {
      return;
    }

    acceptButton.disabled = false;

    acceptButton.classList.remove(
      "accepted",
      "unaccept",
      "full",
      "hosting"
    );

    const isHost =
      post &&
      userId &&
      String(post.user_id) ===
        String(userId);

    if (isHost) {
      acceptButton.textContent =
        "Hosting";

      acceptButton.disabled = true;

      acceptButton.classList.add(
        "hosting"
      );

      acceptButton.style.background =
        "var(--lavender)";

      return;
    }

    if (
      acceptedPostId !== null &&
      String(acceptedPostId) ===
        String(postId)
    ) {
      acceptButton.textContent =
        "Unaccept";

      acceptButton.classList.add(
        "accepted",
        "unaccept"
      );

      acceptButton.style.background =
        "#ffd4d4";

      return;
    }

    if (isFull) {
      acceptButton.textContent =
        "Full";

      acceptButton.classList.add(
        "full"
      );

      acceptButton.style.background =
        "#e9e6f2";

      return;
    }

    acceptButton.textContent =
      "Accept";

    acceptButton.style.background =
      "var(--mint)";
  }

  //////////////////////////////////////////////////////
  // UPDATE ALL POST CARDS
  //////////////////////////////////////////////////////

  function updateAllPostCards() {
    postsGrid
      .querySelectorAll(".post-card")
      .forEach(function (card) {
        updatePostCard(card);
      });
  }

  //////////////////////////////////////////////////////
  // LOAD POSTS AND COUNTS
  //////////////////////////////////////////////////////

  function loadParticipantCounts() {
    return sendRequest(
      `${currentUrl}/posts`,
      "GET"
    ).then(function (result) {
      if (
        result.status !== 200 ||
        !Array.isArray(result.data)
      ) {
        return;
      }

      postsById = {};

      result.data.forEach(
        function (post) {
          postsById[
            String(post.id)
          ] = post;
        }
      );
    });
  }

  //////////////////////////////////////////////////////
  // LOAD CURRENT USER'S ACCEPTED POST
  //////////////////////////////////////////////////////

  function loadAcceptedPost() {
    if (!userId) {
      acceptedPostId = null;
      return Promise.resolve();
    }

    return sendRequest(
      `${currentUrl}/accept/user/${userId}`,
      "GET",
      token
    ).then(function (result) {
      if (
        result.status === 200 &&
        Array.isArray(result.data) &&
        result.data.length > 0
      ) {
        acceptedPostId =
          result.data[0].post_id;
      } else {
        acceptedPostId = null;
      }
    });
  }

  //////////////////////////////////////////////////////
  // REFRESH FOR ALL USERS
  //////////////////////////////////////////////////////

  function refreshParticipantFeature() {
    if (
      refreshInProgress ||
      document.hidden
    ) {
      return;
    }

    refreshInProgress = true;

    Promise.all([
      loadParticipantCounts(),
      loadAcceptedPost()
    ])
      .then(function () {
        updateAllPostCards();

        if (
          openedParticipantsPostId !==
          null
        ) {
          loadParticipantsModal(
            openedParticipantsPostId,
            false
          );
        }
      })
      .finally(function () {
        refreshInProgress = false;
      });
  }

  //////////////////////////////////////////////////////
  // PARTICIPANTS MODAL
  //////////////////////////////////////////////////////

  function closeParticipantsModal() {
    if (!participantsModal) {
      return;
    }

    participantsModal.classList.remove(
      "open"
    );

    openedParticipantsPostId = null;
    document.body.style.overflow = "";
  }

  function renderParticipants(
    participants
  ) {
    if (!participantsList) {
      return;
    }

    if (
      !Array.isArray(participants) ||
      participants.length === 0
    ) {
      participantsList.innerHTML = `
        <div class="participants-empty">
          No participants found.
        </div>
      `;

      return;
    }

    participantsList.innerHTML =
      participants
        .map(function (participant) {
          const name =
            participant.student_name ||
            participant.studentname ||
            `user${participant.user_id}`;

          const initial =
            String(name)
              .trim()
              .charAt(0)
              .toUpperCase() || "U";

          return `
            <div class="participant-list-item">
              <div class="participant-avatar">
                ${escapeHtml(initial)}
              </div>

              <div class="participant-list-details">
                <p class="participant-list-name">
                  ${escapeHtml(name)}
                </p>

                <p class="participant-list-status">
                  ${
                    participant.is_host
                      ? "Post creator"
                      : "Participant"
                  }
                </p>
              </div>

              ${
                participant.is_host
                  ? `
                    <span class="participant-host-badge">
                      Host
                    </span>
                  `
                  : ""
              }
            </div>
          `;
        })
        .join("");
  }

  function loadParticipantsModal(
    postId,
    shouldOpen
  ) {
    if (!participantsModal) {
      return;
    }

    openedParticipantsPostId =
      postId;

    const post =
      getPost(postId);

    if (participantsModalTitle) {
      participantsModalTitle.textContent =
        post && post.title
          ? post.title
          : "Participants";
    }

    if (shouldOpen !== false) {
      participantsModal.classList.add(
        "open"
      );

      document.body.style.overflow =
        "hidden";

      if (participantsList) {
        participantsList.innerHTML = `
          <div class="participants-empty">
            Loading participants...
          </div>
        `;
      }
    }

    sendRequest(
      `${currentUrl}/accept/${postId}/participants`,
      "GET"
    ).then(function (result) {
      if (
        result.status !== 200 ||
        !result.data
      ) {
        if (participantsList) {
          participantsList.innerHTML = `
            <div class="participants-empty">
              Failed to load participants.
            </div>
          `;
        }

        return;
      }

      const currentParticipants =
        Number(
          result.data.current_participants ||
          1
        );

      const maxParticipants =
        Number(
          result.data.max_participants ||
          5
        );

      const remainingSpots =
        Math.max(
          maxParticipants -
            currentParticipants,
          0
        );

      const percentage =
        Math.min(
          Math.round(
            (
              currentParticipants /
              maxParticipants
            ) * 100
          ),
          100
        );

      if (participantsModalCount) {
        participantsModalCount.textContent =
          `${currentParticipants} / ${maxParticipants} people joined`;
      }

      if (participantsModalSpots) {
        participantsModalSpots.textContent =
          remainingSpots === 0
            ? "Hangout full"
            : `${remainingSpots} spot${
                remainingSpots === 1
                  ? ""
                  : "s"
              } remaining`;
      }

      if (participantsModalProgress) {
        participantsModalProgress.style.width =
          `${percentage}%`;

        participantsModalProgress.style.background =
          remainingSpots === 0
            ? "var(--tomato)"
            : "var(--green)";
      }

      let participants =
        result.data.participants;

      if (
        typeof participants === "string"
      ) {
        try {
          participants =
            JSON.parse(participants);
        } catch (error) {
          participants = [];
        }
      }

      renderParticipants(
        participants
      );
    });
  }

  //////////////////////////////////////////////////////
  // ACCEPT AND UNACCEPT
  //////////////////////////////////////////////////////

  window.handleAccept =
    function (postId) {
      if (!token || !userId) {
        alert(
          "Please log in to accept a post!"
        );

        return;
      }

      const post =
        getPost(postId);

      if (!post) {
        alert(
          "Post information is still loading. Please try again."
        );

        refreshParticipantFeature();
        return;
      }

      const currentParticipants =
        getCurrentCount(post);

      const maxParticipants =
        getMaximumCount(post);

      const isHost =
        String(post.user_id) ===
        String(userId);

      if (isHost) {
        alert(
          "You created this hangout and are already counted as the host."
        );

        return;
      }

      //////////////////////////////////////////////////
      // UNACCEPT
      //////////////////////////////////////////////////

      if (
        acceptedPostId !== null &&
        String(acceptedPostId) ===
          String(postId)
      ) {
        const confirmedLeave =
          confirm(
            "Are you sure you want to unaccept and leave this hangout?"
          );

        if (!confirmedLeave) {
          return;
        }

        sendRequest(
          `${currentUrl}/accept/${postId}`,
          "DELETE",
          token
        ).then(function (result) {
          if (result.status === 200) {
            acceptedPostId = null;

            post.current_participants =
              Number(
                result.data &&
                result.data.current_participants
                  ? result.data.current_participants
                  : Math.max(
                      currentParticipants - 1,
                      1
                    )
              );

            updateAllPostCards();

            alert(
              "You have left the hangout."
            );

            refreshParticipantFeature();
            return;
          }

          alert(
            getErrorMessage(
              result.data,
              "Failed to leave the hangout."
            )
          );

          refreshParticipantFeature();
        });

        return;
      }

      //////////////////////////////////////////////////
      // ALREADY JOINED ANOTHER HANGOUT
      //////////////////////////////////////////////////

      if (
        acceptedPostId !== null &&
        String(acceptedPostId) !==
          String(postId)
      ) {
        alert(
          "You already joined another hangout. Unaccept it before joining this one."
        );

        return;
      }

      //////////////////////////////////////////////////
      // FULL HANGOUT
      //////////////////////////////////////////////////

      if (
        currentParticipants >=
        maxParticipants
      ) {
        alert(
          "Sorry, this hangout is already full."
        );

        return;
      }

      //////////////////////////////////////////////////
      // ACCEPT
      //////////////////////////////////////////////////

      const confirmedJoin =
        confirm(
          "Are you sure you want to join this hangout?"
        );

      if (!confirmedJoin) {
        return;
      }

      sendRequest(
        `${currentUrl}/accept/${postId}`,
        "POST",
        token
      ).then(function (result) {
        if (
          result.status === 200 ||
          result.status === 201
        ) {
          acceptedPostId =
            postId;

          post.current_participants =
            Number(
              result.data &&
              result.data.current_participants
                ? result.data.current_participants
                : currentParticipants + 1
            );

          updateAllPostCards();

          alert(
            "You have successfully joined the hangout!"
          );

          refreshParticipantFeature();
          return;
        }

        if (
          result.data &&
          result.data.current_participants
        ) {
          post.current_participants =
            Number(
              result.data.current_participants
            );
        }

        alert(
          getErrorMessage(
            result.data,
            "Failed to accept the hangout."
          )
        );

        refreshParticipantFeature();
      });
    };

  //////////////////////////////////////////////////////
  // VIEW PEOPLE BUTTON
  //////////////////////////////////////////////////////

  postsGrid.addEventListener(
    "click",
    function (event) {
      const viewButton =
        event.target.closest(
          ".btn-view-participants"
        );

      if (!viewButton) {
        return;
      }

      loadParticipantsModal(
        viewButton.dataset.postId,
        true
      );
    }
  );

  //////////////////////////////////////////////////////
  // CLOSE MODAL EVENTS
  //////////////////////////////////////////////////////

  if (closeParticipantsModalButton) {
    closeParticipantsModalButton
      .addEventListener(
        "click",
        closeParticipantsModal
      );
  }

  if (participantsModal) {
    participantsModal.addEventListener(
      "click",
      function (event) {
        if (
          event.target ===
          participantsModal
        ) {
          closeParticipantsModal();
        }
      }
    );
  }

  document.addEventListener(
    "keydown",
    function (event) {
      if (event.key === "Escape") {
        closeParticipantsModal();
      }
    }
  );

  //////////////////////////////////////////////////////
  // DETECT WHEN post.js RENDERS THE CARDS
  //////////////////////////////////////////////////////

  const postGridObserver =
    new MutationObserver(
      function () {
        updateAllPostCards();
      }
    );

  postGridObserver.observe(
    postsGrid,
    {
      childList: true
    }
  );

  //////////////////////////////////////////////////////
  // START PARTICIPANT FEATURE
  //////////////////////////////////////////////////////

  refreshParticipantFeature();

  const participantRefreshTimer =
    setInterval(
      refreshParticipantFeature,
      2000
    );

  document.addEventListener(
    "visibilitychange",
    function () {
      if (!document.hidden) {
        refreshParticipantFeature();
      }
    }
  );

  window.addEventListener(
    "beforeunload",
    function () {
      clearInterval(
        participantRefreshTimer
      );
    }
  );
});