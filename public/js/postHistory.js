document.addEventListener("DOMContentLoaded", () => {
    loadPostHistory();
});


async function loadPostHistory() {

    const historyContainer = document.getElementById("historyContainer");
    const historyCount = document.querySelector(".history-count");


    if (!historyContainer) {
        console.error("historyContainer not found");
        return;
    }


    try {

        const token = localStorage.getItem("token");


        const response = await fetch("/post-history/", {

            headers: {
                Authorization: `Bearer ${token}`
            }

        });


        if (!response.ok) {
            throw new Error("Failed to load post history");
        }


        const history = await response.json();


        console.log("Post History:", history);


        historyContainer.innerHTML = "";


        if (historyCount) {

            historyCount.textContent =
                `${history.length} Archived Post${history.length !== 1 ? "s" : ""}`;

        }



        /*
            Always show container
            Playwright expects #historyContainer to be visible
        */

        historyContainer.style.display = "grid";



        if (history.length === 0) {


            historyContainer.innerHTML = `

                <div class="empty-state">

                    <h2>No Archived Posts</h2>

                    <p>
                        You haven't archived any posts yet.
                    </p>

                </div>

            `;


            return;

        }



        history.forEach(post => {


            const card = createHistoryCard(post);

            historyContainer.appendChild(card);


        });



    }
    catch (error) {


        console.error(
            "Error loading post history:",
            error
        );


        historyContainer.innerHTML = `

            <div class="empty-state">

                <h2>Unable to load history</h2>

                <p>
                    Please try again later.
                </p>

            </div>

        `;


    }

}





function createHistoryCard(post) {


    const card = document.createElement("div");

    card.className = "history-card";



    const createdDate = formatDate(post.created_at);

    const archivedDate = formatDate(post.archived_at);



    card.innerHTML = `


        <div class="card-top">


            <span class="location-pill">

                ${post.location_name ?? "Unknown Location"}

            </span>



            <span class="archive-date">

                Archived

            </span>


        </div>




        <div class="card-body">


            <h2 class="history-title">

                ${post.title}

            </h2>




            <div class="history-description">

                ${post.description}

            </div>




            <div class="history-info">


                <span>
                    👥 ${post.max_participants} People
                </span>



                <span>
                    📅 ${createdDate}
                </span>



                <span>
                    🗃 ${archivedDate}
                </span>



            </div>


        </div>




        <div class="card-actions">


            <button class="delete-btn">

                Delete History

            </button>


        </div>


    `;



    card
        .querySelector(".delete-btn")
        .addEventListener(
            "click",
            () => deleteHistory(post.history_id)
        );



    return card;

}






async function deleteHistory(historyId) {


    if (!confirm("Delete this history record?")) {

        return;

    }



    try {


        const token = localStorage.getItem("token");



        const response = await fetch(
            `/post-history/${historyId}`,
            {

                method: "DELETE",

                headers: {

                    Authorization:
                        `Bearer ${token}`

                }

            }
        );



        if (!response.ok) {

            throw new Error(
                "Failed to delete history"
            );

        }



        loadPostHistory();



    }
    catch(error) {


        console.error(
            "Delete error:",
            error
        );


        alert(
            "Failed to delete history."
        );


    }


}





function formatDate(dateString) {


    if (!dateString) {

        return "Unknown Date";

    }



    const date = new Date(dateString);



    return date.toLocaleDateString(
        "en-SG",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );


}