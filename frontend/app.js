let mode = "adb";

function setMode(m){
mode = m;
render();
}

function render(){
document.querySelectorAll(".device").forEach(d=>{
const t = d.dataset.type;

if(mode === "screen"){
d.style.display = (t==="adb"||t==="camera")?"block":"none";
}else{
d.style.display = (t===mode)?"block":"none";
}
});
}

render();
