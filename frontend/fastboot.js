async function flash(){
let bar = document.getElementById("progress");
let p = 0;

let i = setInterval(()=>{
p += 5;
bar.style.width = p + "%";
if(p>=100) clearInterval(i);
},100);
}
