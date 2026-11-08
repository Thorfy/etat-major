import { MAP_HEIGHT, MAP_WIDTH, TOP_LATITUDE } from '../map/projection.ts';

export const VERTEX_SHADER = `#version 300 es
void main() {
  // Triangle unique couvrant tout l'écran.
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const topY = 1.25 * Math.log(Math.tan(Math.PI / 4 + (0.4 * TOP_LATITUDE * Math.PI) / 180));

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

uniform usampler2D uOwners;
uniform usampler2D uProvinces;
uniform sampler2D uPalette;
uniform sampler2D uCoast;
uniform usampler2D uProvinceHome;
uniform sampler2D uWars;
uniform sampler2D uTerrain;
uniform vec2 uCenter;
uniform vec2 uResolution;
uniform float uZoom;        // pixels physiques par cellule
uniform uint uHoverProvince;
uniform uint uSelectedProvince;
uniform uint uSelectedOwner;

out vec4 outColor;

const int MAP_W = ${MAP_WIDTH};
const int MAP_H = ${MAP_HEIGHT};
const float PI = 3.14159265;

const vec3 SEA_DEEP = vec3(0.118, 0.184, 0.227);
const vec3 SEA_SHALLOW = vec3(0.192, 0.282, 0.325);
const vec3 SEA_LINE = vec3(0.333, 0.431, 0.467);
const vec3 COAST_LINE = vec3(0.075, 0.106, 0.122);
const vec3 NATION_LINE = vec3(0.145, 0.129, 0.110);
const vec3 PROVINCE_LINE = vec3(0.235, 0.212, 0.180);
const vec3 HIGHLIGHT = vec3(0.961, 0.784, 0.286);
const vec3 FRONT_LINE = vec3(0.847, 0.169, 0.102);
const vec3 FRONT_GLOW = vec3(0.984, 0.553, 0.294);

ivec2 wrapCell(ivec2 c) {
  return ivec2(c.x & (MAP_W - 1), clamp(c.y, 0, MAP_H - 1));
}

// Parmi 4 cellules pondérées, garde l'identifiant de plus fort poids. L'écart avec
// le deuxième tient lieu de distance à la frontière : les contours sont lissés
// au lieu de montrer l'escalier des cellules.
void pickWinner(uvec4 ids, vec4 w, out uint best, out uint rival, out float margin) {
  vec4 sums = vec4(0.0);
  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 4; j++) {
      if (ids[j] == ids[i]) sums[i] += w[j];
    }
  }
  int top = 0;
  for (int i = 1; i < 4; i++) {
    if (sums[i] > sums[top]) top = i;
  }
  best = ids[top];
  float second = 0.0;
  rival = best;
  for (int i = 0; i < 4; i++) {
    if (ids[i] != best && sums[i] > second) {
      second = sums[i];
      rival = ids[i];
    }
  }
  margin = sums[top] - second;
}

float lineAlpha(float distancePx, float widthPx) {
  return 1.0 - smoothstep(widthPx - 0.6, widthPx + 0.6, distancePx);
}

float graticule(vec2 p) {
  float spacingX = float(MAP_W) / 24.0;
  float dx = abs(mod(p.x + spacingX * 0.5, spacingX) - spacingX * 0.5) * uZoom;
  float m = ${topY.toFixed(6)} - p.y * (2.0 * PI / float(MAP_W));
  float lat = 2.5 * (atan(exp(0.8 * m)) - PI / 4.0) * 180.0 / PI;
  float perPixel = max(abs(dFdy(lat)), 1e-5);
  float dy = abs(mod(lat + 7.5, 15.0) - 7.5) / perPixel;
  return max(lineAlpha(dx, 0.5), lineAlpha(dy, 0.5));
}

// Relief discret : il se lit sans jamais masquer la couleur du pays.
vec3 applyTerrain(vec3 color, vec2 p) {
  int id = int(texelFetch(uTerrain, wrapCell(ivec2(floor(p))), 0).r * 255.0 + 0.5);
  if (id == 1) {
    color *= 0.87;
    float line = abs(fract((p.x + p.y * 0.6) / 2.7) - 0.5) * 2.0;
    color *= 1.0 - 0.12 * smoothstep(0.72, 0.95, line) * smoothstep(1.0, 2.0, uZoom);
  } else if (id == 2) {
    color *= 0.95;
  } else if (id == 3) {
    color = mix(color, vec3(0.93, 0.84, 0.62), 0.14);
  } else if (id == 4) {
    color = mix(color, vec3(0.93, 0.95, 0.97), 0.13);
  } else if (id == 5) {
    color = mix(color, vec3(0.20, 0.36, 0.20), 0.15);
  }
  return color;
}

vec3 shade(vec2 p, float gratAlpha) {
  vec2 q = p - 0.5;
  vec2 base = floor(q);
  vec2 f = q - base;
  ivec2 c = ivec2(base);
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);

  ivec2 c0 = wrapCell(c);
  ivec2 c1 = wrapCell(c + ivec2(1, 0));
  ivec2 c2 = wrapCell(c + ivec2(0, 1));
  ivec2 c3 = wrapCell(c + ivec2(1, 1));

  uvec4 owners = uvec4(
    texelFetch(uOwners, c0, 0).r, texelFetch(uOwners, c1, 0).r,
    texelFetch(uOwners, c2, 0).r, texelFetch(uOwners, c3, 0).r);
  uvec4 provinces = uvec4(
    texelFetch(uProvinces, c0, 0).r, texelFetch(uProvinces, c1, 0).r,
    texelFetch(uProvinces, c2, 0).r, texelFetch(uProvinces, c3, 0).r);

  uint owner, ownerRival, province, provinceRival;
  float ownerMargin, provinceMargin;
  pickWinner(owners, w, owner, ownerRival, ownerMargin);
  pickWinner(provinces, w, province, provinceRival, provinceMargin);

  float ownerDist = ownerMargin * uZoom * 0.5;
  float provinceDist = provinceMargin * uZoom * 0.5;
  bool hasOwnerEdge = ownerMargin < 0.999;
  bool hasCoast = hasOwnerEdge && (owners.x == 0u || owners.y == 0u || owners.z == 0u || owners.w == 0u);

  vec3 color;
  if (owner == 0u) {
    float depth = texture(uCoast, p / vec2(float(MAP_W), float(MAP_H))).r;
    color = mix(SEA_SHALLOW, SEA_DEEP, smoothstep(0.0, 0.42, depth));
    float bandWidth = max(0.003, 0.7 * fwidth(depth));
    float band = min(abs(depth - 0.05), abs(depth - 0.13));
    color = mix(color, SEA_LINE, 0.34 * (1.0 - smoothstep(0.0, bandWidth, band)));
    color = mix(color, SEA_LINE, 0.28 * gratAlpha);
  } else {
    color = texelFetch(uPalette, ivec2(int(owner), 0), 0).rgb;
    color = applyTerrain(color, p);
    // Territoire occupé : hachures aux couleurs de son pays d'origine.
    uint home = texelFetch(uProvinceHome, ivec2(int(province), 0), 0).r;
    if (home != 0u && home != owner) {
      float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 12.0));
      color = mix(color, texelFetch(uPalette, ivec2(int(home), 0), 0).rgb, 0.55 * stripe);
    }
    color = mix(color, NATION_LINE, 0.07 * gratAlpha);
    if (owner == uSelectedOwner) color = mix(color, vec3(1.0), 0.20);
    if (province == uHoverProvince) color = mix(color, vec3(1.0), 0.16);
    if (province == uSelectedProvince) color = mix(color, HIGHLIGHT, 0.42);

    float provinceVisible = smoothstep(0.75, 2.4, uZoom);
    if (provinceVisible > 0.0 && provinceMargin < 0.999) {
      color = mix(color, PROVINCE_LINE, 0.42 * provinceVisible * lineAlpha(provinceDist, 0.35));
    }
  }

  if (hasOwnerEdge) {
    float zoomWidth = clamp(uZoom * 0.14, 0.45, 1.3);
    bool atWar = owner != 0u && ownerRival != 0u
      && texelFetch(uWars, ivec2(int(owner), int(ownerRival)), 0).r > 0.5;
    if (atWar) {
      color = mix(color, FRONT_GLOW, 0.5 * lineAlpha(ownerDist, zoomWidth * 3.2));
      color = mix(color, FRONT_LINE, lineAlpha(ownerDist, max(zoomWidth * 1.3, 0.9)));
    } else if (hasCoast) {
      color = mix(color, COAST_LINE, 0.9 * lineAlpha(ownerDist, zoomWidth * 0.85));
    } else {
      color = mix(color, NATION_LINE, 0.95 * lineAlpha(ownerDist, zoomWidth));
    }
  }

  if (uSelectedProvince != 0u && provinceMargin < 0.999
      && (provinces.x == uSelectedProvince || provinces.y == uSelectedProvince
       || provinces.z == uSelectedProvince || provinces.w == uSelectedProvince)) {
    color = mix(color, HIGHLIGHT, lineAlpha(provinceDist, 0.9));
  }
  return color;
}

void main() {
  vec2 screen = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 p = uCenter + (screen - uResolution * 0.5) / uZoom;
  float gratAlpha = graticule(p);

  if (uZoom >= 2.0) {
    outColor = vec4(shade(p, gratAlpha), 1.0);
    return;
  }
  // Dézoomé, un pixel couvre plusieurs cellules : 4 échantillons par pixel.
  vec3 sum = vec3(0.0);
  sum += shade(p + vec2(-0.125, -0.375) / uZoom, gratAlpha);
  sum += shade(p + vec2( 0.375, -0.125) / uZoom, gratAlpha);
  sum += shade(p + vec2(-0.375,  0.125) / uZoom, gratAlpha);
  sum += shade(p + vec2( 0.125,  0.375) / uZoom, gratAlpha);
  outColor = vec4(sum * 0.25, 1.0);
}`;
