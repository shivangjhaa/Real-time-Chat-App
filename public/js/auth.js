const poolData = {
  UserPoolId: "ap-south-1_zkpv1rOQe",
  ClientId: "7pj8j65ttl3aoqeuthu1cguakv"
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

function signUp(email, password) {
  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "email",
      Value: email
    })
  ];

  userPool.signUp(email, password, attributeList, null, (err, result) => {
    if (err) return alert(err.message || JSON.stringify(err));
    alert("Signup successful. Check your email for verification code.");
  });
}

function login(email, password) {
  const authData = {
    Username: email,
    Password: password
  };

  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);

  const userData = {
    Username: email,
    Pool: userPool
  };

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  cognitoUser.authenticateUser(authDetails, {
    onSuccess: function (result) {
      const token = result.getIdToken().getJwtToken();
      localStorage.setItem("token", token);
      localStorage.setItem("email", email);
      window.location.href = "/chat.html";
    },
    onFailure: function (err) {
      alert(err.message || JSON.stringify(err));
    }
  });
}