/* 自动出题：没有人工题目的篇目，按正文自动生成"补全句子 + 作者/朝代"两类题。
 * 浏览器与 Node 共用；结果只依赖篇目内容，因此每次生成的题序稳定。
 */
(function (root) {
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function splitClauses(line) {
    var parts = [], buf = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if ('，。！？；：'.indexOf(ch) >= 0) {
        parts.push({ text: buf, end: ch });
        buf = '';
      } else {
        buf += ch;
      }
    }
    if (buf) parts.push({ text: buf, end: '' });
    return parts;
  }

  function makeFill(line) {
    var parts = splitClauses(line);
    var idx = -1;
    for (var i = parts.length - 1; i >= 0; i--) {
      if (parts[i].text.length >= 3) { idx = i; break; }
    }
    if (idx < 0) return null;
    var t = parts[idx].text;
    var cut = Math.min(3, Math.max(2, Math.floor(t.length / 2)));
    if (t.length - cut < 1) cut = 1;
    var head = t.slice(0, t.length - cut);
    var answer = t.slice(t.length - cut);
    var stem = parts.map(function (p, k) {
      return k === idx ? head + '____' + p.end : p.text + p.end;
    }).join('');
    return { type: 'fill', stem: stem, answer: answer, auto: true };
  }

  var DYN_POOL = ['唐', '宋', '清', '汉', '先秦', '战国', '明', '元', '南朝', '北朝', '晋', '现代'];

  function pick(arr, seed, n, exclude) {
    var out = [];
    var len = arr.length;
    for (var i = 0; i < len && out.length < n; i++) {
      var v = arr[(seed + i * 7) % len];
      if (v && v !== exclude && out.indexOf(v) < 0) out.push(v);
    }
    return out;
  }

  function placed(correct, distractors, seed) {
    var opts = distractors.slice(0, 2);
    while (opts.length < 2) opts.push('—');
    var at = seed % 3;
    opts.splice(at, 0, correct);
    return { options: opts, answer: at };
  }

  function makeChoice(p, all) {
    var seed = hash(p.id || p.title);
    var anon = /^佚名/.test(p.author);
    var skipDynasty = p.kind === '蒙学' || p.dynasty === '古代' || p.dynasty === '民间';

    if (anon) {
      if (skipDynasty) return null;
      var dPool = DYN_POOL.filter(function (d) { return d !== p.dynasty; });
      var dOpts = pick(dPool, seed, 2, p.dynasty);
      var dRes = placed(p.dynasty, dOpts, seed);
      return {
        type: 'choice',
        stem: '《' + p.title + '》出自哪个朝代？',
        options: dRes.options,
        answer: dRes.answer,
        auto: true,
        explain: '《' + p.title + '》' + p.dynasty + '代作品。'
      };
    }

    var seen = { '': true };
    seen[p.author] = true;
    var pool = [];
    (all || []).forEach(function (q) {
      if (q && !seen[q.author] && !/^佚名/.test(q.author)) { seen[q.author] = true; pool.push(q.author); }
    });
    if (pool.length < 2) pool = pool.concat(['李白', '杜甫', '王维']);
    var opts = pick(pool, seed, 2, p.author);
    var res = placed(p.author, opts, seed);
    return {
      type: 'choice',
      stem: '《' + p.title + '》的作者是？',
      options: res.options,
      answer: res.answer,
      auto: true,
      explain: '《' + p.title + '》的作者是' + p.author + '（' + p.dynasty + '）。'
    };
  }

  function makeQuestions(p, all) {
    if (Array.isArray(p.questions) && p.questions.length >= 3) return p.questions;

    var qs = [];
    var seenStem = {};
    function addFill(line) {
      var f = makeFill(line);
      if (!f || seenStem[f.stem]) return;
      seenStem[f.stem] = true;
      f.explain = '出自《' + p.title + '》（' + p.dynasty + '·' + p.author + '）。';
      qs.push(f);
    }

    addFill(p.text[0]);
    if (p.text.length > 1) addFill(p.text[p.text.length - 1]);
    for (var i = 1; qs.length < 2 && i < p.text.length; i++) addFill(p.text[i]);

    var c = makeChoice(p, all);
    if (c) qs.push(c);
    return qs;
  }

  var API = { makeQuestions: makeQuestions, makeFill: makeFill, hash: hash };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.PoemQuiz = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
