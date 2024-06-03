const axios = require("axios");

const URL = process.env.ZENDESK_URL;
const AUTH = process.env.ZENDESK_AUTH;
const PASS = process.env.ZENDESK_KEY;
const TOKEN = Buffer.from(`${AUTH}:${PASS}`).toString("base64");

const headers = {
  "Content-Type": "application/json",
  Authorization: `Basic ${TOKEN}`,
};
module.exports = async function createZendeskTick({
  subject,
  html,
  name,
  email,
}) {
  try {
    let data = JSON.stringify({
      ticket: {
        comment: {
          html_body: html,
          public: false,
        },
        subject: subject,
        requester: {
          name,
          email,
        },
      },
    });
    await axios.post(`${URL}/api/v2/tickets`, data, { headers });
  } catch (error) {
    console.log("Create Zendesk Tick Error ", error);
  }
};
