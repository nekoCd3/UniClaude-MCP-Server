window.STATE = {};

const ws = new WebSocket("ws://localhost:3000");
ws.binaryType = "arraybuffer";

ws.onmessage = (msg)=>{
handleFrame(msg.data);
};

STATE.ws = ws;
