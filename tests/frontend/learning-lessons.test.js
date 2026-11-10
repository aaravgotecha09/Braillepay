'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../../js/braille-map.js');
const L = require('../../js/learning-lessons.js');

// The learning controller plays upper-case labels with their lower-case letter cell (teachingKey).
const teachKey = ch => (/^[A-Z]$/.test(ch) ? ch.toLowerCase() : ch);

test('lesson order covers every lesson exactly once and every id resolves', () => {
  assert.equal(new Set(L.LESSON_ORDER).size, L.LESSON_ORDER.length);
  for (const id of L.LESSON_ORDER) assert.ok(L.LESSONS[id], id);
  for (const id of Object.keys(L.LESSONS)) {
    if (id === 'uppercase') continue;   // taught as a demonstration lesson, not in the automatic order
    assert.ok(L.LESSON_ORDER.includes(id), `${id} missing from LESSON_ORDER`);
  }
});

test('the automatic order matches the prompt: alphabet, numbers, punctuation, special symbols', () => {
  assert.deepEqual(L.LESSON_ORDER.slice(0, 4), ['alphabet', 'numbers', 'punctuation', 'symbols']);
});

test('every lesson has items and an explanation', () => {
  for (const lesson of Object.values(L.LESSONS)) {
    assert.ok(lesson.items.length > 0, lesson.id);
    assert.ok(lesson.explain && lesson.explain.length > 10, lesson.id);
  }
});

test('every supported item has a Braille pattern, and every unsupported item says why', () => {
  for (const lesson of Object.values(L.LESSONS)) {
    for (const item of lesson.items) {
      if (item.kind === 'word') {
        for (const ch of item.text) {
          assert.ok(B.getCells(teachKey(ch)) !== null, `${lesson.id}: word "${item.text}" letter ${ch}`);
        }
        continue;
      }
      if (item.unsupported) {
        assert.equal(B.getCells(item.text), null, `${lesson.id}: ${item.text} should be unsupported`);
        assert.ok(B.unsupportedReason(item.text).length > 0, `${lesson.id}: ${item.text} needs a reason`);
      } else {
        assert.ok(B.getCells(teachKey(item.text)) !== null, `${lesson.id}: ${item.text} has no pattern`);
      }
    }
  }
});

test('no lesson teaches a character as supported that the map rejects', () => {
  const taught = Object.values(L.LESSONS).flatMap(l => l.items).filter(i => i.kind === 'char' && !i.unsupported);
  for (const item of taught) {
    assert.ok(B.isSupported(teachKey(item.text)), item.text);
  }
});

test('the rupee, multiplication, plus-minus and not-equal signs are listed as unsupported, not drawn', () => {
  const unsupportedLabels = Object.values(L.LESSONS).flatMap(l => l.items).filter(i => i.unsupported).map(i => i.text).sort();
  assert.deepEqual(unsupportedLabels, ['×', '±', '≠', '₹'].sort());
});

test('planFrom starts at the chosen lesson and runs to the end in order', () => {
  const plan = L.planFrom('numbers').map(l => l.id);
  assert.deepEqual(plan, L.LESSON_ORDER.slice(L.LESSON_ORDER.indexOf('numbers')));
  assert.equal(L.planFrom('unknown-lesson')[0].id, 'alphabet');
});

test('flatten gives one ordered run with lesson position information', () => {
  const steps = L.flatten([L.LESSONS.numbers, L.LESSONS.punctuation]);
  assert.equal(steps.length, L.LESSONS.numbers.items.length + L.LESSONS.punctuation.items.length);
  assert.equal(steps[0].lessonId, 'numbers');
  assert.equal(steps[0].index, 0);
  assert.equal(steps[steps.length - 1].lessonId, 'punctuation');
});

test('next and previous move one step and stop at the ends', () => {
  assert.equal(L.nextIndex(0, 3), 1);
  assert.equal(L.nextIndex(1, 3), 2);
  assert.equal(L.nextIndex(2, 3), -1);       // finished
  assert.equal(L.prevIndex(2), 1);
  assert.equal(L.prevIndex(0), 0);           // never below zero
});

test('quiz question: four distinct choices including the answer, from the same lesson', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 25; k++) {
    const q = L.quizQuestion('alphabet', rnd);
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.answer.label));
  }
});

test('quiz question never offers an unsupported item as a choice', () => {
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 25; k++) {
    const q = L.quizQuestion('currency', rnd);
    assert.ok(q, 'currency lesson has enough supported items');
    assert.ok(!q.choices.includes('₹'));
  }
});

test('a lesson too small for four choices returns null rather than a broken question', () => {
  assert.equal(L.quizQuestion('no-such-lesson'), null);
});
