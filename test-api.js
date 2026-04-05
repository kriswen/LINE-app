const fetch = require("node-fetch");

async function testApi() {
    console.log("Testing without password...");
    let res = await fetch("http://localhost:3000/api/config");
    console.log("Status without password:", res.status); // Expect 401

    console.log("\nTesting with correct password '1234'...");
    res = await fetch("http://localhost:3000/api/config", {
        headers: { "x-admin-password": "1234" }
    });
    console.log("Status with password:", res.status); // Expect 200
    const data = await res.json();
    console.log("Data returned:", data.reminders ? "Yes, got reminders array" : "No reminders found");

    console.log("\nTesting POST to API...");
    res = await fetch("http://localhost:3000/api/config", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-password": "1234"
        },
        body: JSON.stringify(data)
    });
    console.log("POST Status:", res.status); // Expect 200
    const postData = await res.json();
    console.log("POST Response:", postData);
}

testApi();
