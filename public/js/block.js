document.addEventListener('DOMContentLoaded', function () {

  const blockedList = document.getElementById('blockedList');

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');


  if (!token || !userId) {
    window.location.href = 'login.html';
    return;
  }



  //////////////////////////////////////////////////////
  // LOAD BLOCKED USERS
  //////////////////////////////////////////////////////

  function loadBlockedUsers() {

    fetch('/block', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    .then((res) => res.json())

    .then((data) => {


      if (!data.length) {

        blockedList.innerHTML = `
          <div class="empty-state">
            <h3>No blocked users 🚫</h3>
            <p>You have not blocked anyone.</p>
          </div>
        `;

        return;
      }



      blockedList.innerHTML = '';



      data.forEach((user) => {


        const card = document.createElement('div');

        card.className = 'blocked-card';



        card.innerHTML = `

          <div class="blocked-user">

            <div class="avatar-circle">
              🚫
            </div>


            <div class="user-details">

              <div class="blocked-name">
                ${user.student_name}
              </div>


              <div class="blocked-text">
                Blocked user
              </div>

            </div>

          </div>



          <button
            class="btn-unblock"
            onclick="unblockUser(${user.blocked_id})"
          >
            Unblock
          </button>

        `;


        blockedList.appendChild(card);


      });


    })


    .catch((err) => console.error(err));

  }





  //////////////////////////////////////////////////////
  // OPEN BLOCK MODAL
  //////////////////////////////////////////////////////

  window.openBlockModal = function () {


    const modal = document.getElementById('block-modal');


    if (modal) {

      modal.classList.remove('hidden');

    }


  };





  //////////////////////////////////////////////////////
  // CLOSE BLOCK MODAL
  //////////////////////////////////////////////////////

  window.closeBlockModal = function () {


    const modal = document.getElementById('block-modal');


    if (modal) {

      modal.classList.add('hidden');

    }



    const searchInput =
      document.getElementById('search-user');


    const results =
      document.getElementById('search-results');



    if (searchInput) {

      searchInput.value = '';

    }



    if (results) {

      results.innerHTML = '';

    }


  };







  //////////////////////////////////////////////////////
  // SEARCH USERS TO BLOCK
  //////////////////////////////////////////////////////

  async function searchUsersToBlock() {


    const searchInput =
      document.getElementById('search-user');


    const container =
      document.getElementById('search-results');



    const search =
      searchInput.value.trim();



    if (!search) {

      container.innerHTML = '';

      return;

    }




    try {


      const res = await fetch(
        `/block/search/${search}`,
        {
          headers:{
            Authorization:`Bearer ${token}`
          }
        }
      );



      const users = await res.json();



      const filteredUsers =
        users.filter(
          user => user.id !== Number(userId)
        );



      container.innerHTML = '';





      if (!filteredUsers.length) {


        container.innerHTML = `

          <div class="card">

            No users found.

          </div>

        `;


        return;

      }





      filteredUsers.forEach((user)=>{


        const card =
          document.createElement('div');



        card.className = 'card';




        card.innerHTML = `


          <h3>
            ${user.student_name}
          </h3>


          <p>
            ${user.student_email}
          </p>



          <button
            class="add-btn"
            onclick="blockUser(${user.id})"
          >

            Block

          </button>


        `;



        container.appendChild(card);



      });



    }


    catch(err){

      console.error(err);

    }


  }







  //////////////////////////////////////////////////////
  // BLOCK USER
  //////////////////////////////////////////////////////

  async function blockUser(id) {


    if (!confirm('Block this user?')) {

      return;

    }




    try {


      const res = await fetch(

        `/block/${id}`,

        {

          method:'POST',

          headers:{

            Authorization:`Bearer ${token}`

          }

        }

      );



      const data =
        await res.json();




      alert(data.message || 'User blocked');



      loadBlockedUsers();



      document.getElementById('search-user').value = '';

      document.getElementById('search-results').innerHTML = '';



    }


    catch(err){

      console.error(err);

    }


  }







  //////////////////////////////////////////////////////
  // UNBLOCK USER
  //////////////////////////////////////////////////////

  window.unblockUser = function(id) {


    fetch(

      `/block/${id}`,

      {

        method:'DELETE',

        headers:{

          Authorization:`Bearer ${token}`

        }

      }

    )


    .then(res=>res.json())


    .then(data=>{


      alert(data.message || 'User unblocked');


      loadBlockedUsers();


    })


    .catch(err=>console.error(err));


  };







  //////////////////////////////////////////////////////
  // EXPOSE FUNCTIONS FOR HTML
  //////////////////////////////////////////////////////

  window.searchUsersToBlock =
    searchUsersToBlock;


  window.blockUser =
    blockUser;





  //////////////////////////////////////////////////////
  // INITIAL LOAD
  //////////////////////////////////////////////////////

  loadBlockedUsers();


});