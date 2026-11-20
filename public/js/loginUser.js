/* global currentUrl, fetchMethod */

document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const warningCard = document.getElementById("warningCard");
  const warningText = document.getElementById("warningText");


  if (!loginForm) return;


  function showWarning(message) {
    if (!warningCard || !warningText) return;
    warningCard.classList.remove("d-none");
    warningText.textContent = message;
  }


  function hideWarning() {
    if (!warningCard || !warningText) return;
    warningCard.classList.add("d-none");
    warningText.textContent = "";
  }


  const callback = (responseStatus, responseData) => {
    hideWarning();


    if (responseStatus === 200 && responseData && responseData.token) {
      localStorage.setItem("token", responseData.token);
      localStorage.setItem("userId", responseData.userId || "");
      localStorage.setItem("student_name", responseData.student_name || "");
      localStorage.setItem("student_email", responseData.student_email || "");
      window.location.href = "index.html";
      return;
    }


    showWarning((responseData && responseData.message) || "Login failed.");
  };


  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();


    const student_email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;


    hideWarning();


    if (!student_email || !password) {
      showWarning("Email and password are required.");
      return;
    }


    const data = {
      student_email,
      password
    };


    fetchMethod(currentUrl + "/auth/login", callback, "POST", data);
  });
});



//////////////////////////////////////////////////////
// JOURNEY POPUP AND CONFETTI
//////////////////////////////////////////////////////


document.addEventListener("DOMContentLoaded", function () {
  const journeyPopup = document.getElementById("journeyPopup");


  const closeJourneyPopupButton =
    document.getElementById("closeJourneyPopupButton");


  const confettiContainer =
    document.getElementById("confettiContainer");


  const confettiColors = [
    "#ff6b6b",
    "#ffda3b",
    "#6bffb8",
    "#c9aaff",
    "#ffb347",
    "#a8edff"
  ];


  //////////////////////////////////////////////////////
  // CREATE CONFETTI
  //////////////////////////////////////////////////////


  function createConfetti() {
    if (!confettiContainer) {
      return;
    }


    confettiContainer.innerHTML = "";


    const totalConfettiPieces = 65;


    for (
      let index = 0;
      index < totalConfettiPieces;
      index++
    ) {
      const confettiPiece =
        document.createElement("span");


      confettiPiece.classList.add("confetti-piece");


      const randomShape =
        Math.floor(Math.random() * 5);


      if (randomShape === 1) {
        confettiPiece.classList.add("circle");
      }


      if (randomShape === 2) {
        confettiPiece.classList.add("star");
        confettiPiece.textContent = "★";
      }


      const randomColor =
        confettiColors[
          Math.floor(
            Math.random() * confettiColors.length
          )
        ];


      confettiPiece.style.left =
        Math.random() * 100 + "%";


      confettiPiece.style.backgroundColor =
        randomColor;


      confettiPiece.style.color =
        randomColor;


      confettiPiece.style.animationDuration =
        2.8 + Math.random() * 3 + "s";


      confettiPiece.style.animationDelay =
        Math.random() * 1.2 + "s";


      confettiPiece.style.width =
        8 + Math.random() * 8 + "px";


      confettiPiece.style.height =
        10 + Math.random() * 13 + "px";


      confettiContainer.appendChild(
        confettiPiece
      );
    }
  }


  //////////////////////////////////////////////////////
  // OPEN POPUP
  //////////////////////////////////////////////////////


  function openJourneyPopup() {
    if (!journeyPopup) {
      return;
    }


    journeyPopup.classList.remove("hidden");


    document.body.style.overflow = "hidden";


    createConfetti();


    if (closeJourneyPopupButton) {
      closeJourneyPopupButton.focus();
    }
  }


  //////////////////////////////////////////////////////
  // CLOSE POPUP
  //////////////////////////////////////////////////////


  function closeJourneyPopup() {
    if (!journeyPopup) {
      return;
    }


    journeyPopup.classList.add("hidden");


    document.body.style.overflow = "";


    setTimeout(function () {
      if (confettiContainer) {
        confettiContainer.innerHTML = "";
      }
    }, 400);
  }


  //////////////////////////////////////////////////////
  // POPUP EVENTS
  //////////////////////////////////////////////////////


  if (journeyPopup) {
    openJourneyPopup();
  }


  if (closeJourneyPopupButton) {
    closeJourneyPopupButton.addEventListener(
      "click",
      closeJourneyPopup
    );
  }
});