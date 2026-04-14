const grid = document.getElementById("grid");

let dragged;

document.querySelectorAll(".tile").forEach(t=>{

t.addEventListener("dragstart",e=>{
dragged = e.target;
});

t.addEventListener("dragover",e=>{
e.preventDefault();
});

t.addEventListener("drop",e=>{
e.preventDefault();
if(dragged){
grid.insertBefore(dragged,e.target);
}
});

});
