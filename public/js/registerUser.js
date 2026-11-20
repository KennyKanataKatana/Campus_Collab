/* global currentUrl, fetchMethod */

document.addEventListener("DOMContentLoaded", function () {
  const registerForm = document.getElementById("signupForm");
  const warningCard = document.getElementById("warningCard");
  const warningText = document.getElementById("warningText");


  if (!registerForm) return;


  const callback = (responseStatus, responseData) => {
    console.log("register responseStatus:", responseStatus);
    console.log("register responseData:", responseData);


    warningCard.classList.add("d-none");
    warningText.textContent = "";


    if (responseStatus === 201 || responseStatus === 200) {
      if (responseData && responseData.token) {
        localStorage.setItem("token", responseData.token);
      }


      if (responseData && responseData.userId) {
        localStorage.setItem("userId", responseData.userId);
      }


      if (responseData && responseData.student_name) {
        localStorage.setItem("student_name", responseData.student_name);
      }


      window.location.href = "login.html";
    } else {
      warningCard.classList.remove("d-none");
      warningText.innerText =
        (responseData && responseData.message) ||
        "Registration failed. Please try again.";
    }
  };


  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();


    const student_name = document.getElementById("username").value.trim();
    const student_email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;


    warningCard.classList.add("d-none");
    warningText.textContent = "";


    if (!student_name || !student_email || !password || !confirmPassword) {
      warningCard.classList.remove("d-none");
      warningText.innerText = "All fields are required.";
      return;
    }


    if (password !== confirmPassword) {
      warningCard.classList.remove("d-none");
      warningText.innerText = "Passwords do not match.";
      return;
    }


    const data = {
      student_name: student_name,
      student_email: student_email,
      password: password
    };


    fetchMethod(currentUrl + "/auth/register", callback, "POST", data);
  });
});