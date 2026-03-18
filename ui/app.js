console.log("APP.JS LOADED");
alert("JS Loaded");

const form = document.getElementById("reportForm");
const resultDiv = document.getElementById("result");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const week_start = document.getElementById("week_start").value;
    const week_end = document.getElementById("week_end").value;
    const job_contacts_count = Number(document.getElementById("job_contacts").value);

    const job_contacts = Array.from({ length: job_contacts_count }, (_, index) => ({
        id: index + 1
    }));

    const payload = {
        week_start,
        week_end,
        job_contacts
    };

    try {
        const response = await fetch("http://localhost:3000/validate-weekly-report", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("API Response:", data);

        resultDiv.classList.remove("hidden", "success", "error");

        if (response.ok) {
            resultDiv.classList.add("success");
            resultDiv.innerHTML = `
                <h3>Validation Passed</h3>
                <p>${data.message}</p>
            `;
        } else {
            resultDiv.classList.add("error");
            resultDiv.innerHTML = `
                <h3>Validation Failed</h3>
                <p>${data.message}</p>
                <ul>
                    ${(data.errors || []).map(error => `<li>${error}</li>`).join("")}
                </ul>
            `;
        }
    } catch (error) {
        resultDiv.classList.remove("hidden", "success");
        resultDiv.classList.add("error");
        resultDiv.innerHTML = `
            <h3>Request Failed</h3>
            <p>Could not connect to the CareerOps API.</p>
        `;
    }
});