/*
 * BraillePay Learning Mode lesson catalogue (pure logic, no DOM).
 *
 * A lesson is an ordered list of items. An item is a character or a short word. Each item is
 * checked against js/braille-map.js by the tests, so a lesson can never teach a symbol that
 * has no verified pattern unless it is explicitly marked "unsupported" with an explanation.
 *
 * The automatic lesson plays lessons in the order of LESSON_ORDER. Manual learning works on
 * the item list of the selected lesson.
 *
 * Exposes window.BraillePayLessons (and module.exports under Node).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.BraillePayLessons = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  function chars(list) {
    return list.map(function (c) { return { label: c, text: c, kind: 'char' }; });
  }
  function words(list) {
    return list.map(function (w) { return { label: w, text: w, kind: 'word' }; });
  }
  function unsupported(list) {
    return list.map(function (c) { return { label: c, text: c, kind: 'char', unsupported: true }; });
  }

  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var DIGITS = '0123456789'.split('');

  /* Order used by the automatic lesson. "revision" is built from mastered items and is not in this list. */
  var LESSON_ORDER = ['alphabet', 'numbers', 'punctuation', 'symbols', 'currency', 'math', 'upi', 'words', 'payment'];

  var LESSONS = {
    alphabet: {
      id: 'alphabet', title: 'Alphabet', level: 'basic',
      explain: 'Letters a to z. Each capital letter is taught by its lower-case cell.',
      items: chars(ALPHABET)
    },
    uppercase: {
      id: 'uppercase', title: 'Capital letters', level: 'intermediate',
      explain: 'A capital letter is the capital sign (dot 6) followed by the letter cell.',
      items: chars(ALPHABET)  // played with the capital sign by the controller
    },
    numbers: {
      id: 'numbers', title: 'Numbers', level: 'basic',
      explain: 'A number is written with the number sign (dots 3-4-5-6) and then the letters a to j.',
      items: chars(DIGITS)
    },
    punctuation: {
      id: 'punctuation', title: 'Punctuation', level: 'basic',
      explain: 'Common punctuation marks.',
      items: chars([',', '.', '?', '!', ';', ':', "'", '-', '"'])
    },
    symbols: {
      id: 'symbols', title: 'Special symbols', level: 'intermediate',
      explain: 'Symbols used in addresses, code and forms.',
      items: chars(['@', '&', '#', '%', '_', '/', '\\', '*', '=', '<', '>', '+', '(', ')', '[', ']', '{', '}', '|', '~', '^', '`'])
    },
    currency: {
      id: 'currency', title: 'Currency symbols', level: 'intermediate',
      explain: 'Currency signs used in amounts. The rupee sign has no verified pattern yet, so it is shown as unsupported.',
      items: chars(['$', '€', '£', '¢']).concat(unsupported(['₹']))
    },
    math: {
      id: 'math', title: 'Mathematical symbols', level: 'advanced',
      explain: 'Operators. The multiplication, plus-minus and not-equal signs have no verified pattern, so they are shown as unsupported.',
      items: chars(['+', '*', '=', '<', '>', '÷', '≤', '≥']).concat(unsupported(['×', '±', '≠']))
    },
    upi: {
      id: 'upi', title: 'Common UPI characters', level: 'intermediate',
      explain: 'The characters in a UPI ID such as name@bank. The @ sign is two cells.',
      items: chars(['@', '.', '_', '-']).concat(chars(DIGITS))
    },
    words: {
      id: 'words', title: 'Basic words', level: 'advanced',
      explain: 'Short words, written in uncontracted Grade 1 Braille. Each letter is played in order.',
      items: words(['cash', 'bank', 'pay', 'send', 'code', 'scan', 'safe', 'help'])
    },
    payment: {
      id: 'payment', title: 'Payment vocabulary', level: 'advanced',
      explain: 'Words you will hear and read in the payment flow.',
      items: words(['pay', 'send', 'receive', 'amount', 'balance', 'refund', 'merchant', 'receipt', 'upi'])
    }
  };

  /** Items of a lesson, or null for an unknown lesson. */
  function itemsOf(lessonId) {
    return LESSONS[lessonId] ? LESSONS[lessonId].items : null;
  }

  /** Lessons from `startId` onwards, in automatic order. Used by "start learning". */
  function planFrom(startId) {
    var i = LESSON_ORDER.indexOf(startId);
    if (i === -1) { i = 0; }
    return LESSON_ORDER.slice(i).map(function (id) { return LESSONS[id]; });
  }

  /** Flatten a list of lessons into one ordered run of steps. */
  function flatten(lessonList) {
    var steps = [];
    lessonList.forEach(function (lesson) {
      lesson.items.forEach(function (item, index) {
        steps.push({ lessonId: lesson.id, lessonTitle: lesson.title, index: index, total: lesson.items.length, item: item });
      });
    });
    return steps;
  }

  /** Index after one step forward, or -1 when the run is finished. */
  function nextIndex(i, length) {
    return i + 1 < length ? i + 1 : -1;
  }

  /** Index one step back, never below zero. */
  function prevIndex(i) {
    return i > 0 ? i - 1 : 0;
  }

  /**
   * Quiz question for a lesson: the item to identify plus three distractors from the same lesson.
   * `random` is injectable so the choice set can be tested deterministically.
   */
  function quizQuestion(lessonId, random) {
    var pool = (itemsOf(lessonId) || []).filter(function (it) { return !it.unsupported; });
    if (pool.length < 4) { return null; }
    var rnd = typeof random === 'function' ? random : Math.random;
    var answer = pool[Math.floor(rnd() * pool.length)];
    var others = pool.filter(function (it) { return it.label !== answer.label; });
    var choices = [answer];
    while (choices.length < 4 && others.length) {
      var k = Math.floor(rnd() * others.length);
      choices.push(others.splice(k, 1)[0]);
    }
    // Deterministic-enough shuffle (Fisher-Yates with the same random source).
    for (var i = choices.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = choices[i]; choices[i] = choices[j]; choices[j] = tmp;
    }
    return { answer: answer, choices: choices.map(function (c) { return c.label; }) };
  }

  return {
    LESSONS: LESSONS,
    LESSON_ORDER: LESSON_ORDER,
    itemsOf: itemsOf,
    planFrom: planFrom,
    flatten: flatten,
    nextIndex: nextIndex,
    prevIndex: prevIndex,
    quizQuestion: quizQuestion
  };
});
