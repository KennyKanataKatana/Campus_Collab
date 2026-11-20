/* global currentUrl, fetchMethod */

document.addEventListener("DOMContentLoaded", function () {
  const appealForm = document.getElementById("appealForm");
  const appealReportId = document.getElementById("appealReportId");
  const warningCard = document.getElementById("warningCard");
  const warningText = document.getElementById("warningText");
  const successCard = document.getElementById("successCard");
  const successText = document.getElementById("successText");


  const appealPasskey = document.getElementById("appealPasskey");
  const unlockAppealsBtn = document.getElementById("unlockAppealsBtn");
  const appealsGateMessage = document.getElementById("appealsGateMessage");
  const appealsSection = document.getElementById("appealsSection");
  const appealsList = document.getElementById("appealsList");
  const showAppealPasskey = document.getElementById("showAppealPasskey");


  const token = localStorage.getItem("token");


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


  function loadMyReceivedReports() {
    if (!token) {
      return;
    }


    fetch(currentUrl + "/reports/my-received-reports", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      }
    })
      .then((response) =>
        response.json().then((data) => ({
          status: response.status,
          data
        }))
      )
      .then(({ status, data }) => {
        if (status !== 200 || !Array.isArray(data)) {
          return;
        }


        data.forEach((report) => {
          const option = document.createElement("option");
          option.value = report.id;
          option.textContent = `#${report.id} — ${report.incident_area} (${formatDate(report.created_at)})`;
          appealReportId.appendChild(option);
        });
      })
      .catch((error) => {
        console.error("load my received reports error:", error);
      });
  }


  function renderAppeals(appeals) {
    if (!Array.isArray(appeals) || appeals.length === 0) {
      appealsList.innerHTML = `
        <div class="empty-state">
          <p>No appeals found yet.</p>
        </div>
      `;
      return;
    }


    appealsList.innerHTML = appeals.map((appeal) => `
      <article class="report-row">
        <div class="report-pills">
          <span class="report-pill">#${appeal.id}</span>
          <span class="report-pill">${escapeHtml(appeal.student_name)}</span>
          <span class="report-pill">Status: ${escapeHtml(appeal.status)}</span>
          ${appeal.report_id ? `<span class="report-pill">Report #${appeal.report_id}</span>` : ``}
        </div>
        <p><strong>Reason:</strong> ${escapeHtml(appeal.reason)}</p>
        <p><strong>Submitted:</strong> ${escapeHtml(formatDate(appeal.created_at))}</p>
      </article>
    `).join("");
  }


  appealForm.addEventListener("submit", function (event) {
    event.preventDefault();
    hideMessages();


    if (!token) {
      showWarning("You need to log in first before submitting an appeal.");
      return;
    }


    const reportIdRaw = appealReportId.value;
    const reason = document.getElementById("appealReason").value.trim();
    const agreeRules = document.getElementById("agreeAppealRules").checked;


    if (!reason) {
      showWarning("Please explain your appeal before submitting.");
      return;
    }


    if (!agreeRules) {
      showWarning("Please agree to the checkbox before submitting.");
      return;
    }


    const data = {
      report_id: reportIdRaw ? Number(reportIdRaw) : null,
      reason: reason
    };


    const callback = (status, responseData) => {
      if (status !== 201 && status !== 200) {
        showWarning(responseData.message || responseData.error || "Failed to submit appeal.");
        return;
      }


      showSuccess(responseData.message || "Appeal submitted successfully.");
      appealForm.reset();
    };


    fetchMethod(currentUrl + "/appeals", callback, "POST", data, token);
  });


  unlockAppealsBtn.addEventListener("click", function () {
    const enteredPasskey = appealPasskey.value.trim();


    if (!enteredPasskey) {
      appealsSection.classList.add("d-none");
      appealsGateMessage.innerHTML = `<p>Please enter the passkey first.</p>`;
      return;
    }


    fetch(currentUrl + "/appeals", {
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
          appealsSection.classList.add("d-none");
          appealsGateMessage.innerHTML = `<p>${escapeHtml(data.message || "Wrong passkey. Appeals are still hidden.")}</p>`;
          return;
        }


        appealsGateMessage.innerHTML = `<p>Passkey accepted. Appeals unlocked.</p>`;
        appealsSection.classList.remove("d-none");
        renderAppeals(data);
      })
      .catch((error) => {
        console.error("unlock appeals error:", error);
        appealsSection.classList.add("d-none");
        appealsGateMessage.innerHTML = `<p>Could not verify passkey right now.</p>`;
      });
  });


  showAppealPasskey.addEventListener("change", function () {
    appealPasskey.type = showAppealPasskey.checked ? "text" : "password";
  });


  loadMyReceivedReports();
});