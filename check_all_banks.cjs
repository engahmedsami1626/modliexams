const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(file,name){const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),c);return c.window[name]}
const en=load('bank.js','MODLI_BANK'),fr=load('fr-bank.js','MODLI_FR_BANK');
const levels=['A1','A2','B1','B2','C1','C2'],allIds=new Set();
for(const [label,bank,count] of [['English',en,1500],['French',fr,500]]){
 for(const kind of ['reading','listening']){
  const list=bank[kind];if(list.length!==count)throw Error(`${label}/${kind}: ${list.length}, expected ${count}`);
  if(new Set(list.map(q=>q.passage)).size!==count)throw Error(`${label}/${kind}: duplicate source passages found`);
  if(label==='French'&&kind==='listening'&&new Set(list.map(q=>q.transcript)).size!==count)throw Error('Duplicate French audio transcripts found');
  for(const q of list){
   if(allIds.has(q.id))throw Error(`Duplicate question ID: ${q.id}`);allIds.add(q.id);
   if(q.options.length!==4||new Set(q.options).size!==4||q.answer<0||q.answer>3)throw Error(`Invalid answer options: ${q.id}`);
   if(!q.passage.includes(q.options[q.answer]))throw Error(`Correct option not in source: ${q.id}`);
   if(q.language!==(label==='French'?'fr':'en'))throw Error(`Missing/incorrect language tag: ${q.id}`);
   if(kind==='listening'&&label==='French'){
    if(!q.transcript||!q.audio||!q.transcript.includes('\n'))throw Error(`French dialogue data missing: ${q.id}`);
    if(q.audio!==`audio/fr/${q.id}.mp3`)throw Error(`Audio path mismatch: ${q.id}`);
   }
  }
  for(const level of levels){const n=list.filter(q=>q.level===level).length;if(label==='English'&&n!==250)throw Error(`${label}/${kind}/${level}: ${n}`);if(label==='French'&&n!==(['A1','A2','B1','B2'].includes(level)?84:82))throw Error(`${label}/${kind}/${level}: ${n}`)}
  console.log(`${label} ${kind}: ${list.length} unique questions; level distribution verified.`)
 }
}
if(allIds.size!==4000)throw Error(`Expected 4,000 unique question IDs, got ${allIds.size}`);
console.log('Total bank: 4,000 questions with unique IDs across English and French.');
if(process.argv.includes('--audio')){
 const listening=fr.listening;
 for(const q of listening){const p=path.join(__dirname,q.audio);if(!fs.existsSync(p)||fs.statSync(p).size<1000)throw Error(`Missing or invalid audio file: ${q.audio}`)}
 const files=fs.readdirSync(path.join(__dirname,'audio','fr')).filter(x=>x.endsWith('.mp3'));
 if(files.length!==500)throw Error(`Expected 500 French MP3 files, found ${files.length}`);
 console.log('All 500 referenced French MP3 assets exist and are non-empty.');
}
