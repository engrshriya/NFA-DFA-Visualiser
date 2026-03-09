function runConversion(){

let states = document.getElementById("states").value.split(",");
let alphabet = document.getElementById("alphabet").value.split(",");
let start = document.getElementById("start").value;
let finalStates = document.getElementById("final").value.split(",");

let transitionsText = document.getElementById("transitions").value.split("\n");

let transitions = {};

transitionsText.forEach(line=>{

let parts=line.split("=");

let left=parts[0].split(",");
let right=parts[1].split(",");

let state=left[0];
let symbol=left[1];

if(!transitions[state]) transitions[state]={};

transitions[state][symbol]=right;

});

drawNFA(states,transitions);

let dfaStates=[];
let unprocessed=[];

let startSet=[start];

dfaStates.push(startSet);
unprocessed.push(startSet);

let dfaTransitions={};

while(unprocessed.length>0){

let current=unprocessed.shift();

let name=current.join("");

dfaTransitions[name]={};

alphabet.forEach(symbol=>{

let newSet=[];

current.forEach(s=>{

if(transitions[s] && transitions[s][symbol]){

transitions[s][symbol].forEach(n=>{

if(!newSet.includes(n)) newSet.push(n);

});

}

});

newSet.sort();

let newName=newSet.join("");

dfaTransitions[name][symbol]=newName;

if(newName && !dfaStates.some(x=>x.join("")===newName)){

dfaStates.push(newSet);
unprocessed.push(newSet);

}

});

}

displayTable(dfaTransitions,alphabet);
drawDFA(dfaTransitions,finalStates);

}

function displayTable(dfaTransitions,alphabet){

let text="DFA Transition Table\n\n";

for(let state in dfaTransitions){

text+=state+" : ";

alphabet.forEach(a=>{

text+=a+" → "+dfaTransitions[state][a]+"   ";

});

text+="\n";

}

document.getElementById("output").innerText=text;

}

function drawNFA(states,transitions){

let nodes=[];
let edges=[];

states.forEach(s=>{
nodes.push({id:s,label:s});
});

for(let state in transitions){

for(let symbol in transitions[state]){

transitions[state][symbol].forEach(dest=>{

edges.push({
from:state,
to:dest,
label:symbol,
arrows:"to"
});

});

}

}

let container=document.getElementById("nfaGraph");

new vis.Network(container,{nodes:nodes,edges:edges},{});

}

function drawDFA(dfaTransitions,finalStates){

let nodes=[];
let edges=[];

for(let state in dfaTransitions){

nodes.push({id:state,label:state});

for(let symbol in dfaTransitions[state]){

edges.push({
from:state,
to:dfaTransitions[state][symbol],
label:symbol,
arrows:"to"
});

}

}

let container=document.getElementById("dfaGraph");

new vis.Network(container,{nodes:nodes,edges:edges},{});

}