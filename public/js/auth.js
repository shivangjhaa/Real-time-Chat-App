/**
 * auth.js — AWS Cognito: signup → confirm → login
 */

const poolData = {
  UserPoolId: "ap-south-1_zkpv1rOQe",
  ClientId:   "7jba75ak4gs48c4uoa0s7c3bho"
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

/**
 * Step 1 — Sign up. On success, caller should show the confirm modal.
 */
function signUp(email, password, callbacks = {}) {
  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({ Name: "email", Value: email })
  ];

  userPool.signUp(email, password, attributeList, null, (err, result) => {
    if (err) return (callbacks.onFailure || defaultFailure)(err);
    (callbacks.onSuccess || defaultSuccess)(result);
  });
}

/**
 * Step 2 — Confirm the account with the 6-digit code from email.
 */
function confirmSignUp(email, code, callbacks = {}) {
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool:     userPool
  });

  cognitoUser.confirmRegistration(code, true, (err, result) => {
    if (err) return (callbacks.onFailure || defaultFailure)(err);
    (callbacks.onSuccess || defaultSuccess)(result);
  });
}

/**
 * Step 3 — Login. Only works after confirmation.
 */
function login(email, password, callbacks = {}) {
  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: email,
    Password: password
  });

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool:     userPool
  });

  cognitoUser.authenticateUser(authDetails, {
    onSuccess(session) {
      localStorage.setItem("token", session.getIdToken().getJwtToken());
      localStorage.setItem("email", email);
      if (callbacks.onSuccess) callbacks.onSuccess(session);
      window.location.href = "/join.html";
    },
    onFailure(err) {
      // If user forgot to confirm and tries to log in again,
      // surface the confirm modal instead of showing a raw error.
      if (err.code === "UserNotConfirmedException") {
        if (callbacks.onNotConfirmed) callbacks.onNotConfirmed();
        return;
      }
      (callbacks.onFailure || defaultFailure)(err);
    },
    newPasswordRequired() {
      (callbacks.onFailure || defaultFailure)({
        message: "New password required. Please reset your password."
      });
    }
  });
}

/**
 * Resend the confirmation code (e.g. if it expired).
 */
function resendConfirmationCode(email, callbacks = {}) {
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool:     userPool
  });

  cognitoUser.resendConfirmationCode((err, result) => {
    if (err) return (callbacks.onFailure || defaultFailure)(err);
    (callbacks.onSuccess || defaultSuccess)(result);
  });
}

function defaultFailure(err) { alert(err.message || JSON.stringify(err)); }
function defaultSuccess(result) { console.log("Success", result); }