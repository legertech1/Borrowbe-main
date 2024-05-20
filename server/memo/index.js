let memo = {};
let users = {};
let verificationCodes = {};

module.exports = {
  find: (id) => {
    return memo[id];
  },
  insert: (id) => {
    if (!memo[id]) memo[id] = {};
  },
  delete: (id) => {
    delete memo[id];
  },
  replace: (a, b) => {
    memo[a] = memo[b];
    delete memo[b];
  },
  clear: () => {

    memo = {};
  },
  test: () => {
    return { memo, users, verificationCodes };
  },
  setActive: (a) => {
    users[a] = true;
  },
  check: (a) => users[a],
  setInactive: (a) => delete users[a],
  clearUsers: () => {

    users = {};
  },
  setVerificationCode: (u, v, subject, email) => {
    verificationCodes[u] = {
      ...verificationCodes[u],
      [subject]: {
        code: v,
        expiresAt: Date.now() + 3 * 60 * 1000,
        email,
      },
    };
  },
  getVerificationCode: (u) => {
    return verificationCodes[u] || {};
  },
  deleteVerificationCode: (u, subject) => {
    delete verificationCodes[u][subject];
  },
  clearVerificationCodes: () => {
    for (let vc in verificationCodes) {
      for (let v in vc) {
        if (v.expiresAt < Date.now()) delete v;
      }
      if (Object.keys(vc).length == 0) delete vc;
    }
    ("----------cleared verification codes ---------");
  },
};
