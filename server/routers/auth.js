const express = require("express");
const router = new express.Router();
const { User } = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sendMail = require("../utils/sendmail");
require("dotenv").config();
const errors = require("../utils/errors.json");
const createAvatar = require("../utils/createAvatar");
const generateID = require("../utils/generateID");
const { uploadImage } = require("../AWS");
const memo = require("../memo");
const { default: axios } = require("axios");
const createEmailHtml = require("../utils/createEmailHtml");

router.post("/register", async (req, res) => {
  //get the fields
  const { firstName, lastName, email, password } = req.body;

  //check if empty
  if (!firstName || !email || !password)
    return res.status(400).send({ error: errors["all-fields-required"] });

  //check if duplicate
  const exists = await User.findOne({ email });
  if (exists)
    return res.status(400).send({ error: errors["user-already-exists"] });

  //hash password
  const hash = await bcrypt.hash(password, 12);

  //create profile picture
  const avatar = createAvatar(firstName + " " + lastName);

  //create user
  const user = new User({
    customerID: await generateID("C"),
    email,
    firstName,
    lastName,
    password: hash,
    image: await uploadImage(avatar),
  });
  await user.save();

  //create token
  const verificationToken = jwt.sign(
    { email, id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  sendMail({
    from: "noreply@borrowbe.com",
    to: email,
    subject: "Verify your email address",
    html: createEmailHtml({
      content: `<p>Hey ${user.firstName},
      please use the link provided below to verify your email address and
      start using Borrowbe.
    </p>
    <a href="${process.env.BASE_URL}/api/auth/verify?token=${verificationToken}">verify account</a>
    <p>This link is valid for an hour.</p>`,
      heading: "Verify your email address",
    }),
  });

  res.status(201).send({
    info: "user created successfully",
  });
});

router.get("/verify", async (req, res) => {
  // check if token exists
  const token = req.query.token;
  if (!token)
    return res.status(401).send({ error: errors["no-token-provided"] });

  //verify token
  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).send({ error: errors["invalid-token"] });
  }
  if (!verified)
    return res.status(401).send({ error: errors["invalid-token"] });

  // set user as verified
  const user = await User.findOne({ _id: verified.id });
  if (user.verified) return res.redirect(process.env.FRONTEND_URI + "/");
  user.verified = true;
  await user.save();

  //create authorization token
  const authorizationToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  //set auth cookie
  res.cookie("auth", authorizationToken);

  sendMail({
    from: "noreply@borrowbe.com",
    to: user.email,
    subject: "Welcome to Borrowbe!",
    html: createEmailHtml({
      content: `<h3>Hey ${user?.firstName},</h3>

      <h3>Thank you for joining our community.</h3>
      
      <h4>We're excited to have you here. To kickstart your BorrowBe journey, here are some quick steps to help you get the most out of our platform:</h4>
      
     <p>Complete your profile: Share a bit about yourself and your location with the community.</p>
      <p>Explore ads: Discover a wide range of listings tailored to your needs, from rentals to services.</p>
      <p>Post ads: Share your offerings with our community to expand your reach.</p>
      <p>Chat with users: Connect with fellow members through our chat feature for any queries or a friendly chat.</p>
      <p>Manage your ads: Easily keep track of your listings and make changes as needed.</p>
      <p>We're here to support you at every turn. If you have any questions or need assistance, feel free to reach out to our support team.</p>
      
      
      <h4>Happy searching and posting!</h4>
      
      
     <p> Best regards,\n
      Community Manager</p>`,
      heading: `Welcome to Borrowbe! Your One-Stop Marketplace for Rentals, Leases, Financing, and Services`,
    }),
  });
  //redirect
  res.redirect(process.env.FRONTEND_URI + "/verified");
});

router.post("/login", async (req, res) => {
  //get the fields
  const { email, password, isMobileApp } = req.body;

  //check if empty
  if (!email || !password)
    return res.status(400).send({ error: errors["email-pass-required"] });

  //find user
  const user = await User.findOne({ email });
  if (!user) return res.status(401).send({ error: errors["user-not-found"] });

  //check if verified
  if (!user.verified)
    return res.status(401).send({ error: errors["not-verified"] });

  //check if under lockdown
  if (user.accountLocked)
    return res.status(401).send({ error: errors["account-locked"] });

  //check password
  const isMatch = await bcrypt.compare(password, user.password);
  //increase risk in case of wrong password and send error
  if (!isMatch) {
    user.authenticationRisk += 1;
    await user.save();
    if (user.authenticationRisk >= 5) {
      //initiate account lockdown
      user.accountLocked = true;
      await user.save();
      return res.status(401).send({ error: errors["account-locked"] });
    }
    return res.status(401).send({ error: errors["wrong-password"] });
  }

  if (isMatch) {
    user.authenticationRisk = 0;
    await user.save();
  }
  //create token
  const authorizationToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    }
  );

  if (isMobileApp) {
    return res.status(200).send({
      token: authorizationToken,
    });
  } else {
    //set auth cookie
    res.cookie("auth", authorizationToken, {
  "secure": true, 
        "path": "/", 
        "httpOnly": true, 
        "hostOnly": true, 
        "sameSite": false, 
       "domain":"dev-api.borrowbe.com"
});
    //send data
    res.status(200).send(user);
  }
});

