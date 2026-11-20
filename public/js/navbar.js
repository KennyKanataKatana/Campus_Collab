document.addEventListener('DOMContentLoaded', function () {
  const navbarMount = document.getElementById('navbar');

  if (!navbarMount) {
    return;
  }

  const token = localStorage.getItem('token');

  const guestLinks = `
    <li>
      <a href="login.html" class="nav-link">Login</a>
    </li>

    <li>
      <a href="register.html" class="nav-link">Register</a>
    </li>
  `;

  const mainUserLinks = `
    <li>
      <a href="index.html" class="nav-link">Home</a>
    </li>

    <li>
      <a href="post.html" class="nav-link">Hangout</a>
    </li>

    <li>
      <a href="friends.html" class="nav-link">Friends</a>
    </li>
  `;

  const mobilePrimaryLinks = `
    <li class="burger-menu-item burger-menu-item--home mobile-primary-menu-item">
      <a href="index.html" class="nav-link burger-nav-link">
        Home
      </a>
    </li>

    <li class="burger-menu-item burger-menu-item--hangout mobile-primary-menu-item">
      <a href="post.html" class="nav-link burger-nav-link">
        Hangout
      </a>
    </li>

    <li class="burger-menu-item burger-menu-item--friends mobile-primary-menu-item">
      <a href="friends.html" class="nav-link burger-nav-link">
        Friends
      </a>
    </li>
  `;

  const burgerUserLinks = `
    <li class="burger-menu-item burger-menu-item--forum burger-menu-secondary-start">
      <a href="forum.html" class="nav-link burger-nav-link">
        Forum
      </a>
    </li>

    <li class="burger-menu-item burger-menu-item--bookmarks">
      <a href="bookmark.html" class="nav-link burger-nav-link">
        Bookmarks
      </a>
    </li>

    <li class="burger-menu-item burger-menu-item--history">
      <a href="postHistory.html" class="nav-link burger-nav-link">
        Hangout History
      </a>
    </li>

    <li class="burger-menu-item burger-menu-item--checkin">
      <a href="checkin.html" class="nav-link burger-nav-link">
        Check-In
      </a>
    </li>

    <li class="burger-menu-item burger-menu-item--profile">
      <a href="profile.html" class="nav-link burger-nav-link">
        Profile
      </a>
    </li>

    <li class="burger-menu-item burger-menu-item--report">
      <a href="report.html" class="nav-link burger-nav-link">
        Report
      </a>
    </li>

    <li class="burger-menu-item burger-menu-item--logout">
      <button
        type="button"
        id="logout-button"
        class="nav-link burger-nav-link logout-button"
      >
        Logout
      </button>
    </li>
  `;

  navbarMount.innerHTML = `
    <nav class="navbar">
      <div class="container">
        <div class="navbar-content">

          <a
            href="${token ? 'index.html' : 'login.html'}"
            class="navbar-brand"
          >
            Campus Collab
          </a>

          ${
            token
              ? `
                <div class="navbar-right">

                  <ul class="navbar-nav main-navbar-nav">
                    ${mainUserLinks}
                  </ul>

                  <a
                    href="invitations.html"
                    class="nav-link notification-link"
                    aria-label="Invitations"
                    title="Invitations"
                  >
                    <span class="notification-icon">&#128276;</span>

                    <span
                      id="invitation-count"
                      class="notification-badge hidden"
                    >
                      0
                    </span>
                  </a>

                  <button
                    type="button"
                    id="burger-button"
                    class="burger-button"
                    aria-label="Open navigation menu"
                    aria-expanded="false"
                    aria-controls="burger-menu"
                  >
                    <span class="burger-line"></span>
                    <span class="burger-line"></span>
                    <span class="burger-line"></span>
                  </button>

                </div>

                <div
                  id="burger-menu"
                  class="burger-menu"
                  aria-hidden="true"
                >
                  <ul class="burger-menu-list">
                    ${mobilePrimaryLinks}
                    ${burgerUserLinks}
                  </ul>
                </div>
              `
              : `
                <ul class="navbar-nav guest-navbar-nav">
                  ${guestLinks}
                </ul>
              `
          }

        </div>
      </div>
    </nav>
  `;

  setActiveNavigationLink();

  if (token) {
    setupBurgerMenu();
    setupLogoutButton();
    loadInvitationCount();
  }
});

function setActiveNavigationLink() {
  const navbarMount = document.getElementById('navbar');

  if (!navbarMount) {
    return;
  }

  const currentPage = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';

  const navLinks = navbarMount.querySelectorAll('a.nav-link');

  navLinks.forEach((link) => {
    const href = (link.getAttribute('href') || '').split('?')[0].toLowerCase();

    if (href === currentPage) {
      link.classList.add('active');
    }
  });

  const burgerButton = document.getElementById('burger-button');

  const activeBurgerLink = document.querySelector('.burger-menu .nav-link.active');

  if (burgerButton && activeBurgerLink) {
    burgerButton.classList.add('has-active-page');
  }
}

function setupBurgerMenu() {
  const burgerButton = document.getElementById('burger-button');
  const burgerMenu = document.getElementById('burger-menu');

  if (!burgerButton || !burgerMenu) {
    return;
  }

  burgerButton.addEventListener('click', function (event) {
    event.stopPropagation();

    const isOpen = burgerMenu.classList.toggle('open');

    burgerButton.classList.toggle('open', isOpen);
    burgerButton.setAttribute('aria-expanded', String(isOpen));
    burgerMenu.setAttribute('aria-hidden', String(!isOpen));
  });

  burgerMenu.addEventListener('click', function (event) {
    event.stopPropagation();
  });

  document.addEventListener('click', function () {
    closeBurgerMenu();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeBurgerMenu();
    }
  });

  const burgerLinks = burgerMenu.querySelectorAll('a.burger-nav-link');

  burgerLinks.forEach((link) => {
    link.addEventListener('click', closeBurgerMenu);
  });
}

function closeBurgerMenu() {
  const burgerButton = document.getElementById('burger-button');
  const burgerMenu = document.getElementById('burger-menu');

  if (!burgerButton || !burgerMenu) {
    return;
  }

  burgerMenu.classList.remove('open');
  burgerButton.classList.remove('open');
  burgerButton.setAttribute('aria-expanded', 'false');
  burgerMenu.setAttribute('aria-hidden', 'true');
}

function setupLogoutButton() {
  const logoutButton = document.getElementById('logout-button');

  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener('click', function () {
    localStorage.removeItem('token');
    localStorage.removeItem('student_name');
    localStorage.removeItem('student_email');
    localStorage.removeItem('userId');
    localStorage.removeItem('user_id');

    window.location.href = 'login.html';
  });
}

async function loadInvitationCount() {
  const badge = document.getElementById('invitation-count');

  if (!badge) {
    return;
  }

  try {
    const response = await fetch('/notifications/unread-count', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
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
  } catch (error) {
    console.error('Failed to load invitation count:', error);
    badge.classList.add('hidden');
  }
}
