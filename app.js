(()=>{
 const $=id=>document.getElementById(id),home=$('home').parentElement,exam=$('exam'),result=$('result');
 let questions=[],answers=[],index=0,score=0,answered=false,wrong=[],attempted=0,timerHandle=null,secondsLeft=20,playToken=0,selectedLanguage=null;
 const letters=['A','B','C','D'],levelNames={ALL:'كل المستويات',A1:'مبتدئ',A2:'أساسي',B1:'متوسط',B2:'فوق المتوسط',C1:'متقدم',C2:'إتقان'};
 const languageNames={en:'الإنجليزية',fr:'الفرنسية'};
 const questionBank=()=>[...MODLI_BANK.reading,...MODLI_BANK.listening,...MODLI_FR_BANK.reading,...MODLI_FR_BANK.listening];
 // Show only the spoken dialogue, not speaker labels or listening instructions.
 function spokenScript(q){
   const source=q.transcript||q.passage||'';
   return source.split(/\r?\n/).map(line=>{
     const colon=line.indexOf(':');
     return colon>=0?line.slice(colon+1).trim():'';
   }).filter(Boolean).join('\n');
 }

 function stopTimer(){if(timerHandle){clearInterval(timerHandle);timerHandle=null}}
 function cancelAudio(){playToken++;if('speechSynthesis'in window)speechSynthesis.cancel();const player=$('audio-player');player.pause();try{player.currentTime=0}catch{}player.onended=null;player.onerror=null;}
 function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
 function bankForSelectedLevel(){return questionBank().filter(q=>q.language===selectedLanguage&&($('level').value==='ALL'||q.level===$('level').value))}
 function updateCount(){
   const kind=$('kind').value,mixed=kind==='mixed',count=+$('count').value;
   $('count').disabled=false;$('count-label').textContent=`${count} سؤالًا`;
   $('count-range-hint').innerHTML='<span>10</span><span>100</span>';
   if(!selectedLanguage){$('available').textContent='اختر اللغة أولًا لعرض عدد الأسئلة المتاحة.';$('start').disabled=true;return}
   const pool=bankForSelectedLevel(),listening=pool.filter(q=>q.kind==='listening').length,reading=pool.filter(q=>q.kind==='reading').length;
   if(mixed){const half=count/2;$('available').textContent=`امتحان من ${count} سؤالًا: ${half} استماع + ${half} قراءة. بنك ${languageNames[selectedLanguage]} يوفّر ${listening} استماع و${reading} قراءة لهذا المستوى.`;$('start').disabled=listening<half||reading<half}
   else{const available=kind==='listening'?listening:reading;$('available').textContent=`متاح ${available.toLocaleString('en-US')} سؤالًا في بنك ${languageNames[selectedLanguage]} بحسب اختياراتك.`;$('start').disabled=available<count}
 }
 function chooseLanguage(language){selectedLanguage=language;$('level').value='ALL';$('kind').value='mixed';$('count').value='20';$('language-choices').classList.add('hidden');$('setup').classList.remove('hidden');$('setup-eyebrow').textContent=`اختبارات ${languageNames[language]}`;updateCount()}
 $('count').addEventListener('input',updateCount);$('level').addEventListener('change',updateCount);$('kind').addEventListener('change',updateCount);$('choose-en').onclick=()=>chooseLanguage('en');$('choose-fr').onclick=()=>chooseLanguage('fr');$('change-language').onclick=()=>{selectedLanguage=null;$('setup').classList.add('hidden');$('language-choices').classList.remove('hidden');updateCount()};updateCount();
 $('start').onclick=()=>{
   const language=selectedLanguage,level=$('level').value,kind=$('kind').value,count=+$('count').value;
   const pool=questionBank().filter(q=>q.language===language&&(level==='ALL'||q.level===level));
   if(kind==='mixed'){
     const half=count/2;
     const listening=shuffle(pool.filter(q=>q.kind==='listening')).slice(0,half);
     const reading=shuffle(pool.filter(q=>q.kind==='reading')).slice(0,half);
     questions=[...listening,...reading];
   }else questions=shuffle(pool.filter(q=>q.kind===kind)).slice(0,count);
   answers=Array(questions.length).fill(null);index=0;score=0;attempted=0;wrong=[];$('score').textContent=0;
   home.classList.add('hidden');result.classList.add('hidden');exam.classList.remove('hidden');
   const examLanguage=languageNames[language],listeningCount=questions.filter(q=>q.kind==='listening').length,readingCount=questions.filter(q=>q.kind==='reading').length;
   $('exam-badge').textContent=`${examLanguage} · ${levelNames[level]} · ${kind==='mixed'?`${listeningCount} استماع + ${readingCount} قراءة`:kind==='reading'?'قراءة فقط':'استماع فقط'}`;
   $('exam-title').textContent=`تدريب ${examLanguage}`;$('exam-total').textContent=questions.length;$('exam-listening').textContent=listeningCount;$('exam-reading').textContent=readingCount;$('exam-total-count').textContent=questions.length;$('exam-solved').textContent='0';render();
 };
 $('finish').onclick=()=>showResult(true);
 function renderQuestionMap(){
   const nav=$('question-nav');nav.innerHTML='';
   questions.forEach((q,i)=>{
     const button=document.createElement('button'),record=answers[i];button.type='button';button.className='question-nav-item';button.textContent=i+1;
     if(q.kind==='listening')button.classList.add('nav-listening');else button.classList.add('nav-reading');
     if(record)button.classList.add(record.correct?'solved-correct':'solved-wrong');if(i===index)button.classList.add('current');
     button.setAttribute('aria-label',`السؤال ${i+1}، ${q.kind==='listening'?'استماع':'قراءة'}، ${record?(record.correct?'منجز، صحيح':'منجز، غير صحيح'):'غير منجز'}`);
     button.setAttribute('aria-current',i===index?'step':'false');button.onclick=()=>{if(i!==index){index=i;render()}};nav.appendChild(button);
   });
   $('exam-solved').textContent=answers.filter(Boolean).length;
 }
 function render(){
   stopTimer();cancelAudio();const q=questions[index],record=answers[index];answered=Boolean(record);secondsLeft=20;
   $('progress-text').textContent=`السؤال ${index+1} من ${questions.length}`;$('progress-bar').style.width=`${((index+1)/questions.length)*100}%`;
   $('question-type').textContent=q.kind==='reading'?'قراءة · Reading':'استماع · Listening';$('question-level').textContent=q.level;$('question').textContent=q.question;
   const ltr=q.language==='fr'||q.language==='en';$('question').dir=ltr?'ltr':'rtl';$('question').style.textAlign=ltr?'left':'right';
   $('passage').textContent=q.kind==='listening'?spokenScript(q):q.passage;$('passage').dir=ltr?'ltr':'rtl';$('passage').style.textAlign=ltr?'left':'right';$('passage').classList.toggle('hidden',q.kind==='listening');
   $('toggle-transcript').textContent='▤ إظهار النص';$('toggle-transcript').setAttribute('aria-expanded','false');
   $('audio-controls').classList.toggle('hidden',q.kind!=='listening');$('timer-box').classList.add('hidden');$('timer-box').classList.remove('urgent');$('timer-value').textContent='20';$('timer-bar').style.width='100%';
   $('audio-status').textContent=q.language==='fr'?'اضغط «بدء الاستماع» لتشغيل المقطع الفرنسي المسجل.':'اضغط «بدء الاستماع»؛ سيبدأ المؤقّت بعد انتهاء الصوت.';$('play-audio').textContent='▶ بدء الاستماع';$('play-audio').disabled=answered;$('stop-audio').disabled=true;
   $('options').innerHTML='';q.options.forEach((text,i)=>{const b=document.createElement('button');b.className='option';b.innerHTML=`<span class="letter">${letters[i]}</span><span></span>`;b.querySelector('span:last-child').textContent=text;b.dir=ltr?'ltr':'rtl';b.disabled=answered||q.kind==='listening';b.onclick=()=>choose(i);if(record&&i===q.answer)b.classList.add('correct');if(record&&i===record.chosen&&!record.correct)b.classList.add('wrong');$('options').appendChild(b)});
   if(record){
     $('feedback').className='feedback '+(record.correct?'good':'bad');const title=record.timedOut?'انتهى الوقت':record.correct?'إجابة صحيحة ✓':'إجابة غير صحيحة';$('feedback').innerHTML=`<strong>${title}</strong><p></p>`;$('feedback').querySelector('p').textContent=`${q.language==='fr'?'Bonne réponse':'الإجابة الصحيحة'}: ${q.options[q.answer]}. ${q.explanation}`;$('answered-hint').textContent=record.correct?'أحسنت، الإجابة صحيحة.':record.timedOut?'انتهى وقت هذا السؤال؛ يمكنك المتابعة.':'راجع الإجابة الصحيحة قبل المتابعة.';
   }else{$('feedback').className='feedback hidden';$('feedback').innerHTML='';$('answered-hint').textContent=q.kind==='listening'?'ابدأ الاستماع عندما تكون جاهزًا.':'اختر إجابة واحدة للمتابعة.'}
   $('next').disabled=!answered;$('next').textContent=index===questions.length-1?'عرض النتيجة':'السؤال التالي ←';renderQuestionMap();
 }
 function startTimer(){
   if(answers[index])return;stopTimer();secondsLeft=20;$('timer-box').classList.remove('hidden');$('timer-value').textContent=secondsLeft;$('timer-bar').style.width='100%';
   $('audio-status').textContent='انتهى المقطع. لديك 20 ثانية للإجابة.';$('answered-hint').textContent='الوقت بدأ؛ اختر إجابتك قبل وصوله إلى صفر.';
   document.querySelectorAll('.option').forEach(b=>b.disabled=false);
   timerHandle=setInterval(()=>{secondsLeft=Math.max(0,secondsLeft-1);$('timer-value').textContent=secondsLeft;$('timer-bar').style.width=`${secondsLeft*5}%`;if(secondsLeft<=5)$('timer-box').classList.add('urgent');if(secondsLeft===0){stopTimer();choose(null)}},1000);
 }
 function audioFailure(q,message){$('toggle-transcript').textContent='▤ إخفاء النص';$('toggle-transcript').setAttribute('aria-expanded','true');$('passage').textContent=spokenScript(q);$('passage').dir='ltr';$('passage').style.textAlign='left';$('passage').classList.remove('hidden');$('audio-status').textContent=message;$('play-audio').disabled=false;$('stop-audio').disabled=true;startTimer()}
 function playEnglish(q,token){
   if('speechSynthesis'in window&&!speechSynthesis.getVoices().length){
     let started=false;const go=()=>{if(started)return;started=true;speechSynthesis.onvoiceschanged=null;playEnglishNow(q,token)};
     speechSynthesis.onvoiceschanged=go;setTimeout(go,1500);return;
   }
   playEnglishNow(q,token);
 }
 function playEnglishNow(q,token){
   if(!('speechSynthesis'in window)){audioFailure(q,'الصوت غير متاح في هذا المتصفح؛ يظهر النص ويبدأ وقت الإجابة.');return}
   const voices=speechSynthesis.getVoices(),locale=q.lang||'en-GB',prefix=locale.slice(0,2).toLowerCase(),matching=voices.filter(v=>v.lang.toLowerCase().startsWith(prefix));
   if(!matching.length){audioFailure(q,'لا يوجد صوت إنجليزي محلي على هذا الجهاز؛ يظهر النص ويبدأ وقت الإجابة.');return}
   const voiceA=matching.find(v=>/natural|enhanced|premium/i.test(v.name))||matching.find(v=>v.lang.toLowerCase().includes('gb'))||matching[0];
   const voiceB=matching.find(v=>v!==voiceA&&/natural|enhanced|premium/i.test(v.name))||matching.find(v=>v!==voiceA)||voiceA;
   const lines=q.passage.split('\n').filter(line=>line.includes(':'));if(!lines.length){audioFailure(q,'تعذّر العثور على نص الحوار؛ يظهر النص وتبدأ مدة الإجابة.');return}
   let lineIndex=0;const playNext=()=>{if(token!==playToken)return;if(lineIndex>=lines.length){$('play-audio').disabled=false;$('stop-audio').disabled=true;$('play-audio').textContent='↻ استمع مرة أخرى';startTimer();return}
     const currentLine=lineIndex,line=lines[lineIndex++],colon=line.indexOf(':'),text=line.slice(colon+1).trim(),utterance=new SpeechSynthesisUtterance(text);
     utterance.lang=voiceA.lang||locale;utterance.rate=+$('speed').value;utterance.pitch=currentLine===1?1.02:.96;utterance.voice=currentLine===1?voiceB:voiceA;
     utterance.onend=()=>setTimeout(playNext,260);utterance.onerror=event=>{if(event.error!=='canceled'&&token===playToken)audioFailure(q,'تعذّر تشغيل الصوت؛ يظهر نص الحوار وتبدأ مدة الإجابة.')};speechSynthesis.speak(utterance);
   };playNext();
 }
 function playListening(){
   const q=questions[index];if(!q||q.kind!=='listening'||answered)return;
   stopTimer();cancelAudio();document.querySelectorAll('.option').forEach(b=>b.disabled=true);$('timer-box').classList.add('hidden');$('play-audio').disabled=true;$('stop-audio').disabled=false;$('audio-status').textContent='يُشغّل المقطع…';const token=playToken;
   if(q.language==='fr'){
     const player=$('audio-player');player.src=q.audio;player.currentTime=0;player.playbackRate=+$('speed').value;
     player.onended=()=>{if(token!==playToken)return;$('play-audio').disabled=false;$('stop-audio').disabled=true;$('play-audio').textContent='↻ استمع مرة أخرى';startTimer()};
     player.onerror=()=>{if(token===playToken)audioFailure(q,'تعذّر تحميل المقطع؛ يظهر نص الحوار وتبدأ مدة الإجابة.')};
     player.play().catch(()=>{if(token===playToken)audioFailure(q,'تعذّر تشغيل المقطع؛ يظهر نص الحوار وتبدأ مدة الإجابة.')});
   }else playEnglish(q,token);
 }
 function stopListening(){const q=questions[index];if(!q||q.kind!=='listening')return;stopTimer();cancelAudio();$('play-audio').disabled=false;$('play-audio').textContent='▶ استمع مجددًا';$('stop-audio').disabled=true;$('timer-box').classList.add('hidden');document.querySelectorAll('.option').forEach(b=>b.disabled=true);$('audio-status').textContent='تم إيقاف المقطع. اضغط «استمع مجددًا» لإعادة تشغيله من البداية.';$('answered-hint').textContent='المقطع متوقف؛ أعد تشغيله عندما تكون جاهزًا.';}
 $('toggle-transcript').onclick=()=>{const q=questions[index];if(!q||q.kind!=='listening')return;const isHidden=$('passage').classList.toggle('hidden');$('toggle-transcript').textContent=isHidden?'▤ إظهار النص':'▤ إخفاء النص';$('toggle-transcript').setAttribute('aria-expanded',String(!isHidden))};
 $('play-audio').onclick=playListening;$('replay-audio').onclick=playListening;$('stop-audio').onclick=stopListening;
 function choose(chosen){
   if(answered)return;answered=true;stopTimer();cancelAudio();attempted++;
   const q=questions[index],correct=chosen===q.answer;answers[index]={chosen,correct,timedOut:chosen===null};if(correct)score++;else wrong.push({q,chosen,timedOut:chosen===null});$('score').textContent=score;
   document.querySelectorAll('.option').forEach((b,i)=>{b.disabled=true;if(i===q.answer)b.classList.add('correct');if(i===chosen&&!correct)b.classList.add('wrong')});
   $('feedback').className='feedback '+(correct?'good':'bad');const title=chosen===null?'انتهى الوقت':correct?'إجابة صحيحة ✓':'إجابة غير صحيحة';$('feedback').innerHTML=`<strong>${title}</strong><p></p>`;$('feedback').querySelector('p').textContent=`${q.language==='fr'?'Bonne réponse':'الإجابة الصحيحة'}: ${q.options[q.answer]}. ${q.explanation}`;$('next').disabled=false;$('answered-hint').textContent=correct?'أحسنت، الإجابة صحيحة.':chosen===null?'انتهى وقت هذا السؤال؛ يمكنك المتابعة.':'راجع الإجابة الصحيحة قبل المتابعة.';renderQuestionMap();
 }
 $('next').onclick=()=>{if(!answered)return;if(index<questions.length-1){index++;render()}else showResult(false)};
 function showResult(manual){stopTimer();cancelAudio();exam.classList.add('hidden');home.classList.add('hidden');result.classList.remove('hidden');const pct=attempted?Math.round(score/attempted*100):0;$('final-score').textContent=`${score}/${attempted}`;$('result-title').textContent=manual?'أنهيت الامتحان':pct>=85?'ممتاز! أداء رائع':pct>=60?'أحسنت! واصل التقدم':'خطوة جيدة، استمر في التدريب';$('result-message').textContent=`أجبت عن ${attempted} من أصل ${questions.length} سؤالًا؛ ${score} إجابة صحيحة. ${manual&&attempted<questions.length?'تم إنهاء الامتحان قبل اكتمال جميع الأسئلة.':''}`;try{localStorage.setItem('modliLastResult',JSON.stringify({score,answered:attempted,total:questions.length,pct,date:new Date().toISOString()}))}catch{}$('review-list').classList.add('hidden');$('review-list').innerHTML='';}
 $('again').onclick=()=>{result.classList.add('hidden');home.classList.remove('hidden')};$('home-button').onclick=()=>{result.classList.add('hidden');home.classList.remove('hidden');selectedLanguage=null;$('setup').classList.add('hidden');$('language-choices').classList.remove('hidden');updateCount()};
 $('review').onclick=()=>{const box=$('review-list');box.classList.toggle('hidden');if(box.classList.contains('hidden'))return;box.innerHTML='';if(!wrong.length){box.textContent='لا توجد إجابات خاطئة. عمل ممتاز!';return}wrong.forEach(({q,chosen,timedOut})=>{const d=document.createElement('div');d.className='review-item';const h=document.createElement('strong');h.textContent=`${q.id} · ${q.language==='fr'?'Français':'English'} · ${q.level} · ${timedOut?'لم تتم الإجابة':`إجابتك: ${q.options[chosen]}`}`;const p=document.createElement('p');p.textContent=`${q.question} — ${q.language==='fr'?'Bonne réponse':'الإجابة الصحيحة'}: ${q.options[q.answer]}`;d.append(h,p);box.appendChild(d)})};
})();
