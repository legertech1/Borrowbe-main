const { default: axios } = require("axios");

const getFacebookAccessToken = async (code) => {
  const accessTokenUrl = `https://graph.facebook.com/v19.0/oauth_access_token`;

  const params = {
    client_id: process.env.FACEBOOK_APP_ID,
    client_secret: process.env.FACEBOOK_APP_SECRET,
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
    code,
  };

  try {
    const response = await axios.get(accessTokenUrl, { params });
    return response?.data?.access_token;
  } catch (error) {
    console.error("Error fetching Facebook access token:", error);
    throw new Error("Failed to fetch Facebook access token");
  }
};

const getFacebookUserData = async (accessToken) => {
  const { data } = await axios.get(`https://graph.facebook.com/me`, {
    params: {
      fields: "first_name,last_name,email,picture",
      access_token: accessToken,
    },
  });
  return data;
};

module.exports = { getFacebookUserData, getFacebookAccessToken };
