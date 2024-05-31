const express = require("express");
const sendMail = require("../utils/sendmail");
const router = new express.Router();

router.post("/contact-us", async (req, res) => {
  try {
    const { adIdAccountId,name,email,contactReason ,description,subject:sub } = req.body;
    const subject='New Query: Contact us form'
    const to="support@borrowbe.com"
    const html=`
    <div>
            <p>
                <strong>Name:&nbsp;&nbsp;</strong>
                <span>${name}</span>
            </p>
            <p>
                <strong>Email:&nbsp;&nbsp;</strong>
                <span>${email}</span>
            </p>
            <p>
                <strong>Subject:&nbsp;&nbsp;</strong>
                <span>${sub}</span>
            </p>
            <p>
                <strong>Contact Reason:&nbsp;&nbsp;</strong>
                <span>${contactReason}</span>
            </p><p>
                <strong>Description:&nbsp;&nbsp;</strong>
                <span>${description}</span>
            </p>
            <p>
                <strong>Ad/Account ID:&nbsp;&nbsp;</strong>
                <span>${adIdAccountId}</span>
            </p>
    </div>
    `
    sendMail({to,subject,html})

    res.json({ data: "request submitted successfully" });
  } catch (error) {
    res.status(500).send({ error: "Error submit query" });
  }
});

module.exports = router;
