(() => {
  const container = document.querySelector(".ascii-background-layer");
  const canvas = document.querySelector("#ascii-gradient-background");
  const gl = canvas?.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });

  if (!container || !canvas || !gl) return;

  const MAX_COLORS = 8;
  const MAX_CLICKS = 4;
  const MAX_TRAIL = 24;
  const CLICK_LIFE = 1.2;
  const TRAIL_LIFE = 0.7;
  const TRAIL_STEP = 0.015;
  const INTRO_SECONDS = 2.4;
  const ATLAS_CELL_W = 60;
  const ATLAS_CELL_H = 100;
  const ATLAS_COLUMNS = 16;
  const FONT_SCALE = 0.78;

  const settings = {
    colors: ["#1e3fd8", "#f6f8ff", "#a5d8ff", "#38bdf8"],
    characters: " malcuth",
    cellSize: 18,
    density: 0.8,
    glyphOpacity: 0.85,
    glow: 0.2,
    depthOfField: 0,
    flicker: 0.2,
    softness: 0.5,
    scale: 1,
    flow: 0.5,
    speed: 1,
    gradientOpacity: 0.9,
    grain: 0.08,
    variation: 0,
    scrambleRadius: 0.1,
    fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  };

  const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const COMMON = `
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
`;

  const FIELD = `#version 300 es
precision highp float;
precision highp int;
uniform float uAspect;
uniform float uTime;
uniform int uShape;
uniform vec3 uRamp[8];
uniform int uCount;
uniform float uScale;
uniform float uSoftness;
uniform float uFlow;
uniform vec2 uSeed;
uniform vec4 uTrail[24];
uniform float uRadius;
uniform vec4 uClicks[4];
uniform int uClickEffect;
uniform float uIntro;
uniform float uFrame;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outAux;
${COMMON}
vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy) * 2.0 - 1.0;
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i), f);
  float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 labToRgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 horizon(vec2 p, float time, out float order) {
  float span = 0.5 * max(uAspect, 1.0);
  float x = p.x / span;
  float arch = -0.17 - 0.2 * x * x + 0.02 * sin(time * 0.6);
  float soft = mix(0.05, 0.22, uSoftness);
  float edge = p.y - arch;
  float rim = 0.38 * smoothstep(-soft, 0.42, edge);
  vec2 sun = vec2(0.08 * sin(time * 0.31) * span, 0.58);
  float spread = length((p - sun) / vec2(0.95 * span, 0.75));
  float sky = mix(0.55, 1.0, smoothstep(0.2, 0.95, spread));
  order = clamp(edge * 1.3, 0.0, 1.0);
  return vec3(rim, sky, smoothstep(0.18, 0.62, edge));
}

vec4 tone(float t) {
  float x = smoothstep(0.3, 1.0, t) * float(uCount - 1);
  int index = int(floor(x));
  return vec4(mix(uRamp[index], uRamp[min(index + 1, uCount - 1)], fract(x)), smoothstep(0.0, 0.38, t));
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float time = uTime;
  vec2 q = p / uScale;
  vec2 warp = vec2(
    noise(q * 1.6 + uSeed + vec2(0.0, time * 0.3)),
    noise(q * 1.6 + uSeed.yx + vec2(4.3, -time * 0.24))
  ) - 0.5;
  q += warp * uFlow * 0.18;
  float order = 0.0;
  vec3 shape = horizon(q, time, order);

  float reveal = clamp((uIntro * 1.45 - order) / 0.45, 0.0, 1.0);
  reveal = reveal * reveal * (3.0 - 2.0 * reveal);

  float scramble = 0.0;
  for (int i = 0; i < 24; i++) {
    vec4 point = uTrail[i];
    if (point.z <= 0.0) continue;
    vec2 d = p - point.xy;
    scramble = max(scramble, point.z * exp(-dot(d, d) / (uRadius * uRadius)));
  }
  for (int i = 0; i < 4; i++) {
    vec4 c = uClicks[i];
    if (c.w <= 0.0) continue;
    float d = length(p - c.xy);
    scramble = max(scramble, exp(-pow((d - c.z * 0.75) / 0.06, 2.0)) * c.w);
  }

  vec2 t = clamp(shape.xy * mix(0.7, 1.0, reveal), 0.0, 1.0);
  vec4 mixed = mix(tone(t.x), tone(t.y), shape.z);
  vec3 color = encode(labToRgb(mixed.rgb));
  float alpha = mixed.a * reveal;
  float dither = (hash12(gl_FragCoord.xy + uFrame * 13.7) - 0.5) / 255.0;
  outColor = clamp(vec4(color * alpha + dither, alpha + dither), 0.0, 1.0);
  outAux = vec4(reveal, scramble, 0.0, 1.0);
}`;

  const GLYPHS = `
uniform sampler2D uField;
uniform sampler2D uAux;
uniform sampler2D uAtlas;
uniform vec2 uResolution;
uniform vec2 uCell;
uniform vec2 uOffset;
uniform vec2 uAtlasGrid;
uniform float uCount;
uniform float uDensity;
uniform float uOpacity;
uniform float uFlicker;
uniform float uDepth;
uniform float uGlyphTime;
uniform float uSeedValue;
uniform float uLight;
${COMMON}
float sampleGlyph(float index, vec2 local, vec2 coord, float soft) {
  float column = mod(index, uAtlasGrid.x);
  float row = floor(index / uAtlasGrid.x);
  vec2 atlasUv = vec2((column + local.x) / uAtlasGrid.x, (row + 1.0 - local.y) / uAtlasGrid.y);
  vec2 continuous = coord / uAtlasGrid;
  float scale = exp2(soft);
  return textureGrad(uAtlas, atlasUv, dFdx(continuous) * scale, dFdy(continuous) * scale).a;
}

vec4 glyphAt(vec2 px) {
  vec2 coord = (px - uOffset) / uCell;
  vec2 cell = floor(coord);
  vec2 local = coord - cell;
  vec2 uv = clamp(((cell + 0.5) * uCell + uOffset) / uResolution, vec2(0.0), vec2(1.0));
  vec4 field = texture(uField, uv);
  vec4 aux = texture(uAux, uv);
  vec3 visible = uLight > 0.5 ? field.rgb + (1.0 - field.a) : field.rgb;
  float luma = dot(visible, vec3(0.2126, 0.7152, 0.0722));
  float value = uLight > 0.5 ? clamp((1.0 - luma) * 1.5, 0.0, 1.0) : luma;
  float pick = hash12(cell + uSeedValue * 7.31);
  float level = hash12(cell * 1.73 + 4.1 + uSeedValue);
  float tick = floor(uGlyphTime * 9.0 + level * 9.0);
  float wobble = (hash12(cell * 2.31 + tick * 17.7) - 0.5) * uFlicker * 0.4 + (level - 0.5) * 0.1;
  float tone = clamp(pow(value, 0.75) + wobble, 0.0, 1.0);
  float index = floor(tone * (uCount - 1.0) + 0.5);
  float decode = max(aux.g, 1.0 - aux.r);
  if (decode > 0.02) {
    float frame = floor(uGlyphTime * 20.0);
    if (hash12(cell * 3.7 + frame * 5.3) < decode * 1.25) index = 1.0 + floor(hash12(cell + frame * 1.37) * (uCount - 1.0));
  }
  if (uCount >= 3.0) {
    float special = hash12(cell * 4.17 + floor(uGlyphTime * 2.2) * 9.73);
    if (special < 0.38) {
      index = hash12(cell * 8.23 + floor(uGlyphTime * 3.1) * 5.11) < 0.5 ? 1.0 : 2.0;
    }
  }
  float present = step(pick, uDensity * mix(1.0, 0.3 + tone * 1.1, 0.55));
  float cutoff = smoothstep(0.03, 0.1, value);
  float focus = step(hash12(cell * 0.71 + 9.2 + uSeedValue), uDepth);
  float coverage = sampleGlyph(index, local, coord, focus * 1.2);
  float alpha = uOpacity * present * cutoff * coverage * mix(1.0, 0.35 + 0.65 * level, 0.55) * (1.0 - focus * 0.5);
  if (uLight < 0.5) {
    vec3 light = field.rgb * 0.55 + vec3(0.03) * field.a;
    return vec4(light * alpha, 0.6 * field.a * alpha);
  }
  vec3 ink = visible * 0.8;
  return vec4(ink * alpha, alpha);
}`;

  const HALO = `#version 300 es
precision highp float;
uniform float uDownscale;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  outColor = glyphAt(gl_FragCoord.xy * uDownscale);
}`;

  const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.2270270270;
  sum += texture(uSource, vUv + uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv - uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv + uStep * 3.2307692308) * 0.0702702703;
  sum += texture(uSource, vUv - uStep * 3.2307692308) * 0.0702702703;
  outColor = sum;
}`;

  const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uHalo;
uniform float uGlow;
uniform float uGradient;
uniform float uGrain;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  vec4 base = texture(uField, vUv) * uGradient;
  vec4 glyph = glyphAt(gl_FragCoord.xy);
  vec4 halo = texture(uHalo, vUv) * uGlow;
  vec4 color = base + glyph + halo;
  float grain = (hash12(gl_FragCoord.xy + uFrame * vec2(17.0, 59.0)) + hash12(gl_FragCoord.xy * 1.31 + uFrame * 7.0) - 1.0) * uGrain;
  float body = clamp(color.a, 0.0, 1.0);
  color.rgb += grain * (0.25 + body) * 0.5;
  color.a = clamp(color.a, 0.0, 1.0);
  color.rgb = clamp(color.rgb, 0.0, color.a);
  outColor = color;
}`;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  };

  const link = (fragmentSource) => {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let index = 0; index < count; index += 1) {
      const info = gl.getActiveUniform(program, index);
      if (!info) continue;
      const name = info.name.replace(/\[0\]$/, "");
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
  };

  const fieldProgram = link(FIELD);
  const haloProgram = link(HALO);
  const blurProgram = link(BLUR);
  const compositeProgram = link(COMPOSITE);
  if (!fieldProgram || !haloProgram || !blurProgram || !compositeProgram) return;

  const createTarget = (count) => {
    const textures = Array.from({ length: count }, () => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texture;
    });
    return { textures, framebuffer: gl.createFramebuffer(), width: 0, height: 0 };
  };

  const sizeTarget = (target, width, height) => {
    if (target.width === width && target.height === height) return;
    target.width = width;
    target.height = height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    target.textures.forEach((texture, index) => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + index, gl.TEXTURE_2D, texture, 0);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const buildAtlas = () => {
    const list = [...new Set([...settings.characters].filter((character) => character !== "\n" && character !== "\r"))];
    if (!list.length) list.push(" ");
    const columns = Math.min(ATLAS_COLUMNS, list.length);
    const rows = Math.ceil(list.length / columns);
    const atlasCanvas = document.createElement("canvas");
    atlasCanvas.width = ATLAS_CELL_W * columns;
    atlasCanvas.height = ATLAS_CELL_H * rows;
    const context = atlasCanvas.getContext("2d");
    if (context) {
      context.font = `300 ${Math.round(ATLAS_CELL_H * FONT_SCALE)}px ${settings.fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#ffffff";
      list.forEach((character, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        context.fillText(
          character,
          column * ATLAS_CELL_W + ATLAS_CELL_W / 2,
          row * ATLAS_CELL_H + ATLAS_CELL_H / 2 + 3,
        );
      });
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { texture, count: list.length, grid: [columns, rows] };
  };

  const toLinear = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const toLab = ([r, g, b]) => {
    const lr = toLinear(r);
    const lg = toLinear(g);
    const lb = toLinear(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };

  const parseColor = (hex) => {
    let value = hex.replace("#", "");
    if (value.length === 3) {
      value = value
        .split("")
        .map((character) => character + character)
        .join("");
    }
    const number = Number.parseInt(value, 16);
    return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vao = gl.createVertexArray();
  const fieldTarget = createTarget(2);
  const haloA = createTarget(1);
  const haloB = createTarget(1);
  const ramp = new Float32Array(MAX_COLORS * 3);
  const clickData = new Float32Array(MAX_CLICKS * 4);
  const trailData = new Float32Array(MAX_TRAIL * 4);
  const clicks = [];
  const trail = [];
  const pointer = { x: 0, y: 0, inside: false };
  const view = { width: 1, height: 1, ratio: 1 };
  let atlas = null;
  let time = 0;
  let glyphTime = 0;
  let introClock = reducedMotion ? 1 : 0;
  let frameSeed = 0;
  let grainClock = 0;
  let raf = 0;
  let last = 0;
  let visible = true;

  settings.colors.forEach((color, index) => {
    ramp.set(toLab(parseColor(color)), index * 3);
  });

  const bindGlyphs = (program, width, height) => {
    if (!atlas) return;
    const uniforms = program.uniforms;
    const cellHeight = settings.cellSize * view.ratio;
    const cellWidth = cellHeight * (ATLAS_CELL_W / ATLAS_CELL_H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[0]);
    gl.uniform1i(uniforms.uField, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[1]);
    gl.uniform1i(uniforms.uAux, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
    gl.uniform1i(uniforms.uAtlas, 2);
    gl.uniform2f(uniforms.uResolution, width, height);
    gl.uniform2f(uniforms.uCell, cellWidth, cellHeight);
    gl.uniform2f(
      uniforms.uOffset,
      (width - Math.ceil(width / cellWidth) * cellWidth) / 2,
      (height - Math.ceil(height / cellHeight) * cellHeight) / 2,
    );
    gl.uniform2f(uniforms.uAtlasGrid, atlas.grid[0], atlas.grid[1]);
    gl.uniform1f(uniforms.uCount, atlas.count);
    gl.uniform1f(uniforms.uDensity, settings.density);
    gl.uniform1f(uniforms.uOpacity, settings.glyphOpacity);
    gl.uniform1f(uniforms.uFlicker, reducedMotion ? 0 : settings.flicker);
    gl.uniform1f(uniforms.uDepth, settings.depthOfField);
    gl.uniform1f(uniforms.uGlyphTime, glyphTime);
    gl.uniform1f(uniforms.uSeedValue, settings.variation);
    gl.uniform1f(uniforms.uLight, 0);
  };

  const draw = () => {
    const aspect = view.width / view.height;
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fieldTarget.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, fieldTarget.width, fieldTarget.height);
    gl.useProgram(fieldProgram.program);
    gl.uniform1f(fieldProgram.uniforms.uAspect, aspect);
    gl.uniform1f(fieldProgram.uniforms.uTime, time);
    gl.uniform1i(fieldProgram.uniforms.uShape, 0);
    gl.uniform3fv(fieldProgram.uniforms.uRamp, ramp);
    gl.uniform1i(fieldProgram.uniforms.uCount, settings.colors.length);
    gl.uniform1f(fieldProgram.uniforms.uScale, settings.scale);
    gl.uniform1f(fieldProgram.uniforms.uSoftness, settings.softness);
    gl.uniform1f(fieldProgram.uniforms.uFlow, settings.flow);
    gl.uniform2f(fieldProgram.uniforms.uSeed, 0, 0);
    gl.uniform4fv(fieldProgram.uniforms.uTrail, trailData);
    gl.uniform1f(fieldProgram.uniforms.uRadius, settings.scrambleRadius);
    gl.uniform4fv(fieldProgram.uniforms.uClicks, clickData);
    gl.uniform1i(fieldProgram.uniforms.uClickEffect, 1);
    gl.uniform1f(fieldProgram.uniforms.uIntro, introClock);
    gl.uniform1f(fieldProgram.uniforms.uFrame, frameSeed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, haloA.width, haloA.height);
    gl.useProgram(haloProgram.program);
    bindGlyphs(haloProgram, canvas.width, canvas.height);
    gl.uniform1f(haloProgram.uniforms.uDownscale, canvas.width / haloA.width);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(blurProgram.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(blurProgram.uniforms.uSource, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, haloB.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0]);
    gl.uniform2f(blurProgram.uniforms.uStep, 1 / haloA.width, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, haloB.textures[0]);
    gl.uniform2f(blurProgram.uniforms.uStep, 0, 1 / haloA.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(compositeProgram.program);
    bindGlyphs(compositeProgram, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0]);
    gl.uniform1i(compositeProgram.uniforms.uHalo, 3);
    gl.uniform1f(compositeProgram.uniforms.uGlow, settings.glow);
    gl.uniform1f(compositeProgram.uniforms.uGradient, settings.gradientOpacity);
    gl.uniform1f(compositeProgram.uniforms.uGrain, settings.grain);
    gl.uniform1f(compositeProgram.uniforms.uFrame, frameSeed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  const resize = () => {
    view.width = Math.max(1, container.clientWidth);
    view.height = Math.max(1, container.clientHeight);
    const pixelRatioCap = view.height > 2200 ? 1 : view.height > 1400 ? 1.25 : 1.5;
    view.ratio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
    canvas.width = Math.max(1, Math.round(view.width * view.ratio));
    canvas.height = Math.max(1, Math.round(view.height * view.ratio));
    sizeTarget(fieldTarget, Math.max(1, Math.round(canvas.width / 2)), Math.max(1, Math.round(canvas.height / 2)));
    sizeTarget(haloA, Math.max(1, Math.round(canvas.width / 4)), Math.max(1, Math.round(canvas.height / 4)));
    sizeTarget(haloB, haloA.width, haloA.height);
    draw();
  };

  const updateInput = (delta) => {
    trail.forEach((point) => {
      point.age += delta;
    });
    while (trail.length && trail[trail.length - 1].age > TRAIL_LIFE) trail.pop();
    for (let index = 0; index < MAX_TRAIL; index += 1) {
      const point = trail[index];
      if (!point) {
        trailData[index * 4 + 2] = 0;
        continue;
      }
      const strength = 1 - point.age / TRAIL_LIFE;
      trailData.set([point.x, point.y, strength * strength, 0], index * 4);
    }
    clicks.forEach((click) => {
      click.age += delta;
    });
    while (clicks.length && clicks[clicks.length - 1].age > CLICK_LIFE) clicks.pop();
    for (let index = 0; index < MAX_CLICKS; index += 1) {
      const click = clicks[index];
      if (!click) {
        clickData[index * 4 + 3] = 0;
        continue;
      }
      const ageRatio = click.age / CLICK_LIFE;
      const envelope = Math.min(1, click.age / 0.08) * (1 - ageRatio) ** 2;
      clickData.set([click.x, click.y, click.age, envelope], index * 4);
    }
  };

  const frame = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const delta = last ? Math.min(Math.max((now - last) / 1000, 0.001), 0.05) : 1 / 60;
    last = now;
    if (!reducedMotion) {
      time += delta * 0.5;
      glyphTime += delta;
    }
    if (introClock < 1) introClock = Math.min(1, introClock + delta / INTRO_SECONDS);
    grainClock += delta;
    if (!reducedMotion && grainClock > 1 / 24) {
      grainClock = 0;
      frameSeed = (frameSeed + 1) % 97;
    }
    updateInput(delta);
    draw();
    if (!reducedMotion || introClock < 1 || clicks.length || trail.length) {
      raf = requestAnimationFrame(frame);
    } else {
      last = 0;
    }
  };

  const wake = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const locate = (event) => {
    const bounds = container.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
    const y = 1 - (event.clientY - bounds.top) / Math.max(1, bounds.height);
    const aspect = bounds.width / Math.max(1, bounds.height);
    pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    pointer.x = (x - 0.5) * aspect;
    pointer.y = y - 0.5;
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      locate(event);
      if (!pointer.inside || reducedMotion) return;
      const head = trail[0];
      const gap = head ? Math.hypot(pointer.x - head.x, pointer.y - head.y) : Infinity;
      if (gap < TRAIL_STEP) return;
      if (head && head.age < 0.1) {
        const steps = Math.min(6, Math.floor(gap / (TRAIL_STEP * 2)));
        for (let index = 1; index <= steps; index += 1) {
          const amount = index / (steps + 1);
          trail.unshift({
            x: head.x + (pointer.x - head.x) * amount,
            y: head.y + (pointer.y - head.y) * amount,
            age: 0,
          });
        }
      }
      trail.unshift({ x: pointer.x, y: pointer.y, age: 0 });
      if (trail.length > MAX_TRAIL) trail.length = MAX_TRAIL;
      wake();
    },
    { passive: true },
  );

  window.addEventListener(
    "pointerdown",
    (event) => {
      locate(event);
      if (!pointer.inside || reducedMotion) return;
      clicks.unshift({ x: pointer.x, y: pointer.y, age: 0 });
      if (clicks.length > MAX_CLICKS) clicks.pop();
      wake();
    },
    { passive: true },
  );

  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) {
      last = 0;
      wake();
    }
  });
  intersection.observe(container);
  new ResizeObserver(resize).observe(container);
  document.addEventListener("visibilitychange", () => {
    last = 0;
    wake();
  });

  window.asciiBackground = {
    setExpanded(expanded) {
      container.dataset.expanded = String(expanded);
    },
  };

  atlas = buildAtlas();
  if (document.fonts?.load) {
    document.fonts.load(`300 64px ${settings.fontFamily}`, settings.characters).then(() => {
      if (!gl.isContextLost()) {
        if (atlas) gl.deleteTexture(atlas.texture);
        atlas = buildAtlas();
        draw();
      }
    }).catch(() => {});
  }
  resize();
  wake();
})();
