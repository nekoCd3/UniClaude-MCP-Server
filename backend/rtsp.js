const { spawn } = require("child_process");

function start(ws,url){

const ffmpeg = spawn("ffmpeg", [
"-i", url,
"-f", "mpegts",
"-codec:v", "mpeg1video",
"-"
]);

ffmpeg.stdout.on("data",(chunk)=>{
ws.send(chunk);
});

}

module.exports = { start };
