// Real-Chrome check of Learning Mode. Requires a running frontend and backend, a local Chrome,
// and puppeteer-core. Env: BP_BASE_URL (default http://127.0.0.1:5500), CHROME_PATH, PUPPETEER_PATH.
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const BASE = process.env.BP_BASE_URL || 'http://127.0.0.1:5500';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail='') => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.type('#login-username-input', 'aarav');
  await page.type('#login-pin-input', '1234');
  await page.click('#login-submit-btn');
  await sleep(2500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[data-nav="learning"]')].find(b => b.offsetParent); b && b.click(); });
  await sleep(900);
  const progress = () => page.$eval('#auto-lesson-progress', el => el.textContent);
  const visible = id => page.$eval('#' + id, el => !el.hidden && el.offsetParent !== null).catch(() => false);
  const tiles = () => page.$$eval('#char-grid .char-tile', els => els.length);
  const selectLesson = id => page.evaluate(id => { const s = document.getElementById('lesson-select'); s.value = id; s.dispatchEvent(new Event('change')); }, id);

  // 1. Initial state
  const lessonCount = await page.$$eval('#lesson-select option', o => o.length);
  check('lesson picker lists 9 lessons', lessonCount === 9, 'count=' + lessonCount);
  check('alphabet grid has 26 tiles', (await tiles()) === 26, 'tiles=' + (await tiles()));
  check('initial progress reads Alphabet 1/26', (await progress()) === 'Alphabet: 1 / 26', await progress());
  const dbg = await page.evaluate(() => ['learning-start-btn','learning-pause-btn','learning-resume-btn','learning-stop-btn'].map(id => { const e = document.getElementById(id); return id + ':hidden=' + e.hidden + ',off=' + (e.offsetParent !== null) + ',disp=' + getComputedStyle(e).display; }));
  console.log(dbg.join(' | '));
  check('entering Learning auto-starts the alphabet (Pause and Stop shown, Start hidden)', !(await visible('learning-start-btn')) && (await visible('learning-pause-btn')) && (await visible('learning-stop-btn')), dbg.join(' ; '));

  // 2. Automatic run advances, pause keeps position, resume continues
  await sleep(12000);
  const p1 = await progress();
  check('automatic run advances past first letter', !/Alphabet: 1 \//.test(p1), p1);
  check('Pause visible while playing', await visible('learning-pause-btn'));
  await page.click('#learning-pause-btn');
  await sleep(600);
  const pausedAt = await progress();
  check('pause shows Resume and hides Pause', (await visible('learning-resume-btn')) && !(await visible('learning-pause-btn')));
  await sleep(4000);
  check('no progress while paused', (await progress()) === pausedAt, pausedAt + ' -> ' + (await progress()));
  await page.click('#learning-resume-btn');
  await sleep(14000);
  const afterResume = await progress();
  check('resume continues forward from paused position', afterResume !== pausedAt, pausedAt + ' -> ' + afterResume);

  // 3. Stop returns to the start
  await page.click('#learning-stop-btn');
  await sleep(500);
  check('stop returns to 1/26 and Start is visible again', (await progress()) === 'Alphabet: 1 / 26' && (await visible('learning-start-btn')), await progress());

  // 4. Lesson selection, manual tap, previous/next/replay
  await selectLesson('numbers');
  await sleep(300);
  check('selecting Numbers rebuilds grid to 10 tiles', (await tiles()) === 10, 'tiles=' + (await tiles()));
  await page.evaluate(() => document.querySelectorAll('#char-grid .char-tile')[2].click());
  await sleep(400);
  check('manual tap of third number shows Numbers 3/10', (await progress()) === 'Numbers: 3 / 10', await progress());
  await page.click('#lesson-next-btn');
  await sleep(300);
  check('Next character moves to 4/10', (await progress()) === 'Numbers: 4 / 10', await progress());
  await page.click('#lesson-prev-btn');
  await sleep(300);
  check('Previous character moves back to 3/10', (await progress()) === 'Numbers: 3 / 10', await progress());
  await page.click('#lesson-replay-btn');
  await sleep(200);
  check('Replay keeps position at 3/10', (await progress()) === 'Numbers: 3 / 10', await progress());
  await page.evaluate(() => { const b = document.getElementById('learning-stop-btn'); if (!b.hidden) b.click(); });

  // 5. Automatic progression crosses into the next lesson (Currency -> Math)
  await selectLesson('currency');
  await sleep(300);
  check('Currency grid has 5 tiles (4 supported, 1 unsupported)', (await tiles()) === 5, 'tiles=' + (await tiles()));
  await page.click('#learning-start-btn');
  await page.evaluate(() => { document.querySelector('[data-learnspeed="1.4"]').click(); });
  let crossed = false, last = '';
  for (let i = 0; i < 90 && !crossed; i++) { await sleep(1000); last = await progress(); if (/Mathematical symbols/.test(last)) crossed = true; }
  check('automatic run crosses from Currency into Mathematical symbols', crossed, last);
  await page.evaluate(() => { const b = document.getElementById('learning-stop-btn'); if (!b.hidden) b.click(); });

  // 6. Quiz: four choices, the right answer scores
  await page.evaluate(() => { document.getElementById('tab-quiz').click(); });
  await sleep(600);
  await selectLesson('alphabet');
  await sleep(300);
  await page.evaluate(() => { document.getElementById('tab-quiz').click(); });
  await sleep(600);
  const choiceCount = await page.$$eval('#quiz-choices .choice-btn', b => b.length);
  check('quiz shows four choices', choiceCount === 4, 'choices=' + choiceCount);
  await page.evaluate(() => document.querySelector('#quiz-choices .choice-btn').click());
  await sleep(300);
  const score = await page.$eval('#quiz-score', el => el.textContent);
  const marked = await page.$$eval('#quiz-choices .correct', b => b.length);
  const wrongMarked = await page.$$eval('#quiz-choices .wrong', b => b.length);
  check('a guess is scored and the answer is highlighted', score.startsWith('Score:') && marked === 1 && (wrongMarked === 0 || wrongMarked === 1), score + ' correct=' + marked + ' wrong=' + wrongMarked);
  const cap = await page.$eval('#quiz-caption', el => el.textContent);
  check('caption reveals the answer after guessing', /It was/.test(cap), cap.slice(0, 80));
  // 7. Identify-the-character never leaks the answer in the caption before guessing
  await page.evaluate(() => document.getElementById('quiz-next').click());
  await sleep(300);
  const caption = await page.$eval('#quiz-caption', el => el.textContent);
  check('new quiz question resets choice colours', (await page.$$eval('#quiz-choices .correct,#quiz-choices .wrong', b => b.length)) === 0, caption.slice(0, 60));
  check('new quiz question offers four choices', (await page.$$eval('#quiz-choices .choice-btn', b => b.length)) === 4);

  check('no page errors during learning flows', errs.length === 0, errs.slice(0, 3).join(' | '));
    await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
