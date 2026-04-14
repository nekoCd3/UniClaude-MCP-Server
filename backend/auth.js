const tokens = new Map();

function login(deviceId){
const token = Math.random().toString(36).slice(2);
tokens.set(token, deviceId);
return token;
}

function verify(token){
return tokens.get(token);
}

module.exports = { login, verify };