router.get("/me", async (req, res) => {
  //get token
  const token = req?.cookies?.auth || req?.headers["mobile-token"]; // get token from cookie or header
  //check if empty
  if (!token)
    return res.status(401).send({ error: errors["no-token-provided"] });

  //verify token
  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).send({ error: errors["invalid-token"] });
  }
  if (!verified)
    return res.status(401).send({ error: errors["invalid-token"] });

  //find user
  const user = await User.findOne({ _id: verified.id });

  if (!user) return res.status(401).send({ error: errors["user-not-found"] });

  //initiate account lockdown
  if (user.authenticationRisk >= 5) {
    user.accountLocked = true;
    await user.save();
    return res.status(401).send({ error: errors["account-locked"] });
  }

  res
    .status(200)
    .send({ ...user._doc, password: user?.password ? true : false });
});

router.get("/forgot-password/:email", async (req, res) => {
  //hget email from params
  const email = req.params.email;
  //find the user
  const user = await User.findOne({ email });
  //error if not found
  if (!user) return res.status(401).send({ error: errors["user-not-found"] });
  //create verification token
  const verificationToken = jwt.sign(
    { email, id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  sendMail({
    from: "noreply@borrowbe.com",
    to: email,
    subject: "Reset your Borrowbe password",
    html: createEmailHtml({
      content: `<p>Hey ${user.firstName},
      please use the link provided below to reset your password.
    </p>
    <a href="${process.env.BASE_URL}/reset-password?token=${verificationToken}">reset password</a>
    <p>This link is valid for an hour.</p>
    <p class="light">*Ignore this email if you didn't request to reset your password*</p>`,
      heading: "Reset your Borrowbe password",
    }),
  });

  res.send({ info: "Acknowledged" });
});

router.post("/reset-password", async (req, res) => {
  const password = req.body.password;
  const token = req.body.token;
  //checking if the values exist
  if (!token || !password)
    return res.status(400).send({ error: errors["all-filed-required"] });
  //verify token
  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).send({ error: errors["invalid-token"] });
  }
  if (!verified)
    return res.status(401).send({ error: errors["invalid-token"] });

  //find user
  const user = await User.findOne({ _id: verified.id });
  if (!user) return res.status(401).send({ error: errors["user-not-found"] });
  //checking if user is verified
  if (!user.verified) return res.redirect(process.env.FRONTEND_URI + "/verify");

  //check if password is different from old password
  const isMatch = await bcrypt.compare(password, user.password);
  if (isMatch)
    return res.status(400).send({ error: errors["duplicate-password-reset"] });
  //hash password
  const hash = await bcrypt.hash(password, 12);

  //update password
  user.password = hash;
  await user.save();

  //clear lockdown
  if (user.accountLocked) {
    user.accountLocked = false;
    user.authenticationRisk = 0;
    await user.save();
  }

  res.send({ info: "Password reset successful" });
});

router.get("/logout", async (req, res) => {
  const token = req?.cookies?.auth || req?.headers["mobile-token"]; // get token from cookie or header
  //check if empty
  if (!token)
    return res.status(401).send({ error: errors["no-token-provided"] });

  // remove deviceToken if mobile-token is present
  // if (req?.headers["mobile-token"]) {
  //   const user = await User.findOne({ _id: verified.id });
  //   user.deviceToken = null;
  //   await user.save();
  // }

  //verify token
  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).send({ error: errors["invalid-token"] });
  }
  if (!verified)
    return res.status(401).send({ error: errors["invalid-token"] });

  //find user
  const user = await User.findOne({ _id: verified.id }).lean();

  memo.setInactive(user?._id);
  res.clearCookie("auth");

  res.send({ info: "Logged out" });
});
router.get("/google", (req, res) => {
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}` +
    `&response_type=code` +
    `&scope=email profile`;
  res.redirect(process.env.FRONTEND_URI + authUrl);
});
router.get("/google/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }
    );

    const { access_token, id_token } = tokenResponse.data;

    const decoded = jwt.decode(id_token);
    if (decoded.emal_verified == false)
      return res.status(400).send("Could not authenticate google account");
    let user = await User?.findOne({ email: decoded.email });
    if (user && user?._id) {
      const authorizationToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "30d",
        }
      );
      res.cookie("auth", authorizationToken);
      //send data
      return res.redirect(process.env.FRONTEND_URI + "/");
    }
    user = new User({
      customerID: await generateID("C"),
      email: decoded.email,
      firstName: decoded.given_name,
      lastName: decoded.family_name,
      verified: true,
      image: decoded.picture,
    });
    await user.save();
    const authorizationToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      {
        expiresIn: "30d",
      }
    );
    res.cookie("auth", authorizationToken);
    //send data
    return res.redirect(process.env.FRONTEND_URI + "/");
  } catch (error) {
    console.error(
      "Error exchanging authorization code for access token:",
      error.message
    );
    res.status(500).send("Failed to authenticate using Google.");
  }
});
router.get("/facebook", (req, res) => {
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${process.env.FACEBOOK_REDIRECT_URI}&scope=email&response_type=code&state=qfouihqewubqewui`;

  res.redirect(process.env.FRONTEND_URI + authUrl);
});

router.get("/facebook/callback", async (req, res) => {
  const { code } = req.query;

  const accessTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token`;
  const params = {
    client_id: process.env.FACEBOOK_APP_ID,
    client_secret: process.env.FACEBOOK_APP_SECRET,
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
    code,
  };

  try {
    // Exchange code for access token
    const response = await fetch(
      `${accessTokenUrl}?${querystring.stringify(params)}`
    );
    const data = await response.json();

    // Fetch user profile using access token
    const profileUrl = `https://graph.facebook.com/me?fields=id,name,email&access_token=${data.access_token}`;
    const profileResponse = await fetch(profileUrl);
    const profileData = await profileResponse.json();

    // Redirect user after successful authentication
    res.redirect(process.env.FRONTEND_URI + "/");
  } catch (error) {
    console.error("Facebook authentication error:", error);
    res.status(500).json({ error: "Failed to authenticate with Facebook" });
  }
});
module.exports = router;
