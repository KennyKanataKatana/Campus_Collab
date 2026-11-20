/* global currentUrl, fetchMethod */

document.addEventListener("DOMContentLoaded", function () {
  const reportForm = document.getElementById("reportForm");
  const reportsList = document.getElementById("reportsList");
  const studentNames = document.getElementById("studentNames");
  const mutedUsersList = document.getElementById("mutedUsersList");


  const warningCard = document.getElementById("warningCard");
  const warningText = document.getElementById("warningText");
  const successCard = document.getElementById("successCard");
  const successText = document.getElementById("successText");


  const reportPasskey = document.getElementById("reportPasskey");
  const unlockReportsBtn = document.getElementById("unlockReportsBtn");
  const reportsGateMessage = document.getElementById("reportsGateMessage");
  const reportsSection = document.getElementById("reportsSection");
  const showPasskey = document.getElementById("showPasskey");


  let unlockedReportPasskey = "";
  const token = localStorage.getItem("token");
  const currentStudentName = localStorage.getItem("student_name");


  function showWarning(message) {
    successCard.classList.add("d-none");
    successText.innerText = "";
    warningCard.classList.remove("d-none");
    warningText.innerText = message;
  }


  function showSuccess(message) {
    warningCard.classList.add("d-none");
    warningText.innerText = "";
    successCard.classList.remove("d-none");
    successText.innerText = message;
  }


  function hideMessages() {
    warningCard.classList.add("d-none");
    warningText.innerText = "";
    successCard.classList.add("d-none");
    successText.innerText = "";
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
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString();
  }


  function renderReports(reports) {
    if (!Array.isArray(reports) || reports.length === 0) {
      reportsList.innerHTML = `
        <div class="empty-state">
          <p>No reports found yet.</p>
        </div>
      `;
      return;
    }


    reportsList.innerHTML = reports.map((report) => `
      <article class="report-row">
        <div class="report-pills">
          <span class="report-pill">#${report.id}</span>
          <span class="report-pill">Reporter: ${escapeHtml(report.reporter_name)}</span>
          <span class="report-pill">Reported: ${escapeHtml(report.reported_user_name)}</span>
          <span class="report-pill">${escapeHtml(report.incident_area)}</span>
        </div>
        <p><strong>Reason:</strong> ${escapeHtml(report.reason)}</p>
        <p><strong>Proof:</strong> ${report.proof_image_url ? `<a href="${escapeHtml(report.proof_image_url)}" target="_blank" rel="noopener noreferrer">View proof</a>` : "No proof link"}</p>
        <p><strong>Created:</strong> ${escapeHtml(formatDate(report.created_at))}</p>
        <div class="report-actions">
          <button
            type="button"
            class="btn-mute"
            data-reported-user-id="${report.reported_user_id}"
            data-reported-user-name="${escapeHtml(report.reported_user_name)}"
          >
            Mute Offender
          </button>
        </div>
      </article>
    `).join("");


    bindMuteButtons();
  }


  function renderMutedUsers(users) {
    if (!Array.isArray(users) || users.length === 0) {
      mutedUsersList.innerHTML = `
        <div class="empty-state">
          <p>No muted users right now.</p>
        </div>
      `;
      return;
    }


    mutedUsersList.innerHTML = users.map((user) => `
      <article class="report-row">
        <div class="report-pills">
          <span class="report-pill">#${user.id}</span>
          <span class="report-pill">${escapeHtml(user.student_name)}</span>
          <span class="report-pill">Muted: ${escapeHtml(formatDate(user.muted_at))}</span>
          <span class="report-pill">Until: ${user.mute_until ? escapeHtml(formatDate(user.mute_until)) : "Permanent"}</span>
        </div>
        <p><strong>Reason:</strong> ${escapeHtml(user.muted_reason || "Muted by admin")}</p>
        <div class="report-actions">
          <button
            type="button"
            class="btn-unmute"
            data-user-id="${user.id}"
            data-user-name="${escapeHtml(user.student_name)}"
          >
            Unmute User
          </button>
        </div>
      </article>
    `).join("");


    bindUnmuteButtons();
  }


  function loadMutedUsers() {
    if (!unlockedReportPasskey) {
      mutedUsersList.innerHTML = "";
      return;
    }


    fetch(currentUrl + "/reports/muted-users", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-report-passkey": unlockedReportPasskey
      }
    })
      .then((response) =>
        response.json().then((data) => ({
          status: response.status,
          data
        }))
      )
      .then(({ status, data }) => {
        if (status !== 200) {
          mutedUsersList.innerHTML = `<p>Could not load muted users.</p>`;
          return;
        }


        renderMutedUsers(data);
      })
      .catch((error) => {
        console.error("load muted users error:", error);
        mutedUsersList.innerHTML = `<p>Could not load muted users.</p>`;
      });
  }


  function bindMuteButtons() {
    const muteButtons = document.querySelectorAll(".btn-mute");


    muteButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const reportedUserId = this.dataset.reportedUserId;
        const reportedUserName = this.dataset.reportedUserName;


        if (!unlockedReportPasskey) {
          showWarning("Unlock the reports with the admin passkey first.");
          return;
        }


        const enteredMinutes = window.prompt(`Mute ${reportedUserName} for how many minutes?`, "10");


        if (enteredMinutes === null) {
          return;
        }


        const muteMinutes = Number(enteredMinutes);


        if (!Number.isInteger(muteMinutes) || muteMinutes <= 0) {
          showWarning("Please enter a valid positive whole number of minutes.");
          return;
        }


        this.disabled = true;
        this.innerText = "Muting...";


        fetch(currentUrl + `/reports/mute/${reportedUserId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-report-passkey": unlockedReportPasskey
          },
          body: JSON.stringify({
            mute_minutes: muteMinutes
          })
        })
          .then((response) =>
            response.json().then((data) => ({
              status: response.status,
              data
            }))
          )
          .then(({ status, data }) => {
            if (status !== 200) {
              this.disabled = false;
              this.innerText = "Mute Offender";
              showWarning(data.message || data.error || "Failed to mute user.");
              return;
            }


            this.innerText = "Muted";
            this.classList.add("is-muted");
            showSuccess(data.message || `${reportedUserName} has been muted.`);
            loadMutedUsers();
          })
          .catch((error) => {
            console.error("mute offender error:", error);
            this.disabled = false;
            this.innerText = "Mute Offender";
            showWarning("Could not mute the reported user right now.");
          });
      });
    });
  }


  function bindUnmuteButtons() {
    const unmuteButtons = document.querySelectorAll(".btn-unmute");


    unmuteButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const userId = this.dataset.userId;
        const userName = this.dataset.userName;


        if (!unlockedReportPasskey) {
          showWarning("Unlock the reports with the admin passkey first.");
          return;
        }


        const confirmed = window.confirm(`Unmute ${userName}?`);
        if (!confirmed) {
          return;
        }


        this.disabled = true;
        this.innerText = "Unmuting...";


        fetch(currentUrl + `/reports/unmute/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-report-passkey": unlockedReportPasskey
          }
        })
          .then((response) =>
            response.json().then((data) => ({
              status: response.status,
              data
            }))
          )
          .then(({ status, data }) => {
            if (status !== 200) {
              this.disabled = false;
              this.innerText = "Unmute User";
              showWarning(data.message || data.error || "Failed to unmute user.");
              return;
            }


            showSuccess(data.message || `${userName} has been unmuted.`);
            loadMutedUsers();
          })
          .catch((error) => {
            console.error("unmute user error:", error);
            this.disabled = false;
            this.innerText = "Unmute User";
            showWarning("Could not unmute the user right now.");
          });
      });
    });
  }


  function loadUsers() {
    const callback = (status, responseData) => {
      if (status !== 200 || !Array.isArray(responseData)) {
        return;
      }


      studentNames.innerHTML = responseData.map((user) =>
        `<option value="${escapeHtml(user.student_name)}"></option>`
      ).join("");
    };


    fetchMethod(currentUrl + "/reports/users", callback, "GET");
  }


  reportForm.addEventListener("submit", function (event) {
    event.preventDefault();
    hideMessages();


    if (!token) {
      showWarning("You need to log in first before submitting a report.");
      return;
    }


    const reportedStudentName = document.getElementById("reportedStudentName").value.trim();
    const incidentArea = document.getElementById("incidentArea").value.trim();
    const reason = document.getElementById("reason").value.trim();
    const details = document.getElementById("details").value.trim();
    const proofImageUrl = document.getElementById("proofImageUrl").value.trim();
    const agreeRules = document.getElementById("agreeRules").checked;


    if (!reportedStudentName || !incidentArea || !reason) {
      showWarning("Please fill in the username, location, and reason.");
      return;
    }


    if (!agreeRules) {
      showWarning("Please agree to the report rules before submitting.");
      return;
    }


    if (currentStudentName && currentStudentName.toLowerCase() === reportedStudentName.toLowerCase()) {
      showWarning("You cannot report yourself.");
      return;
    }


    let finalReason = reason;
    if (details) {
      finalReason += ` - ${details}`;
    }


    const data = {
      reported_student_name: reportedStudentName,
      incident_area: incidentArea,
      reason: finalReason,
      proof_image_url: proofImageUrl || null
    };


    const callback = (status, responseData) => {
      if (status !== 201 && status !== 200) {
        showWarning(responseData.message || responseData.error || "Failed to submit report.");
        return;
      }


      showSuccess(responseData.message || "Report submitted successfully.");
      reportForm.reset();
    };


    fetchMethod(currentUrl + "/reports", callback, "POST", data, token);
  });


  unlockReportsBtn.addEventListener("click", function () {
    const enteredPasskey = reportPasskey.value.trim();


    if (!enteredPasskey) {
      reportsSection.classList.add("d-none");
      reportsGateMessage.innerHTML = `<p>Please enter the passkey first.</p>`;
      return;
    }


    fetch(currentUrl + "/reports", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-report-passkey": enteredPasskey
      }
    })
      .then((response) =>
        response.json().then((data) => ({
          status: response.status,
          data
        }))
      )
      .then(({ status, data }) => {
        if (status !== 200) {
          unlockedReportPasskey = "";
          reportsSection.classList.add("d-none");
          reportsGateMessage.innerHTML = `<p>${escapeHtml(data.message || "Wrong passkey. Reports are still hidden.")}</p>`;
          return;
        }


        unlockedReportPasskey = enteredPasskey;
        reportsGateMessage.innerHTML = `<p>Passkey accepted. Reports unlocked.</p>`;
        reportsSection.classList.remove("d-none");
        renderReports(data);
        loadMutedUsers();
      })
      .catch((error) => {
        console.error("unlock reports error:", error);
        unlockedReportPasskey = "";
        reportsSection.classList.add("d-none");
        reportsGateMessage.innerHTML = `<p>Could not verify passkey right now.</p>`;
      });
  });


  showPasskey.addEventListener("change", function () {
    reportPasskey.type = showPasskey.checked ? "text" : "password";
  });


  loadUsers();
});