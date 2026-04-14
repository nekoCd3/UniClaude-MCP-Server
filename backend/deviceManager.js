function getDevices(){
return [
{ id:"adb-1", name:"Android Device", type:"adb", screen:"scrcpy" },
{ id:"fb-1", name:"Fastboot Device", type:"fastboot" },
{ id:"cam-1", name:"Security Camera", type:"camera", screen:"rtsp" }
];
}

module.exports = { getDevices };
