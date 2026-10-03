// 하늘 배경: 고정 캔버스 하나에 WebGL1 셰이더(라이브러리 없음). 밤 = 오로라 띠 3개 + 별, 낮 = 노을 그라디언트 + 흐르는 구름.
// 색·세기 상한·해상도는 빌드가 data.js 에 넣은 window.TWOSKY_SKY(src/config.mjs)에서 받는다.
// 세기 상한: 오로라(또는 구름) 세기 합을 min(합, 1.0) 으로 자르고 u_max 를 곱해 바탕과 섞는다 → 글자 대비 계산의 최악값을 넘지 않는다.
// 디버그: ?sky-t=<초> 그 시각에 멈춤. window.__sky.state() / sample(x, y).
(function () {
  var S = window.TWOSKY_SKY;
  var canvas = document.getElementById('sky');
  if (!S || !canvas) return;
  var root = document.documentElement;
  var reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var fixed = new URLSearchParams(location.search).get('sky-t');
  fixed = fixed !== null && isFinite(parseFloat(fixed)) ? parseFloat(fixed) : null;
  var state = { mode: 'off', theme: root.getAttribute('data-theme'), t: fixed !== null ? fixed : S.stillTime, webgl: false };
  window.__sky = { state: function () { return { mode: state.mode, theme: state.theme, t: state.t, webgl: state.webgl }; }, sample: function () { return null; } };

  var gl = null;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) { canvas.classList.add('off'); return; }

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
  var FRAG = [
    'precision mediump float;',
    'uniform vec2 u_res;uniform float u_time;uniform float u_day;',
    'uniform vec3 u_nb0;uniform vec3 u_nb1;uniform vec3 u_a0;uniform vec3 u_a1;uniform vec3 u_a2;uniform float u_max;',
    'uniform vec3 u_d0;uniform vec3 u_d1;uniform vec3 u_d2;uniform vec3 u_cloud;uniform float u_dmax;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
    ' return mix(mix(h(i),h(i+vec2(1.0,0.0)),u.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return v;}',
    'float band(float x,float y,float k,float t){',
    ' float c=0.74-0.13*k+0.07*sin(x*1.2+t*0.06*(k+1.0)+k*2.0)+0.12*(fbm(vec2(x*0.7+k*3.1,t*0.025))-0.5);',
    ' float d=y-c;float w=d>0.0?exp(-d*d/(0.018+0.01*k)):exp(-d*d/0.0016);',
    ' return w*(0.55+0.45*fbm(vec2(x*7.0+k*5.0,t*0.04+y*0.6)));}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/u_res;float asp=u_res.x/u_res.y;float x=uv.x*asp;float t=u_time;',
    // 밤
    ' vec3 nb=mix(u_nb1,u_nb0,uv.y);',
    ' float w0=band(x,uv.y,0.0,t),w1=band(x,uv.y,1.0,t),w2=band(x,uv.y,2.0,t);float sw=w0+w1+w2;',
    ' vec3 ac=(u_a0*w0+u_a1*w1+u_a2*w2)/max(sw,1e-4);',
    ' vec3 night=mix(nb,ac,min(sw,1.0)*u_max);',
    ' vec2 g=gl_FragCoord.xy/u_res.y*90.0;vec2 cell=floor(g);vec2 sp=cell+0.2+0.6*vec2(h(cell),h(cell+7.3));',
    ' float on=step(0.72,h(cell+3.1));float tw=0.55+0.45*sin(t*(1.0+2.0*h(cell))+h(cell)*6.28);',
    ' float star=on*tw*smoothstep(0.09,0.0,length(g-sp))*(1.0-min(sw,1.0))*smoothstep(0.15,0.6,uv.y);',
    ' night+= (vec3(1.0)-night)*star*0.8;',
    // 낮
    ' vec3 dg=uv.y>0.45?mix(u_d1,u_d0,(uv.y-0.45)/0.55):mix(u_d2,u_d1,uv.y/0.45);',
    ' float c=fbm(vec2(x*1.4+t*0.018,uv.y*3.2-t*0.004))+0.35*fbm(vec2(x*4.0-t*0.03,uv.y*7.0));',
    ' float cl=smoothstep(0.62,1.0,c)*smoothstep(0.05,0.55,uv.y);',
    ' vec3 day=mix(dg,u_cloud,min(cl,1.0)*u_dmax);',
    ' gl_FragColor=vec4(mix(night,day,u_day),1.0);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
  var prog = vs && fs && gl.createProgram();
  if (prog) { gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); }
  if (!prog || !gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.classList.add('off'); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['u_res', 'u_time', 'u_day', 'u_nb0', 'u_nb1', 'u_a0', 'u_a1', 'u_a2', 'u_max', 'u_d0', 'u_d1', 'u_d2', 'u_cloud', 'u_dmax']
    .forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
  function rgb(hex) { var v = parseInt(hex.slice(1), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; }
  var N = S.night, D = S.day;
  gl.uniform3fv(U.u_nb0, rgb(N.base[0])); gl.uniform3fv(U.u_nb1, rgb(N.base[1]));
  gl.uniform3fv(U.u_a0, rgb(N.aurora[0])); gl.uniform3fv(U.u_a1, rgb(N.aurora[1])); gl.uniform3fv(U.u_a2, rgb(N.aurora[2]));
  gl.uniform1f(U.u_max, N.max);
  gl.uniform3fv(U.u_d0, rgb(D.base[0])); gl.uniform3fv(U.u_d1, rgb(D.base[1])); gl.uniform3fv(U.u_d2, rgb(D.base[2]));
  gl.uniform3fv(U.u_cloud, rgb(D.cloud)); gl.uniform1f(U.u_dmax, D.max);
  state.webgl = true;

  var dayMix = state.theme === 'day' ? 1 : 0, dayFrom = dayMix, dayTo = dayMix, fadeStart = 0;
  function size() {
    var k = Math.min(window.devicePixelRatio || 1, S.dprMax) * S.renderScale;
    var w = Math.max(1, Math.round(innerWidth * k)), hgt = Math.max(1, Math.round(innerHeight * k));
    if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); }
  }
  function draw() {
    size();
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_time, state.t);
    gl.uniform1f(U.u_day, dayMix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function still() { return fixed !== null || reduce.matches; }

  var raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    if (state.mode !== 'running') return;
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    state.t += dt * S.speed;
    if (dayMix !== dayTo) {
      var k = Math.max(0, Math.min((now - fadeStart) / S.fadeMs, 1)); // 첫 rAF 시각이 fadeStart보다 이를 수 있다
      dayMix = dayFrom + (dayTo - dayFrom) * k;
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  function update() {
    var mode = still() ? 'still' : document.hidden ? 'paused' : 'running';
    if (mode === 'still') { if (fixed !== null) state.t = fixed; else if (state.mode !== 'still') state.t = S.stillTime; dayMix = dayTo; draw(); }
    state.mode = mode;
    if (mode === 'running' && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  }

  new MutationObserver(function () {
    var theme = root.getAttribute('data-theme');
    if (theme === state.theme) return;
    state.theme = theme;
    dayFrom = dayMix; dayTo = theme === 'day' ? 1 : 0; fadeStart = performance.now();
    if (state.mode !== 'running') { dayMix = dayTo; draw(); }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  // 컨텍스트를 잃으면 검은 캔버스가 남지 않게 숨기고 CSS 하늘로 돌아간다
  canvas.addEventListener('webglcontextlost', function () {
    state.mode = 'off'; state.webgl = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    canvas.classList.add('off');
  });
  document.addEventListener('visibilitychange', function () { if (state.mode !== 'off') update(); });
  if (reduce.addEventListener) reduce.addEventListener('change', function () { if (state.mode !== 'off') update(); });
  var pending = false;
  addEventListener('resize', function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; if (state.mode !== 'running') draw(); });
  });

  // 검증용: 지금 화면 그대로 한 프레임을 그려 (CSS 좌표) 지점의 3×3 중앙값 색을 돌려준다(별 점 하나를 빼기 위해).
  window.__sky.sample = function (cx, cy) {
    draw();
    var k = canvas.width / innerWidth;
    var x = Math.round(cx * k), y = Math.round(canvas.height - cy * k);
    var px = new Uint8Array(9 * 4);
    gl.readPixels(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var ch = [0, 1, 2].map(function (c) { var v = []; for (var i = 0; i < 9; i++) v.push(px[i * 4 + c]); v.sort(function (a, b) { return a - b; }); return v[4]; });
    return ch;
  };
  update();
})();
