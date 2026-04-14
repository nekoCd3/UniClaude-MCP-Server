let ws = new WebSocket("ws://localhost:3000");
ws.binaryType = "arraybuffer";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

let decoder = new VideoDecoder({
output(frame){
ctx.drawImage(frame,0,0,canvas.width,canvas.height);
},
error(e){console.log(e);}
});

ws.onmessage = (msg)=>{
const chunk = new Uint8Array(msg.data);

decoder.decode(new EncodedVideoChunk({
type:"key",
timestamp:performance.now(),
data:chunk
}));
};
